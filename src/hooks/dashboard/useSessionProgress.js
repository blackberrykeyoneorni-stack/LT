import { useState, useEffect, useCallback } from 'react';
import { 
    collection, query, where, getDocs, 
    Timestamp, doc, getDoc, updateDoc, writeBatch, 
    serverTimestamp, increment, arrayUnion 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { safeDate } from '../../utils/dateUtils'; 

// Bestimmt den Kontext für die Nacht-Prüfung
const getPreviousNightContext = (referenceDate) => {
    const yesterday = new Date(referenceDate);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const offset = yesterday.getTimezoneOffset() * 60000;
    const dateStr = new Date(yesterday.getTime() - offset).toISOString().split('T')[0];
    return { periodId: `${dateStr}-night`, dateStr: dateStr };
};

export default function useSessionProgress(currentUser, items) {
    const [activeSessions, setActiveSessions] = useState([]);
    const [dailyTargetHours, setDailyTargetHours] = useState(3);
    const [loading, setLoading] = useState(true);
    
    const [progress, setProgress] = useState({
        currentContinuousMinutes: 0,
        percentage: 0,
        isDailyGoalMet: false,
        sessionsToday: [], 
        isNightLocked: false, 
        nightStatus: 'unknown',
        targetMinutes: 180
    });

    // 1. SETTINGS & PROGRESSIVE OVERLOAD LADEN
    const loadSettingsAndCheckUpdate = useCallback(async () => {
        if (!currentUser) return;
        try {
            const prefsRef = doc(db, `users/${currentUser.uid}/settings/preferences`);
            const pSnap = await getDoc(prefsRef);
            
            let currentTarget = 3;
            let lastUpdate = null;

            if (pSnap.exists()) {
                const data = pSnap.data();
                currentTarget = data.dailyTargetHours || 3;
                lastUpdate = data.lastWeeklyUpdate ? safeDate(data.lastWeeklyUpdate) : null;
                setDailyTargetHours(currentTarget);
            }

            // --- PROGRESSIVE OVERLOAD CHECK ---
            const now = new Date();
            const currentDay = now.getDay(); 
            
            // Wir prüfen immer Montags (oder wenn das letzte Update älter als diese Woche ist)
            const thisWeekMonday = new Date(now);
            const dayShift = (currentDay + 6) % 7; 
            thisWeekMonday.setDate(now.getDate() - dayShift);
            thisWeekMonday.setHours(0, 0, 0, 0);

            if (!lastUpdate || lastUpdate < thisWeekMonday) {
                console.log("Checking Progressive Overload for past week...");
                
                const lastWeekMon = new Date(thisWeekMonday);
                lastWeekMon.setDate(lastWeekMon.getDate() - 7);
                
                const lastWeekFri = new Date(lastWeekMon);
                lastWeekFri.setDate(lastWeekFri.getDate() + 4);
                lastWeekFri.setHours(23, 59, 59, 999);

                const qPast = query(
                    collection(db, `users/${currentUser.uid}/sessions`),
                    where('startTime', '>=', Timestamp.fromDate(lastWeekMon)),
                    where('startTime', '<=', Timestamp.fromDate(lastWeekFri)),
                    where('type', '==', 'instruction')
                );
                
                const pastSnap = await getDocs(qPast);
                
                // FIX: Berechnung der effektiven Zeit mittels Intervall-Merging
                let timeIntervals = [];

                pastSnap.forEach(d => {
                    const data = d.data();
                    
                    if (data.period && typeof data.period === 'string' && data.period.includes('night')) {
                        return; 
                    }

                    const start = safeDate(data.startTime);
                    const dur = data.durationMinutes || 0;

                    if (start && dur > 0) {
                        timeIntervals.push({
                            start: start.getTime(),
                            end: start.getTime() + (dur * 60000)
                        });
                    }
                });

                timeIntervals.sort((a, b) => a.start - b.start);

                let mergedIntervals = [];
                if (timeIntervals.length > 0) {
                    let current = timeIntervals[0];
                    for (let i = 1; i < timeIntervals.length; i++) {
                        const next = timeIntervals[i];
                        if (next.start < current.end) {
                            current.end = Math.max(current.end, next.end);
                        } else {
                            mergedIntervals.push(current);
                            current = next;
                        }
                    }
                    mergedIntervals.push(current);
                }

                const totalMinutes = mergedIntervals.reduce((sum, interval) => {
                    return sum + (interval.end - interval.start) / 60000;
                }, 0);

                const averageMinutes = totalMinutes / 5;
                const averageHours = averageMinutes / 60;
                
                const newTarget = Math.round(averageHours * 10) / 10;

                if (newTarget > currentTarget) {
                    await updateDoc(prefsRef, {
                        dailyTargetHours: newTarget,
                        previousTargetHours: currentTarget, 
                        lastWeeklyUpdate: serverTimestamp()
                    });
                    setDailyTargetHours(newTarget);
                } else {
                    await updateDoc(prefsRef, {
                        lastWeeklyUpdate: serverTimestamp()
                    });
                }
            }
        } catch (e) {
            console.error("Error loading settings/overload:", e);
        }
    }, [currentUser]);

    // 2. HAUPT-LOGIK (Progress Calculation)
    const loadActiveSessions = useCallback(async () => {
        if (!currentUser) return;
        
        try {
            const now = new Date();
            
            // --- ZYKLUS-LOGIK (23:00 Uhr Reset) ---
            const referenceDate = new Date(now);
            if (now.getHours() >= 23) {
                referenceDate.setDate(referenceDate.getDate() + 1);
            }
            referenceDate.setHours(0, 0, 0, 0);

            // A) Aktive Sessions laden
            const qActive = query(
                collection(db, `users/${currentUser.uid}/sessions`),
                where('endTime', '==', null)
            );
            const activeSnap = await getDocs(qActive);
            
            let activeList = activeSnap.docs.map(d => ({ 
                id: d.id, 
                ...d.data(), 
                startTime: safeDate(d.data().startTime),
                type: d.data().type || 'instruction',
                currentDuration: Math.floor((new Date() - safeDate(d.data().startTime)) / 60000)
            }));

            activeList.sort((a, b) => b.startTime - a.startTime);
            setActiveSessions(activeList);

            // B) NACHT-CHECK
            const { periodId, dateStr } = getPreviousNightContext(referenceDate);
            
            const qNight = query(
                collection(db, `users/${currentUser.uid}/sessions`),
                where('period', '==', periodId),
                where('type', '==', 'instruction')
            );
            const nightSnap = await getDocs(qNight);
            
            const nightBaseDate = new Date(dateStr);
            const nextDay = new Date(nightBaseDate);
            nextDay.setDate(nextDay.getDate() + 1); 

            const checkpoints = [
                { h: 1, m: 30 }, { h: 3, m: 0 }, { h: 4, m: 30 }, { h: 6, m: 0 }
            ].map(cp => {
                const d = new Date(nextDay);
                d.setHours(cp.h, cp.m, 0, 0);
                return d;
            });

            const allCheckpointsMet = checkpoints.every(cpTime => {
                return nightSnap.docs.some(d => {
                    const data = d.data();
                    const start = safeDate(data.startTime);
                    const end = safeDate(data.endTime) || new Date();
                    return start <= cpTime && end >= cpTime;
                });
            });

            const nightFulfilled = nightSnap.empty ? false : allCheckpointsMet;

            // C) TAGES-FORTSCHRITT
            const targetMinutes = dailyTargetHours * 60;
            
            const qToday = query(
                collection(db, `users/${currentUser.uid}/sessions`),
                where('startTime', '>=', Timestamp.fromDate(referenceDate)),
                where('type', '==', 'instruction')
            );
            const todaySnap = await getDocs(qToday);
            
            const todaySessions = todaySnap.docs
                .map(d => ({
                    id: d.id,
                    ...d.data(),
                    startTime: safeDate(d.data().startTime),
                    endTime: safeDate(d.data().endTime)
                }))
                .filter(s => !s.period || !s.period.endsWith('-night'));

            const sessionGroups = {};
            todaySessions.forEach(s => {
                if (s.period) {
                    if (!sessionGroups[s.period]) sessionGroups[s.period] = [];
                    sessionGroups[s.period].push(s);
                }
            });

            let maxValidProgress = 0;
            let isMet = false;

            Object.values(sessionGroups).forEach(group => {
                if (group.length === 0) return;
                const expectedCount = group[0].itemIds ? group[0].itemIds.length : 1;
                if (group.length < expectedCount) return;

                const startTimes = group.map(s => s.startTime.getTime());
                const effectiveStart = Math.max(...startTimes);

                let effectiveEnd = Date.now();
                let anyStopped = false;
                
                for (const s of group) {
                    if (s.endTime) {
                        anyStopped = true;
                        if (s.endTime.getTime() < effectiveEnd) {
                            effectiveEnd = s.endTime.getTime();
                        }
                    }
                }

                let duration = Math.floor((effectiveEnd - effectiveStart) / 60000);
                if (duration < 0) duration = 0;

                // RESET REGEL
                if (anyStopped && duration < targetMinutes) {
                    duration = 0;
                }

                if (duration > maxValidProgress) maxValidProgress = duration;
            });

            // ÄNDERUNG: Kein Cap mehr bei targetMinutes. Zeit läuft weiter.
            if (maxValidProgress >= targetMinutes) {
                isMet = true;
            }

            let finalPercentage = 0;
            let isLocked = false;

            if (nightFulfilled) {
                // Erlaubt Werte > 100%
                finalPercentage = Math.round((maxValidProgress / targetMinutes) * 100);
            } else {
                isLocked = true;
                finalPercentage = 0;
            }

            setProgress({
                currentContinuousMinutes: isLocked ? 0 : maxValidProgress, 
                percentage: finalPercentage,
                isDailyGoalMet: isMet,
                sessionsToday: todaySessions,
                isNightLocked: isLocked, 
                nightStatus: nightFulfilled ? 'fulfilled' : 'failed',
                targetMinutes
            });

            await syncItemStatuses(activeList);

        } catch (e) {
            console.error("Progress Calc Error:", e);
        } finally {
            setLoading(false);
        }
    }, [currentUser, dailyTargetHours]); 

    const syncItemStatuses = async (currentActiveSessions) => {
        if (!items || !currentActiveSessions) return;
        const batch = writeBatch(db);
        let changesCount = 0;
        const busyItemIds = new Set(currentActiveSessions.map(s => s.itemId));

        items.forEach(item => {
            if (item.status === 'active' && busyItemIds.has(item.id)) {
                batch.update(doc(db, `users/${currentUser.uid}/items`, item.id), { status: 'wearing' });
                changesCount++;
            }
            else if (item.status === 'wearing' && !busyItemIds.has(item.id)) {
                batch.update(doc(db, `users/${currentUser.uid}/items`, item.id), { status: 'active' });
                changesCount++;
            }
        });

        if (changesCount > 0) await batch.commit();
    };

    useEffect(() => {
        let mounted = true;
        const init = async () => {
            setLoading(true);
            await loadSettingsAndCheckUpdate();
            await loadActiveSessions();
            setLoading(false);
        };
        
        if (currentUser) {
            init();
            const interval = setInterval(() => {
                if(mounted) loadActiveSessions();
            }, 60000);
            return () => { mounted = false; clearInterval(interval); };
        }
    }, [currentUser, loadSettingsAndCheckUpdate, loadActiveSessions]);

    // --- ACTIONS ---

    const startSession = async (sessionData, type = 'instruction') => {
        if (!currentUser || !sessionData) return;
        
        const batch = writeBatch(db);
        
        if (type === 'instruction' && sessionData.items) {
            const itemIds = sessionData.items.map(i => i.id);
            let lagMinutes = 0;
            
            if (sessionData.acceptedAt) {
                const acceptDate = safeDate(sessionData.acceptedAt);
                if (acceptDate) {
                    const diffMs = Date.now() - acceptDate.getTime();
                    lagMinutes = Math.max(0, Math.floor(diffMs / 60000));
                }
            }

            sessionData.items.forEach(item => { 
                const sessionRef = doc(collection(db, `users/${currentUser.uid}/sessions`)); 
                batch.set(sessionRef, { 
                    itemId: item.id, 
                    itemIds, 
                    type: 'instruction', 
                    period: sessionData.periodId, 
                    startTime: serverTimestamp(), 
                    endTime: null, 
                    complianceLagMinutes: lagMinutes 
                }); 
                batch.update(doc(db, `users/${currentUser.uid}/items/${item.id}`), { status: 'wearing' }); 
            });
        } 
        else if (sessionData.itemId) {
            const sessionRef = doc(collection(db, `users/${currentUser.uid}/sessions`));
            batch.set(sessionRef, {
                itemId: sessionData.itemId,
                type: type,
                startTime: serverTimestamp(),
                endTime: null,
                note: sessionData.note || ''
            });
            batch.update(doc(db, `users/${currentUser.uid}/items/${sessionData.itemId}`), { status: 'wearing' });
        }

        await batch.commit();
        await loadActiveSessions(); 
    };

    const stopSession = async (session, feedbackData = {}) => {
        if (!currentUser || !session) return;
        const { feelings = [], note = '' } = feedbackData;

        try { 
            const endTime = serverTimestamp(); 
            const durationMinutes = Math.floor((Date.now() - session.startTime.getTime()) / 60000); 
            
            await updateDoc(doc(db, `users/${currentUser.uid}/sessions`, session.id), { 
                endTime, 
                durationMinutes, 
                feelings, 
                note 
            });

            if (session.itemId && session.type !== 'punishment') {
                await updateDoc(doc(db, `users/${currentUser.uid}/items`, session.itemId), { 
                    status: 'active', 
                    wearCount: increment(1), 
                    totalMinutes: increment(durationMinutes), 
                    lastWorn: endTime 
                });
            } else if (session.itemId) {
                await updateDoc(doc(db, `users/${currentUser.uid}/items`, session.itemId), { status: 'active' });
            }

            await loadActiveSessions();
            return true;
        } catch(e) {
            console.error("Stop Session Error", e);
            throw e;
        } 
    };

    const registerRelease = async (outcome, intensity) => {
        if (!activeSessions.length || !currentUser) return;
        const batch = writeBatch(db);
        try {
            const releaseEvent = { 
                timestamp: new Date(), 
                outcome, 
                intensity, 
                allParticipatingItems: activeSessions.map(s => s.itemId) 
            };

            activeSessions.forEach(s => {
                const sessionRef = doc(db, `users/${currentUser.uid}/sessions`, s.id);
                batch.update(sessionRef, { releases: arrayUnion(releaseEvent) });
            });

            const isOrgasm = outcome !== 'maintained';
            const keptOn = outcome === 'cum_kept'; 

            if (isOrgasm) {
                const statsRef = doc(db, `users/${currentUser.uid}/stats/releaseStats`);
                batch.set(statsRef, { 
                    totalReleases: increment(1),
                    keptOn: keptOn ? increment(1) : increment(0)
                }, { merge: true });
            }

            const shouldEndSession = isOrgasm && !keptOn;

            if (shouldEndSession) {
                const endTime = serverTimestamp();
                activeSessions.forEach(s => {
                    const sessionRef = doc(db, `users/${currentUser.uid}/sessions`, s.id);
                    const duration = Math.floor((Date.now() - s.startTime.getTime()) / 60000);
                    batch.update(sessionRef, { 
                        endTime, 
                        durationMinutes: duration, 
                        status: 'compromised' 
                    });
                    
                    const itemRef = doc(db, `users/${currentUser.uid}/items`, s.itemId);
                    batch.update(itemRef, { 
                        status: 'active',
                        lastWorn: endTime 
                    });
                });
            }

            await batch.commit();
            await loadActiveSessions(); 
            return { success: true, compromised: shouldEndSession };
        } catch (e) {
            console.error("Release Error", e);
            throw e;
        }
    };

    return {
        activeSessions,
        progress, 
        loading,
        dailyTargetHours,
        loadActiveSessions,
        startSession, 
        startInstructionSession: startSession, // WICHTIG: ALIAS FÜR BACKWARD COMPATIBILITY
        stopSession,
        registerRelease
    };
}
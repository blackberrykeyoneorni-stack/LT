// src/services/InstructionService.js
import { db } from '../firebase';
import { collection, serverTimestamp, query, where, getDocs, doc, setDoc, getDoc, orderBy, limit } from 'firebase/firestore';
import { DEFAULT_PROTOCOL_RULES } from '../config/defaultRules';

// --- HELPER FUNKTIONEN ---

const calculateTargetDuration = async (uid, prefs, periodId) => {
    if (periodId && periodId.includes('night')) {
        return parseInt(prefs.nightDurationMinutes || 480, 10);
    }

    try {
        const protocolRef = doc(db, `users/${uid}/settings/protocol`);
        const protocolSnap = await getDoc(protocolRef);
        
        let goalHours = 4;
        if (protocolSnap.exists() && protocolSnap.data().currentDailyGoal !== undefined) {
            goalHours = parseFloat(protocolSnap.data().currentDailyGoal);
        } else if (prefs.dailyTargetHours) {
            goalHours = parseFloat(prefs.dailyTargetHours);
        }
        
        return Math.round(goalHours * 60);
    } catch (e) {
        console.error("Fehler bei der Ermittlung der Tragedauer:", e);
        return 240; 
    }
};

const isItemInRecovery = (item, restingHours = 24) => {
    if (!item.mainCategory || item.mainCategory !== 'Nylons') {
        return false;
    }

    if (!item.lastWorn) {
        return false;
    }

    const lastWornDate = item.lastWorn.toDate ? item.lastWorn.toDate() : new Date(item.lastWorn);

    if (isNaN(lastWornDate.getTime())) {
        return false;
    }

    const hoursSince = (new Date() - lastWornDate) / (1000 * 60 * 60);
    return hoursSince < restingHours;
};

const getFutureBlockedItemIds = async (uid, items, currentDurationMinutes, restingHours) => {
    try {
        const now = new Date();
        const futureLimit = new Date();
        futureLimit.setDate(futureLimit.getDate() + 14);

        const q = query(
            collection(db, `users/${uid}/sessions`),
            where('type', '==', 'planned'),
            where('startTime', '>', now),
            where('startTime', '<=', futureLimit)
        );

        const snap = await getDocs(q);
        let blockedIds = [];

        snap.forEach(doc => {
            const data = doc.data();
            if (!data.startTime) return;
            const plannedStart = data.startTime.toDate();
            
            let sessionItemIds = [];
            if (data.itemId) sessionItemIds.push(data.itemId);
            if (data.itemIds && Array.isArray(data.itemIds)) {
                sessionItemIds = [...sessionItemIds, ...data.itemIds];
            }

            sessionItemIds.forEach(id => {
                const item = items.find(i => i.id === id);
                if (!item) return;

                const isNylon = item.mainCategory === 'Nylons';
                const itemRestingMs = isNylon ? (restingHours * 60 * 60 * 1000) : 0;
                const wearDurationMs = currentDurationMinutes * 60 * 1000;
                
                const availableAgainAt = new Date(now.getTime() + wearDurationMs + itemRestingMs);

                if (availableAgainAt >= plannedStart) {
                    blockedIds.push(id);
                }
            });
        });

        return [...new Set(blockedIds)];
    } catch (e) {
        return [];
    }
};

const checkTodayPlan = async (uid, allItems, periodId) => {
    try {
        if (!periodId) return [];
        const isNight = periodId.includes('night');
        const targetPeriod = isNight ? 'night' : 'day';

        const dateParts = periodId.split('-');
        if (dateParts.length < 3) return [];
        
        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1;
        const day = parseInt(dateParts[2]);

        const targetDateStart = new Date(year, month, day, 0, 0, 0, 0);
        const targetDateEnd = new Date(year, month, day, 23, 59, 59, 999);

        const q = query(
            collection(db, `users/${uid}/sessions`),
            where('type', '==', 'planned'),
            where('startTime', '>=', targetDateStart),
            where('startTime', '<=', targetDateEnd)
        );

        const snap = await getDocs(q);
        let plannedItemIds = [];

        snap.forEach(doc => {
            const data = doc.data();
            if (data.plannedPeriod === targetPeriod) {
                if (data.itemId) plannedItemIds.push(data.itemId);
                if (data.itemIds && Array.isArray(data.itemIds)) {
                    plannedItemIds.push(...data.itemIds);
                }
            }
        });

        if (plannedItemIds.length > 0) {
            return allItems.filter(i => plannedItemIds.includes(i.id));
        }
        return [];
    } catch (e) {
        return [];
    }
};

export const getLastInstruction = async (uid) => {
    try {
        const docRef = doc(db, `users/${uid}/status/dailyInstruction`);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data();
        }
        return null;
    } catch (e) {
        return null;
    }
};

const getProtocolSettings = async (userId) => {
    try {
        const settingsRef = doc(db, `users/${userId}/settings/protocol`);
        const settingsSnap = await getDoc(settingsRef);

        if (settingsSnap.exists()) {
            const data = settingsSnap.data();
            return {
                ...DEFAULT_PROTOCOL_RULES,
                ...data,
                instruction: {
                    ...DEFAULT_PROTOCOL_RULES.instruction,
                    ...(data.instruction || {}),
                    forcedReleaseMethods: {
                        ...DEFAULT_PROTOCOL_RULES.instruction.forcedReleaseMethods,
                        ...(data.instruction?.forcedReleaseMethods || {})
                    }
                }
            };
        }
    } catch (e) {}
    return DEFAULT_PROTOCOL_RULES;
};

const getRecentSessionsMap = async (uid, lookbackHours = 48) => {
    try {
        const now = new Date();
        const past = new Date(now.getTime() - (lookbackHours * 60 * 60 * 1000));

        const q = query(
            collection(db, `users/${uid}/sessions`),
            where('endTime', '>=', past),
            orderBy('endTime', 'desc')
        );

        const snap = await getDocs(q);
        const map = {}; 

        snap.forEach(doc => {
            const data = doc.data();
            const endDate = data.endTime ? data.endTime.toDate() : new Date();

            const ids = [];
            if (data.itemId) ids.push(data.itemId);
            if (data.itemIds && Array.isArray(data.itemIds)) ids.push(...data.itemIds);

            ids.forEach(id => {
                if (!map[id] || endDate > map[id]) {
                    map[id] = endDate;
                }
            });
        });

        return map;
    } catch (e) {
        return {};
    }
};

export const verifyNightCompliance = async (userId, referenceDate = new Date()) => {
    try {
        const year = referenceDate.getFullYear();
        const month = referenceDate.getMonth();
        const day = referenceDate.getDate();

        const checkpoints = [
            new Date(year, month, day, 1, 30, 0), 
            new Date(year, month, day, 3, 0, 0),  
            new Date(year, month, day, 4, 30, 0), 
            new Date(year, month, day, 6, 0, 0),  
            new Date(year, month, day, 7, 29, 0)  
        ];

        const searchStart = new Date(year, month, day - 1, 16, 0, 0);

        const q = query(
            collection(db, `users/${userId}/sessions`),
            where('type', '==', 'instruction'),
            where('startTime', '>=', searchStart),
            orderBy('startTime', 'asc')
        );

        const sessionsSnap = await getDocs(q);
        const rawSessions = [];
        const now = new Date();

        sessionsSnap.forEach(doc => {
            const data = doc.data();
            rawSessions.push({
                start: data.startTime.toDate(),
                end: data.endTime ? data.endTime.toDate() : now,
                ...data
            });
        });

        rawSessions.sort((a, b) => a.start - b.start);
        const sessions = [];
        if (rawSessions.length > 0) {
            let current = { ...rawSessions[0] };
            for (let i = 1; i < rawSessions.length; i++) {
                const next = rawSessions[i];
                if ((next.start - current.end) <= 15 * 60000) { 
                    current.end = new Date(Math.max(current.end, next.end));
                } else {
                    sessions.push(current);
                    current = { ...next };
                }
            }
            sessions.push(current);
        }

        let allCheckpointsCovered = true;
        const missedCheckpoints = [];

        checkpoints.forEach(cp => {
            const isCovered = sessions.some(s => s.start <= cp && s.end >= cp);

            if (!isCovered) {
                allCheckpointsCovered = false;
                missedCheckpoints.push(cp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            }
        });

        const offset = referenceDate.getTimezoneOffset() * 60000;
        const dateKey = new Date(referenceDate.getTime() - offset).toISOString().split('T')[0]; 
        
        await setDoc(doc(db, `users/${userId}/status/nightCompliance`), {
            date: dateKey,
            success: allCheckpointsCovered,
            missedCheckpoints,
            lastChecked: serverTimestamp()
        }, { merge: true });

        return allCheckpointsCovered;

    } catch (e) {
        return false;
    }
};

export const generateAndSaveInstruction = async (uid, items, activeSessions, periodId) => {
    try {
        const prefsSnap = await getDoc(doc(db, `users/${uid}/settings/preferences`));
        const prefs = prefsSnap.exists() ? prefsSnap.data() : {};

        const protocolSettings = await getProtocolSettings(uid);
        const durationMinutes = await calculateTargetDuration(uid, prefs, periodId);

        const maxItems = parseInt(prefs.maxInstructionItems || 1, 10);
        const restingHours = prefs.nylonRestingHours || 24;
        const userWeights = prefs.categoryWeights || {}; 

        const recentSessionsMap = await getRecentSessionsMap(uid, restingHours + 5);

        // --- FORCED UNIFORMITY (ERZWUNGENE MONOTONIE) CHECK ---
        const uniformityRef = doc(db, `users/${uid}/status/uniformity`);
        const uniformitySnap = await getDoc(uniformityRef);
        
        if (uniformitySnap.exists()) {
            const uniData = uniformitySnap.data();
            const now = new Date();
            const expiresAt = uniData.expiresAt?.toDate ? uniData.expiresAt.toDate() : new Date(uniData.expiresAt);

            if (uniData.active && expiresAt > now) {
                const uniformityItems = items.filter(i => uniData.itemIds && uniData.itemIds.includes(i.id));
                
                if (uniformityItems.length > 0) {
                    const titleNames = uniformityItems.map(i => i.subCategory || i.name || 'Item').join(' & ');

                    const instructionData = {
                        periodId,
                        generatedAt: serverTimestamp(),
                        isAccepted: false,
                        isPlanned: false,
                        itemName: `STRAF-UNIFORM: ${titleNames}`,
                        durationMinutes, 
                        stealthModeActive: false, 
                        uniformityLockActive: true,
                        forcedRelease: { required: false, executed: false, method: null },
                        transitProtocol: { active: false },
                        items: uniformityItems.map((i, index) => ({
                            id: i.id,
                            name: i.subCategory || i.name || 'Unbenanntes Item',
                            brand: i.brand || '',
                            img: i.imageUrl || (i.images && i.images[0]) || null,
                            subCategory: i.subCategory || '',
                            orderIndex: index + 1 // Auch die Straf-Uniform benötigt zwingend die Reihenfolge
                        }))
                    };

                    await setDoc(doc(db, `users/${uid}/status/dailyInstruction`), instructionData);
                    return instructionData;
                }
            }
        }
        // -----------------------------------------------------------

        // --- STEALTH MODUS: KOFFER PRÜFUNG & PRE-BLOCKING ---
        let isStealth = false;
        let activePackedDayIds = [];
        let activePackedNightIds = [];
        let futurePackedItemIds = [];

        const suspQ = query(collection(db, `users/${uid}/suspensions`), where('status', 'in', ['active', 'scheduled']), where('type', '==', 'stealth_travel'));
        const suspSnap = await getDocs(suspQ);

        suspSnap.forEach(doc => {
            const data = doc.data();
            const dayIds = data.packedItemsDay || [];
            const nightIds = data.packedItemsNight || [];
            const legacyIds = data.packedItemIds || []; 
            
            const allTripIds = [...new Set([...dayIds, ...nightIds, ...legacyIds])];

            if (data.status === 'active') {
                isStealth = true;
                activePackedDayIds = dayIds.length > 0 ? dayIds : legacyIds;
                activePackedNightIds = nightIds.length > 0 ? nightIds : legacyIds.filter(id => {
                    const itm = items.find(i => i.id === id);
                    return itm && itm.subCategory === 'Strumpfhose';
                });
            } else if (data.status === 'scheduled') {
                futurePackedItemIds.push(...allTripIds);
            }
        });

        const plannedItems = await checkTodayPlan(uid, items, periodId);
        let selectedItems = [...plannedItems];
        let isPlannedInstruction = plannedItems.length > 0;

        const safeActiveSessions = Array.isArray(activeSessions) ? activeSessions : [];
        const allActiveIds = new Set();
        const activeCategoryKeys = new Set(); 

        safeActiveSessions.forEach(s => {
            const sessionIds = [];
            if (s.itemId) sessionIds.push(s.itemId);
            if (s.itemIds && Array.isArray(s.itemIds)) sessionIds.push(...s.itemIds);
            
            sessionIds.forEach(id => {
                allActiveIds.add(id);
                const activeItem = items.find(i => i.id === id);
                if (activeItem) {
                    const key = activeItem.subCategory || activeItem.mainCategory || 'Sonstiges';
                    activeCategoryKeys.add(key);
                }
            });
        });

        selectedItems.forEach(item => {
            const key = item.subCategory || item.mainCategory || 'Sonstiges';
            activeCategoryKeys.add(key);
        });

        const futureBlockedIds = await getFutureBlockedItemIds(uid, items, durationMinutes, restingHours);
        const isNightInstruction = periodId && periodId.includes('night');

        // 3. Filterung der verfügbaren Items
        const availableItems = items.filter(i => {
            if (selectedItems.some(si => si.id === i.id)) return false;
            if (i.status !== 'active') return false;

            if (isStealth) {
                if (isNightInstruction) {
                    if (!activePackedNightIds.includes(i.id)) return false;
                } else {
                    if (!activePackedDayIds.includes(i.id)) return false;
                }
            } else {
                if (futurePackedItemIds.includes(i.id)) return false;
            }

            if (allActiveIds.has(i.id)) return false;

            const itemKey = i.subCategory || i.mainCategory || 'Sonstiges';
            if (activeCategoryKeys.has(itemKey)) return false;

            let effectiveItem = i;
            if (recentSessionsMap[i.id]) {
                const sessionDate = recentSessionsMap[i.id];
                const itemDate = i.lastWorn && i.lastWorn.toDate ? i.lastWorn.toDate() : (i.lastWorn ? new Date(i.lastWorn) : null);

                if (!itemDate || sessionDate > itemDate) {
                    effectiveItem = { ...i, lastWorn: sessionDate }; 
                }
            }

            if (!isStealth && isItemInRecovery(effectiveItem, restingHours)) return false;

            const itemSub = (i.subCategory || '').toLowerCase();
            if (i.mainCategory === 'Accessoires' && (itemSub.includes('buttplug') || itemSub.includes('dildo'))) { return false; }

            if (futureBlockedIds.includes(i.id)) return false;

            const itemPeriod = i.suitablePeriod || 'Beide';
            if (isNightInstruction) {
                if (itemPeriod === 'Tag') return false;
            } else {
                if (itemPeriod === 'Nacht') return false;
            }

            return true;
        });

        // 4. SMART HYBRID SELECTOR
        const groups = {};
        availableItems.forEach(item => {
            const key = item.subCategory || item.mainCategory || 'Sonstiges';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        let availableGroupKeys = Object.keys(groups);

        let targetItemCount = 1;
        const rndCount = Math.random();

        if (isNightInstruction) {
            if (rndCount < 0.45) {
                targetItemCount = 3;
            } else if (rndCount < 0.90) { 
                targetItemCount = 2;
            } else {
                targetItemCount = 1;
            }
        } else {
            if (maxItems === 1) {
                targetItemCount = 1;
            } else if (maxItems === 2) {
                if (rndCount < 0.75) {
                    targetItemCount = 2;
                } else {
                    targetItemCount = 1;
                }
            } else if (maxItems >= 3) { 
                if (rndCount < 0.55) {
                    targetItemCount = 3;
                } else if (rndCount < 0.95) { 
                    targetItemCount = 2;
                } else {
                    targetItemCount = 1;
                }
            }
        }

        const slotsToFill = targetItemCount - selectedItems.length;

        if (slotsToFill > 0) {
            for (let k = 0; k < slotsToFill; k++) {
                if (availableGroupKeys.length === 0) break;

                // --- ANATOMIE & ABHÄNGIGKEITS-PROTOKOLL ---
                const checkNylon = (i) => i.mainCategory === 'Nylons' || (i.mainCategory || '').toLowerCase() === 'nylon';
                
                let currentNylonsCount = selectedItems.filter(checkNylon).length;
                let hasHalterlose = selectedItems.some(i => (i.subCategory || '').includes('Halterlose'));
                let hasStraps = selectedItems.some(i => (i.subCategory || '').includes('Strapsstrümpfe'));
                let hasNylons = currentNylonsCount > 0;
                let hasHighHeels = selectedItems.some(i => (i.subCategory || '').includes('High Heels'));
                let slotsLeft = slotsToFill - k;

                let validGroupKeys = availableGroupKeys.filter(key => {
                    const sampleItem = groups[key][0];
                    const isNylonGroup = checkNylon(sampleItem);
                    const isHalterloseGroup = key.includes('Halterlose');
                    const isStrapsGroup = key.includes('Strapsstrümpfe');
                    const isHighHeelsGroup = key.includes('High Heels');

                    // Regel 1: Beine-Exklusivität
                    if (isHalterloseGroup && hasStraps) return false;
                    if (isStrapsGroup && hasHalterlose) return false;

                    // Regel 2: Maximal 2 Nylons
                    if (isNylonGroup && currentNylonsCount >= 2) return false;

                    // Regel 3: High Heels fordern Nylons
                    if (isHighHeelsGroup) {
                        if (!hasNylons) {
                            const nylonAvailable = availableGroupKeys.some(k => checkNylon(groups[k][0]) && !k.includes('High Heels'));
                            if (slotsLeft <= 1 || !nylonAvailable) return false;
                        }
                    }

                    // Zwangskorrektur: Nylon erzwingen, wenn Heels gezogen wurden, aber Nylons fehlen
                    if (hasHighHeels && !hasNylons && slotsLeft === 1) {
                        if (!isNylonGroup) return false;
                    }

                    return true;
                });

                if (validGroupKeys.length === 0) break; 
                // --- ENDE PROTOKOLL ---

                let totalWeight = 0;
                const weightedGroups = validGroupKeys.map(key => {
                    const count = groups[key].length;
                    const rootScore = Math.sqrt(count);
                    const manualWeight = parseInt(userWeights[key] || 1);

                    const finalScore = rootScore * manualWeight;
                    totalWeight += finalScore;

                    return { key, score: finalScore };
                });

                let randomValue = Math.random() * totalWeight;
                let chosenCategoryKey = null;

                for (const group of weightedGroups) {
                    randomValue -= group.score;
                    if (randomValue <= 0) {
                        chosenCategoryKey = group.key;
                        break;
                    }
                }
                if (!chosenCategoryKey && weightedGroups.length > 0) {
                    chosenCategoryKey = weightedGroups[weightedGroups.length - 1].key;
                }

                const itemsInGroup = groups[chosenCategoryKey];
                
                let groupTotalItemWeight = 0;
                const weightedItemsInGroup = itemsInGroup.map(item => {
                    let itemWeight = 1; 
                    
                    const isNylon = item.mainCategory === 'Nylons' || 
                                    (item.subCategory || '').toLowerCase().includes('strumpfhose') || 
                                    (item.subCategory || '').toLowerCase().includes('stockings') ||
                                    (item.subCategory || '').toLowerCase().includes('tights');
                    
                    if (isNylon) {
                        let lastWornDate = item.lastWorn && item.lastWorn.toDate ? item.lastWorn.toDate() : (item.lastWorn ? new Date(item.lastWorn) : null);
                        if (recentSessionsMap[item.id] && (!lastWornDate || recentSessionsMap[item.id] > lastWornDate)) {
                            lastWornDate = recentSessionsMap[item.id];
                        }

                        if (!item.wearCount || item.wearCount === 0 || !lastWornDate) {
                            itemWeight = 10;
                        } else {
                            const daysSince = Math.max(0, Math.floor((Date.now() - lastWornDate.getTime()) / (1000 * 60 * 60 * 24)));
                            itemWeight = 1 + (daysSince * 0.05); 
                        }
                    }
                    
                    groupTotalItemWeight += itemWeight;
                    return { item, weight: itemWeight };
                });

                let randomItemValue = Math.random() * groupTotalItemWeight;
                let selectedItem = null;

                for (const wi of weightedItemsInGroup) {
                    randomItemValue -= wi.weight;
                    if (randomItemValue <= 0) {
                        selectedItem = wi.item;
                        break;
                    }
                }
                if (!selectedItem && weightedItemsInGroup.length > 0) {
                    selectedItem = weightedItemsInGroup[weightedItemsInGroup.length - 1].item;
                }

                selectedItems.push(selectedItem);
                
                availableGroupKeys = availableGroupKeys.filter(key => key !== chosenCategoryKey);
            }
        }

        if (selectedItems.length === 0) return null;

        // --- SEAMLESS TRANSIT PROTOCOL (30 MIN GRACE) ---
        let transitProtocol = { active: false };
        if (!isNightInstruction && !isStealth) {
            const hasAnyLingerie = selectedItems.some(i =>
                (i.subCategory || '').toLowerCase().includes('höschen') ||
                (i.mainCategory || '').toLowerCase().includes('lingerie') ||
                (i.mainCategory || '').toLowerCase().includes('dessous')
            );

            if (hasAnyLingerie) {
                const qNight = query(collection(db, `users/${uid}/sessions`), where('type', '==', 'instruction'));
                const snapNight = await getDocs(qNight);
                const nightSessions = [];
                snapNight.forEach(d => {
                    const data = d.data();
                    if (data.periodId && data.periodId.includes('night')) {
                        nightSessions.push({ id: d.id, ...data, startTime: data.startTime?.toDate() || new Date(0), endTime: data.endTime?.toDate() || null });
                    }
                });
                nightSessions.sort((a, b) => b.startTime - a.startTime);
                const lastNightSession = nightSessions.length > 0 ? nightSessions[0] : null;

                if (lastNightSession && (new Date() - lastNightSession.startTime) < 24 * 60 * 60 * 1000) {
                    const nightIds = lastNightSession.itemIds || (lastNightSession.itemId ? [lastNightSession.itemId] : []);
                    
                    const nightLingerie = items.find(i => nightIds.includes(i.id) && (
                        (i.subCategory || '').toLowerCase().includes('höschen') ||
                        (i.mainCategory || '').toLowerCase().includes('lingerie') ||
                        (i.mainCategory || '').toLowerCase().includes('dessous')
                    ));

                    if (nightLingerie) {
                        const targetSubCategory = (nightLingerie.subCategory || '').toLowerCase();
                        
                        const selectedLingerieIdx = selectedItems.findIndex(i =>
                            (i.subCategory || '').toLowerCase() === targetSubCategory
                        );

                        if (selectedLingerieIdx !== -1) {
                            const penaltyItem = selectedItems[selectedLingerieIdx];
                            if (nightLingerie.id !== penaltyItem.id) {
                                selectedItems[selectedLingerieIdx] = nightLingerie;
                                transitProtocol = {
                                    active: true,
                                    primaryItemId: nightLingerie.id,
                                    nightSessionId: lastNightSession.id,
                                    nightSessionEndTime: lastNightSession.endTime ? lastNightSession.endTime.toISOString() : null,
                                    backupItem: {
                                        id: penaltyItem.id,
                                        name: penaltyItem.name || penaltyItem.subCategory || 'Ersatz-Item',
                                        img: penaltyItem.imageUrl || (penaltyItem.images && penaltyItem.images[0]) || null,
                                        subCategory: penaltyItem.subCategory || ''
                                    }
                                };
                            }
                        }
                    }
                }
            }
        }

        // --- LAYERING & SORTIERUNGS-PROTOKOLL ---
        // Zuweisung einer Chaos-Variable für die Konfliktzone
        let layerSortedItems = selectedItems.map(item => ({ ...item, _sortVal: Math.random() * 10 }));

        const getItemSub = (i) => (i.subCategory || '').toLowerCase();
        
        const bodyItem = layerSortedItems.find(i => getItemSub(i).includes('body'));
        const strumpfhoseItem = layerSortedItems.find(i => getItemSub(i).includes('strumpfhose'));
        const bhItem = layerSortedItems.find(i => getItemSub(i).includes('bh') || (i.name || '').toLowerCase().includes('bh'));
        
        const strapsItem = layerSortedItems.find(i => getItemSub(i).includes('strapsstrümpfe'));
        const satinItem = layerSortedItems.find(i => getItemSub(i).includes('satin-hemdchen') || getItemSub(i).includes('satin-nachthemd'));
        const heelsItem = layerSortedItems.find(i => getItemSub(i).includes('high heels'));

        // Regel 1: Strapsgürtel über Torso/Haut
        if (strapsItem) {
            let maxBase = -1;
            if (bodyItem) maxBase = Math.max(maxBase, bodyItem._sortVal);
            if (strumpfhoseItem) maxBase = Math.max(maxBase, strumpfhoseItem._sortVal);
            if (strapsItem._sortVal <= maxBase) {
                strapsItem._sortVal = maxBase + 1;
            }
        }

        // Regel 2: Satin über Torso/Brust
        if (satinItem) {
            let maxTop = -1;
            if (bodyItem) maxTop = Math.max(maxTop, bodyItem._sortVal);
            if (bhItem) maxTop = Math.max(maxTop, bhItem._sortVal);
            if (satinItem._sortVal <= maxTop) {
                satinItem._sortVal = maxTop + 1;
            }
        }

        // Regel 3: Heels ans Ende
        if (heelsItem) {
            heelsItem._sortVal = 999;
        }

        // Regel 4: Transit-Item an den Anfang (Muss als erstes angezogen bzw. bestätigt werden)
        if (transitProtocol.active && transitProtocol.primaryItemId) {
            const transitItem = layerSortedItems.find(i => i.id === transitProtocol.primaryItemId);
            if (transitItem) {
                transitItem._sortVal = -999; 
            }
        }

        layerSortedItems.sort((a, b) => a._sortVal - b._sortVal);
        // --- ENDE LAYERING ---

        let forcedRelease = { required: false, executed: false, method: null };

        if (isNightInstruction) {
            const triggerChance = protocolSettings.instruction?.forcedReleaseTriggerChance ?? 0.15;
            if (Math.random() < triggerChance) {
                forcedRelease.required = true;
                const methods = protocolSettings.instruction?.forcedReleaseMethods ?? {
                    hand: 0.34, toy_vaginal: 0.33, toy_anal: 0.33
                };

                const rnd = Math.random();
                const handProb = methods.hand || 0;
                const vagProb = methods.toy_vaginal || 0;

                if (rnd < handProb) {
                    forcedRelease.method = 'hand';
                } else if (rnd < (handProb + vagProb)) {
                    forcedRelease.method = 'toy_vaginal';
                } else {
                    forcedRelease.method = 'toy_anal';
                }
            }
        }

        const titleNames = layerSortedItems.map(i => i.subCategory || i.name || 'Item').join(' & ');

        const instructionData = {
            periodId,
            generatedAt: serverTimestamp(),
            isAccepted: false,
            isPlanned: isPlannedInstruction,
            itemName: titleNames,
            durationMinutes, 
            stealthModeActive: isStealth, 
            forcedRelease,
            transitProtocol,
            items: layerSortedItems.map((i, index) => ({
                id: i.id,
                name: i.subCategory || i.name || 'Unbenanntes Item',
                brand: i.brand || '',
                img: i.imageUrl || (i.images && i.images[0]) || null,
                subCategory: i.subCategory || '',
                orderIndex: index + 1 // Nummerierte Reihenfolge
            }))
        };

        await setDoc(doc(db, `users/${uid}/status/dailyInstruction`), instructionData);
        return instructionData;

    } catch (e) {
        console.error("FATAL ERROR in generateAndSaveInstruction:", e);
        return null;
    }
};

export const generateDailyInstruction = generateAndSaveInstruction;
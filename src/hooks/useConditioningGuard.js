import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export function useConditioningGuard() {
    const { currentUser } = useAuth();
    const [showOverlay, setShowOverlay] = useState(false);
    const [loadingGuard, setLoadingGuard] = useState(true);
    const [currentPhase, setCurrentPhase] = useState('');

    const calculatePhase = () => {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const timeVal = hours + minutes / 60;
        
        let phaseType = '';
        let referenceDate = new Date(now);

        // Tag: 07:30 (7.5) bis 22:59 (22.99)
        if (timeVal >= 7.5 && timeVal < 23) {
            phaseType = 'day';
        } else {
            // Nacht: 23:00 bis 07:29
            phaseType = 'night';
            // Wenn es nach Mitternacht, aber VOR 07:30 ist, gehört die Nacht logisch zum Vortag.
            if (timeVal < 7.5) {
                referenceDate.setDate(referenceDate.getDate() - 1);
            }
        }
        
        const yyyy = referenceDate.getFullYear();
        const mm = String(referenceDate.getMonth() + 1).padStart(2, '0');
        const dd = String(referenceDate.getDate()).padStart(2, '0');
        
        return `${phaseType}_${yyyy}-${mm}-${dd}`;
    };

    const checkPhase = useCallback(async () => {
        if (!currentUser) return;
        try {
            const phase = calculatePhase();
            setCurrentPhase(phase);

            const docRef = doc(db, `users/${currentUser.uid}/status/conditioning`);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.lastAcknowledgedPhase !== phase) {
                    setShowOverlay(true);
                } else {
                    setShowOverlay(false);
                }
            } else {
                // Dokument existiert noch nicht (erster Aufruf überhaupt) -> Overlay zeigen
                setShowOverlay(true);
            }
        } catch (error) {
            console.error("Fehler beim Prüfen der Conditioning-Phase:", error);
        } finally {
            setLoadingGuard(false);
        }
    }, [currentUser]);

    useEffect(() => {
        checkPhase();

        // Überwache zusätzlich, ob der User die App aus dem Hintergrund zurückholt
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkPhase();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, [checkPhase]);

    const acknowledgePhase = async () => {
        if (!currentUser || !currentPhase) return;
        try {
            const docRef = doc(db, `users/${currentUser.uid}/status/conditioning`);
            // SetDoc mit merge überschreibt nur das angegebene Feld, ohne andere zu löschen
            await setDoc(docRef, { lastAcknowledgedPhase: currentPhase }, { merge: true });
            setShowOverlay(false);
        } catch (error) {
            console.error("Fehler beim Bestätigen der Conditioning-Phase:", error);
        }
    };

    return { showOverlay, loadingGuard, acknowledgePhase };
}
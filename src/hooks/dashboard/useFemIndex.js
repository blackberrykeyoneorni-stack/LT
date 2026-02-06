import { useState, useEffect } from 'react';

// Die 5 Phasen der Transformation
const PHASES = [
    { name: "TOURIST", limit: 20, color: "#1a1a1a", desc: "Besucher. Keine Bindung." },
    { name: "NOVICE", limit: 40, color: "#4a148c", desc: "Erste Anpassung." },
    { name: "RESIDENT", limit: 60, color: "#7b1fa2", desc: "Teil des Systems." },
    { name: "DEDICATED", limit: 80, color: "#c2185b", desc: "Aktive Unterwerfung." },
    { name: "PROPERTY", limit: 100, color: "#f50057", desc: "Vollständiger Besitz." }
];

const getPhase = (score) => {
    // Finde die passende Phase basierend auf dem Score
    return PHASES.find(p => score <= p.limit) || PHASES[PHASES.length - 1];
};

export const useFemIndex = (kpis) => {
    const [indexData, setIndexData] = useState({ 
        score: 0, 
        phase: PHASES[0], 
        subScores: { physis: 0, psyche: 0, infiltration: 0 },
        trend: 'neutral'
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Wir verlassen uns auf die Berechnung in useKPIs
        if (kpis && kpis.femIndex) {
            const currentScore = kpis.femIndex.score || 0;
            const subScores = kpis.femIndex.subScores || { physis: 0, psyche: 0, infiltration: 0 };
            const phase = getPhase(currentScore);

            setIndexData({
                score: currentScore,
                phase: phase,
                subScores: subScores,
                trend: kpis.femIndex.trend || 'neutral'
            });
            setLoading(false);
        }
    }, [kpis]); // Reagiert auf Updates von useKPIs

    // Für den Detail-Dialog (falls benötigt)
    const indexDetails = {
        score: indexData.score,
        phaseName: indexData.phase.name,
        phaseDesc: indexData.phase.desc,
        color: indexData.phase.color,
        subScores: indexData.subScores
    };

    return { 
        femIndex: indexData.score, 
        phase: indexData.phase,
        subScores: indexData.subScores,
        indexDetails,
        femIndexLoading: loading 
    };
};

export default useFemIndex;
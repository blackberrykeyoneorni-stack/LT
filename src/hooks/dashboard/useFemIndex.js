import { useEffect, useState } from 'react';
import useKPIs from '../useKPIs';
import { useItems } from '../../contexts/ItemContext';
import { useAuth } from '../../contexts/AuthContext';

/**
 * useFemIndex Hook
 * Verbindet UI mit der zentralen KPI Logik.
 * Transformiert die Rohdaten in ein Format für die FemIndexBar.
 */
export const useFemIndex = (preloadedKpis = null) => {
    const { items } = useItems();
    const { currentUser } = useAuth();
    
    // Nutze useKPIs für die Berechnung, falls nicht vorab geladen
    const internalKpis = useKPIs(items);
    
    const sourceData = preloadedKpis || internalKpis;
    const { femIndex, loading } = sourceData;

    const [formattedData, setFormattedData] = useState({
        femIndex: 0,
        details: {
            score: 0,
            trend: 'stable',
            components: []
        },
        loading: true
    });

    useEffect(() => {
        if (loading || !femIndex) return;

        // Extrahiere Daten aus useKPIs Output
        const score = femIndex.score || 0;
        const trend = femIndex.trend || 'stable';
        const subScores = femIndex.subScores || { physis: 0, psyche: 0, infiltration: 0 };

        setFormattedData({
            femIndex: score,
            details: {
                score: score,
                trend: trend,
                components: [
                    { 
                        label: 'Physis (Körperliche Gewöhnung)', 
                        value: subScores.physis, 
                        type: 'neutral',
                        description: 'Tragezeit & Nylon-Anteil'
                    },
                    { 
                        label: 'Psyche (Mentaler Widerstand)', 
                        value: subScores.psyche, 
                        type: 'neutral',
                        description: 'Freiwilligkeit & Compliance'
                    },
                    { 
                        label: 'Infiltration (Alltags-Übernahme)', 
                        value: subScores.infiltration, 
                        type: 'neutral',
                        description: 'Nacht-Tragen & Coverage'
                    }
                ]
            },
            loading: false
        });

    }, [femIndex, loading]);

    return formattedData;
};

export default useFemIndex;
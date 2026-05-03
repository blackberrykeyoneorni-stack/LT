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
            phaseName: 'Männliche Verleugnung',
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

        // Bestimme die Transformations-Phase basierend auf dem neuen Fem-Index Score
        let phaseName = 'Männliche Verleugnung';
        if (score > 25 && score <= 50) phaseName = 'Erwachende Anmut';
        else if (score > 50 && score <= 85) phaseName = 'Bedingungslose Akzeptanz';
        else if (score > 85) phaseName = 'Weibliche Vollendung';

        setFormattedData({
            femIndex: score,
            details: {
                score: score,
                trend: trend,
                phaseName: phaseName,
                components: [
                    { 
                        label: 'Ästhetische Präsenz', 
                        value: subScores.physis, 
                        type: 'neutral',
                        description: 'Maß der ständigen Nylon-Umschließung'
                    },
                    { 
                        label: 'Bedingungslose Hingabe', 
                        value: subScores.psyche, 
                        type: 'neutral',
                        description: 'Zögerungsfreier Gehorsam und freiwillige Pflicht'
                    },
                    { 
                        label: 'Absolute Assimilation', 
                        value: subScores.infiltration, 
                        type: 'neutral',
                        description: 'Tiefgreifende Gewöhnung während der Nachtruhe'
                    }
                ]
            },
            loading: false
        });

    }, [femIndex, loading]);

    return formattedData;
};

export default useFemIndex;
import { useEffect, useState } from 'react';
import useKPIs from '../useKPIs';
import { useItems } from '../../contexts/ItemContext';
import { useAuth } from '../../contexts/AuthContext';

/**
 * useFemIndex Hook
 * * Stellt die Verbindung zur zentralen KPI-Berechnung her, anstatt
 * auf statische/falsche Daten zuzugreifen.
 * Berechnet den Index dynamisch basierend auf:
 * - Physis (Tragezeit, Gewöhnung)
 * - Psyche (Willigkeit, Compliance)
 * - Infiltration (Nacht-Tragen, Abdeckung)
 */
export const useFemIndex = (preloadedKpis = null) => {
    const { items } = useItems();
    const { currentUser } = useAuth();
    
    // Wir nutzen useKPIs, um die Berechnung durchzuführen.
    // Falls KPIs von außen kommen (Optimierung), nutzen wir diese.
    const internalKpis = useKPIs(items);
    
    const sourceData = preloadedKpis || internalKpis;
    const { femIndex, loading } = sourceData;

    const [formattedData, setFormattedData] = useState({
        femIndex: 0,
        details: {
            score: 0,
            components: []
        },
        loading: true
    });

    useEffect(() => {
        if (loading || !femIndex) return;

        // Extrahiere die echten berechneten Werte aus useKPIs
        const score = femIndex.score || 0;
        const subScores = femIndex.subScores || { physis: 0, psyche: 0, infiltration: 0 };

        setFormattedData({
            femIndex: score,
            details: {
                score: score,
                // Wir mappen die internen Sub-Scores auf das Anzeige-Format für das Overlay
                components: [
                    { 
                        label: 'Physis (Körperliche Gewöhnung)', 
                        value: subScores.physis, 
                        type: 'neutral',
                        description: 'Basierend auf Tragezeit & Nylon-Anteil'
                    },
                    { 
                        label: 'Psyche (Mentaler Widerstand)', 
                        value: subScores.psyche, 
                        type: 'neutral',
                        description: 'Basierend auf Freiwilligkeit & Compliance'
                    },
                    { 
                        label: 'Infiltration (Alltags-Übernahme)', 
                        value: subScores.infiltration, 
                        type: 'neutral',
                        description: 'Basierend auf Nacht-Tragen & 24/7 Coverage'
                    }
                ]
            },
            loading: false
        });

    }, [femIndex, loading]);

    return formattedData;
};

// Default Export für Kompatibilität mit Dashboard.jsx
export default useFemIndex;
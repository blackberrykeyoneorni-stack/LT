import React, { useState, useEffect } from 'react';
import { Box, Typography, Slider, Switch, FormControlLabel, Paper, Button, Grid, Divider } from '@mui/material';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { DEFAULT_PROTOCOL_RULES } from '../../config/defaultRules';
import SaveIcon from '@mui/icons-material/Save';
import RestoreIcon from '@mui/icons-material/Restore';
import { PALETTE } from '../../theme/obsidianDesign';

export default function ProtocolSettings() {
    const { currentUser } = useAuth();
    const [rules, setRules] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (!currentUser) return;
        const load = async () => {
            const ref = doc(db, `users/${currentUser.uid}/settings/protocol`);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                setRules(snap.data()); // Wir laden direkt das, was da ist
            } else {
                setRules(DEFAULT_PROTOCOL_RULES);
            }
        };
        load();
    }, [currentUser]);

    const handleChange = (section, key, value) => {
        setRules(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: value
            }
        }));
        setHasChanges(true);
    };

    // Spezieller Handler für die TZD Matrix Gewichte
    const handleMatrixChange = (index, newWeight) => {
        const newMatrix = [...rules.tzd.durationMatrix];
        newMatrix[index].weight = newWeight;
        handleChange('tzd', 'durationMatrix', newMatrix);
    };

    const handleSave = async () => {
        try {
            await updateDoc(doc(db, `users/${currentUser.uid}/settings/protocol`), rules);
            setHasChanges(false);
            alert("Protokoll-Regeln aktualisiert.");
        } catch (e) {
            console.error(e);
            alert("Fehler beim Speichern.");
        }
    };

    const handleReset = () => {
        if(window.confirm("Alle Regeln auf Standard zurücksetzen?")) {
            setRules(DEFAULT_PROTOCOL_RULES);
            setHasChanges(true);
        }
    };

    if (!rules) return <Typography>Lade Konfiguration...</Typography>;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            
            {/* TZD SEKTION */}
            <Paper sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.05)', borderLeft: `4px solid ${PALETTE.accents.red}` }}>
                <Typography variant="h6" color="primary" gutterBottom>Zeitloses Diktat (TZD)</Typography>
                
                {/* Trigger */}
                <Box sx={{ px: 2, mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Trigger Wahrscheinlichkeit</Typography>
                        <Typography color="primary" fontWeight="bold">{(rules.tzd.triggerChance * 100).toFixed(1)}%</Typography>
                    </Box>
                    <Slider 
                        value={rules.tzd.triggerChance} min={0} max={0.5} step={0.01}
                        onChange={(_, v) => handleChange('tzd', 'triggerChance', v)}
                    />
                </Box>

                {/* Matrix Visualisierung */}
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, color: 'text.secondary' }}>Dauer-Matrix (Wahrscheinlichkeiten)</Typography>
                {rules.tzd.durationMatrix.map((zone, idx) => (
                    <Box key={zone.id} sx={{ mb: 2, px: 2, borderLeft: '2px solid #555', pl: 2 }}>
                        <Grid container justifyContent="space-between">
                            <Grid item><Typography variant="body2" fontWeight="bold">{zone.label}</Typography></Grid>
                            <Grid item><Typography variant="caption">{zone.minHours}-{zone.maxHours} Std</Typography></Grid>
                        </Grid>
                        <Slider 
                            value={zone.weight} min={0} max={1} step={0.05}
                            onChange={(_, v) => handleMatrixChange(idx, v)}
                            valueLabelDisplay="auto"
                            valueLabelFormat={v => `${(v*100).toFixed(0)}%`}
                            sx={{ color: idx === 2 ? PALETTE.accents.red : (idx === 1 ? PALETTE.primary.main : PALETTE.accents.green) }}
                        />
                    </Box>
                ))}
            </Paper>

            {/* INSTRUCTION (HIDDEN LOGIC) */}
            <Paper sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.05)', borderLeft: `4px solid ${PALETTE.accents.purple}` }}>
                <Typography variant="h6" sx={{ color: PALETTE.accents.purple }} gutterBottom>Forced Release (Algorithmus)</Typography>
                <Typography variant="caption" sx={{ display: 'block', mb: 2, color: 'text.secondary' }}>
                    Steuert die versteckten Wahrscheinlichkeiten für erzwungene Höhepunkte (ignoriert User-Präferenzen).
                </Typography>
                
                <Box sx={{ px: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography>Trigger Chance (Nachts)</Typography>
                        <Typography sx={{ color: PALETTE.accents.purple }} fontWeight="bold">{(rules.instruction.forcedReleaseTriggerChance * 100).toFixed(0)}%</Typography>
                    </Box>
                    <Slider 
                        value={rules.instruction.forcedReleaseTriggerChance} 
                        min={0} max={1} step={0.01}
                        onChange={(_, v) => handleChange('instruction', 'forcedReleaseTriggerChance', v)}
                        sx={{ color: PALETTE.accents.purple }}
                    />
                </Box>
            </Paper>

            {/* TIME */}
            <Paper sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.05)', borderLeft: `4px solid ${PALETTE.accents.blue}` }}>
                <Typography variant="h6" sx={{ color: PALETTE.accents.blue }} gutterBottom>Zeit-Definitionen</Typography>
                <Box sx={{ px: 2, display: 'flex', gap: 4 }}>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="caption">Start Tag</Typography>
                        <Slider 
                            value={rules.time.dayStartHour} min={4} max={10} step={1}
                            onChange={(_, v) => handleChange('time', 'dayStartHour', v)}
                            marks valueLabelDisplay="auto"
                        />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="caption">Start Nacht</Typography>
                        <Slider 
                            value={rules.time.nightStartHour} min={18} max={24} step={1}
                            onChange={(_, v) => handleChange('time', 'nightStartHour', v)}
                            marks valueLabelDisplay="auto"
                        />
                    </Box>
                </Box>
            </Paper>

            {/* ACTIONS */}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2, pb: 4 }}>
                <Button startIcon={<RestoreIcon />} color="error" onClick={handleReset}>Reset</Button>
                <Button variant="contained" startIcon={<SaveIcon />} disabled={!hasChanges} onClick={handleSave} sx={DESIGN_TOKENS.buttonGradient}>
                    Speichern
                </Button>
            </Box>
        </Box>
    );
}
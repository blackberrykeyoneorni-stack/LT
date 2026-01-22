import React, { useState, useEffect } from 'react';
import { Box, Typography, Slider, Switch, FormControlLabel, Paper, Button, Grid, Divider } from '@mui/material';
import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { DEFAULT_PROTOCOL_RULES } from '../../config/defaultRules';
import SaveIcon from '@mui/icons-material/Save';
import RestoreIcon from '@mui/icons-material/Restore';
import { PALETTE, DESIGN_TOKENS } from '../../theme/obsidianDesign';

export default function ProtocolSettings() {
    const { currentUser } = useAuth();
    const [rules, setRules] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (!currentUser) return;
        const load = async () => {
            try {
                const ref = doc(db, `users/${currentUser.uid}/settings/protocol`);
                const snap = await getDoc(ref);
                
                // DEEP MERGE STRATEGIE:
                // 1. Nehme immer erst die kompletten Defaults als Basis (Sicherheit!)
                // 2. Überschreibe mit Datenbank-Werten, wo vorhanden.
                let mergedRules = JSON.parse(JSON.stringify(DEFAULT_PROTOCOL_RULES));
                
                // Basis-Ziel Default setzen
                mergedRules.currentDailyGoal = 4; 

                if (snap.exists()) {
                    const data = snap.data();
                    
                    // Root Properties mergen
                    if (data.currentDailyGoal !== undefined) mergedRules.currentDailyGoal = data.currentDailyGoal;

                    // Nested Objects mergen (Sicherstellen, dass TZD, Time, Instruction existieren)
                    mergedRules.time = { ...mergedRules.time, ...(data.time || {}) };
                    mergedRules.tzd = { 
                        ...mergedRules.tzd, 
                        ...(data.tzd || {}),
                        // Matrix speziell behandeln (Array) - Datenbank gewinnt, sonst Default
                        durationMatrix: (data.tzd && data.tzd.durationMatrix) ? data.tzd.durationMatrix : mergedRules.tzd.durationMatrix
                    };
                    mergedRules.purity = { ...mergedRules.purity, ...(data.purity || {}) };
                    mergedRules.instruction = { ...mergedRules.instruction, ...(data.instruction || {}) };
                    mergedRules.punishment = { ...mergedRules.punishment, ...(data.punishment || {}) };
                }

                setRules(mergedRules);
            } catch (e) {
                console.error("Fehler beim Laden der Protocol Settings:", e);
                // Fallback im Fehlerfall: Defaults laden, damit App nicht crasht
                setRules({ ...DEFAULT_PROTOCOL_RULES, currentDailyGoal: 4 });
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

    // Handler für Root-Level Properties (wie currentDailyGoal)
    const handleRootChange = (key, value) => {
        setRules(prev => ({
            ...prev,
            [key]: value
        }));
        setHasChanges(true);
    };

    // Spezieller Handler für die TZD Matrix Gewichte
    const handleMatrixChange = (index, newWeight) => {
        // Sicherheits-Check
        if (!rules.tzd || !rules.tzd.durationMatrix) return;

        const newMatrix = [...rules.tzd.durationMatrix];
        newMatrix[index].weight = newWeight;
        handleChange('tzd', 'durationMatrix', newMatrix);
    };

    const handleSave = async () => {
        try {
            const payload = {
                ...rules,
                lastGoalUpdate: serverTimestamp() 
            };
            
            await updateDoc(doc(db, `users/${currentUser.uid}/settings/protocol`), payload);
            setHasChanges(false);
            alert("Protokoll-Regeln aktualisiert.");
        } catch (e) {
            console.error(e);
            alert("Fehler beim Speichern.");
        }
    };

    const handleReset = () => {
        if(window.confirm("Alle Regeln auf Standard zurücksetzen?")) {
            setRules({ ...DEFAULT_PROTOCOL_RULES, currentDailyGoal: 4 });
            setHasChanges(true);
        }
    };

    if (!rules) return <Typography sx={{p:3}}>Lade Konfiguration...</Typography>;

    // AB HIER: SICHERER ZUGRIFF MIT OPTIONAL CHAINING (?.)
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            
            {/* BASIS-TRAGEZEIT EINSTELLUNG */}
            <Paper sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.05)', borderLeft: `4px solid ${PALETTE.accents.green}` }}>
                <Typography variant="h6" sx={{ color: PALETTE.accents.green }} gutterBottom>Tragezeit-Ziel (Basis)</Typography>
                <Typography variant="caption" sx={{ display: 'block', mb: 2, color: 'text.secondary' }}>
                    Definiert die geforderte Tragezeit, bis der Algorithmus (Ratchet) übernimmt.
                </Typography>
                
                <Box sx={{ px: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Tägliches Ziel</Typography>
                        <Typography sx={{ color: PALETTE.accents.green }} fontWeight="bold">
                            {rules.currentDailyGoal ? rules.currentDailyGoal.toFixed(1) : '4.0'} Stunden
                        </Typography>
                    </Box>
                    <Slider 
                        value={rules.currentDailyGoal || 4} 
                        min={1} max={12} step={0.5}
                        onChange={(_, v) => handleRootChange('currentDailyGoal', v)}
                        sx={{ color: PALETTE.accents.green }}
                        marks={[
                            { value: 4, label: '4h' },
                            { value: 8, label: '8h' },
                            { value: 12, label: '12h' }
                        ]}
                    />
                </Box>
            </Paper>

            {/* TZD SEKTION - SICHERER ZUGRIFF */}
            <Paper sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.05)', borderLeft: `4px solid ${PALETTE.accents.red}` }}>
                <Typography variant="h6" color="primary" gutterBottom>Zeitloses Diktat (TZD)</Typography>
                
                {/* Trigger */}
                <Box sx={{ px: 2, mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Trigger Wahrscheinlichkeit</Typography>
                        <Typography color="primary" fontWeight="bold">
                            {/* Sicherer Zugriff auf tzd.triggerChance */}
                            {rules.tzd?.triggerChance ? (rules.tzd.triggerChance * 100).toFixed(1) : '0.0'}%
                        </Typography>
                    </Box>
                    <Slider 
                        value={rules.tzd?.triggerChance || 0.08} 
                        min={0} max={0.5} step={0.01}
                        onChange={(_, v) => handleChange('tzd', 'triggerChance', v)}
                    />
                </Box>

                {/* Matrix Visualisierung */}
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, color: 'text.secondary' }}>Dauer-Matrix (Wahrscheinlichkeiten)</Typography>
                {rules.tzd?.durationMatrix?.map((zone, idx) => (
                    <Box key={zone.id || idx} sx={{ mb: 2, px: 2, borderLeft: '2px solid #555', pl: 2 }}>
                        <Grid container justifyContent="space-between">
                            <Grid item><Typography variant="body2" fontWeight="bold">{zone.label}</Typography></Grid>
                            <Grid item><Typography variant="caption">{zone.minHours}-{zone.maxHours} Std</Typography></Grid>
                        </Grid>
                        <Slider 
                            value={zone.weight || 0} min={0} max={1} step={0.05}
                            onChange={(_, v) => handleMatrixChange(idx, v)}
                            valueLabelDisplay="auto"
                            valueLabelFormat={v => `${(v*100).toFixed(0)}%`}
                            sx={{ color: idx === 2 ? PALETTE.accents.red : (idx === 1 ? PALETTE.primary.main : PALETTE.accents.green) }}
                        />
                    </Box>
                ))}
            </Paper>

            {/* INSTRUCTION (HIDDEN LOGIC) - SICHERER ZUGRIFF */}
            <Paper sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.05)', borderLeft: `4px solid ${PALETTE.accents.purple}` }}>
                <Typography variant="h6" sx={{ color: PALETTE.accents.purple }} gutterBottom>Forced Release (Algorithmus)</Typography>
                <Typography variant="caption" sx={{ display: 'block', mb: 2, color: 'text.secondary' }}>
                    Steuert die versteckten Wahrscheinlichkeiten für erzwungene Höhepunkte (ignoriert User-Präferenzen).
                </Typography>
                
                <Box sx={{ px: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography>Trigger Chance (Nachts)</Typography>
                        <Typography sx={{ color: PALETTE.accents.purple }} fontWeight="bold">
                            {rules.instruction?.forcedReleaseTriggerChance ? (rules.instruction.forcedReleaseTriggerChance * 100).toFixed(0) : '0'}%
                        </Typography>
                    </Box>
                    <Slider 
                        value={rules.instruction?.forcedReleaseTriggerChance || 0.15} 
                        min={0} max={1} step={0.01}
                        onChange={(_, v) => handleChange('instruction', 'forcedReleaseTriggerChance', v)}
                        sx={{ color: PALETTE.accents.purple }}
                    />
                </Box>
            </Paper>

            {/* TIME - SICHERER ZUGRIFF */}
            <Paper sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.05)', borderLeft: `4px solid ${PALETTE.accents.blue}` }}>
                <Typography variant="h6" sx={{ color: PALETTE.accents.blue }} gutterBottom>Zeit-Definitionen</Typography>
                <Box sx={{ px: 2, display: 'flex', gap: 4 }}>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="caption">Start Tag</Typography>
                        <Slider 
                            value={rules.time?.dayStartHour || 7} min={4} max={10} step={1}
                            onChange={(_, v) => handleChange('time', 'dayStartHour', v)}
                            marks valueLabelDisplay="auto"
                        />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="caption">Start Nacht</Typography>
                        <Slider 
                            value={rules.time?.nightStartHour || 23} min={18} max={24} step={1}
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
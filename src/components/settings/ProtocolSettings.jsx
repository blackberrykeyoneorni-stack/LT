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
                
                // DEEP MERGE STRATEGIE (ROBUSTHEIT)
                let mergedRules = JSON.parse(JSON.stringify(DEFAULT_PROTOCOL_RULES));
                mergedRules.currentDailyGoal = 4; 

                if (snap.exists()) {
                    const data = snap.data();
                    
                    if (data.currentDailyGoal !== undefined) mergedRules.currentDailyGoal = data.currentDailyGoal;

                    mergedRules.tzd = { 
                        ...mergedRules.tzd, 
                        ...(data.tzd || {}),
                        durationMatrix: (data.tzd && data.tzd.durationMatrix) ? data.tzd.durationMatrix : mergedRules.tzd.durationMatrix
                    };
                    
                    mergedRules.purity = { ...mergedRules.purity, ...(data.purity || {}) };
                    
                    mergedRules.instruction = { 
                        ...mergedRules.instruction, 
                        ...(data.instruction || {}),
                        forcedReleaseMethods: {
                            ...mergedRules.instruction.forcedReleaseMethods,
                            ...(data.instruction?.forcedReleaseMethods || {})
                        }
                    };
                    
                    mergedRules.punishment = { ...mergedRules.punishment, ...(data.punishment || {}) };
                    // Time-Settings ignorieren wir hier beim Laden (da nicht mehr benötigt), 
                    // oder behalten sie im Speicher, zeigen sie aber nicht an.
                }

                setRules(mergedRules);
            } catch (e) {
                console.error("Fehler beim Laden der Protocol Settings:", e);
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

    const handleRootChange = (key, value) => {
        setRules(prev => ({
            ...prev,
            [key]: value
        }));
        setHasChanges(true);
    };

    // --- LOGIK FÜR TZD SLIDER (2 Adjustable, 1 Remainder) ---
    // Wir nehmen an: Idx 0 = Bait, Idx 1 = Standard, Idx 2 = Wall (Rest)
    const handleTZDWeightChange = (changedIndex, newValue) => {
        if (!rules.tzd?.durationMatrix) return;
        
        const newMatrix = [...rules.tzd.durationMatrix];
        // Setze den neuen Wert für den bewegten Slider
        newMatrix[changedIndex].weight = parseFloat(newValue.toFixed(2));

        // Logik: Wir haben 1.0 zur Verfügung.
        // Slider 0 (Bait) und Slider 1 (Standard) sind einstellbar.
        // Slider 2 (Wall) ist der Rest.
        
        let bait = newMatrix[0].weight;
        let standard = newMatrix[1].weight;

        // Wenn Bait geändert wurde
        if (changedIndex === 0) {
            // Wenn Bait + Standard > 1, muss Standard verringert werden
            if (bait + standard > 1.0) {
                standard = parseFloat((1.0 - bait).toFixed(2));
                newMatrix[1].weight = standard;
            }
        }
        // Wenn Standard geändert wurde
        else if (changedIndex === 1) {
            // Wenn Bait + Standard > 1, muss Bait verringert werden
            if (bait + standard > 1.0) {
                bait = parseFloat((1.0 - standard).toFixed(2));
                newMatrix[0].weight = bait;
            }
        }

        // Wall ist immer der Rest (kann 0 sein)
        let wall = parseFloat((1.0 - bait - standard).toFixed(2));
        // Sicherheits-Clamp gegen Rundungsfehler
        wall = Math.max(0, Math.min(1, wall));
        
        newMatrix[2].weight = wall;

        handleChange('tzd', 'durationMatrix', newMatrix);
    };

    // --- LOGIK FÜR FORCED RELEASE METHODEN (2 Adjustable, Hand Remainder) ---
    // Struktur: Hand (Rest), Toy Vaginal (Einstellbar), Toy Anal (Einstellbar)
    const handleMethodChange = (methodKey, newValue) => {
        if (!rules.instruction?.forcedReleaseMethods) return;

        const currentMethods = { ...rules.instruction.forcedReleaseMethods };
        
        // Setze neuen Wert
        currentMethods[methodKey] = parseFloat(newValue.toFixed(2));

        let vag = currentMethods.toy_vaginal || 0;
        let anal = currentMethods.toy_anal || 0;

        // Wenn Vaginal geändert wurde, muss Anal evtl. weichen, wenn Summe > 1
        if (methodKey === 'toy_vaginal') {
            if (vag + anal > 1.0) {
                anal = parseFloat((1.0 - vag).toFixed(2));
            }
        }
        // Wenn Anal geändert wurde, muss Vaginal evtl. weichen
        else if (methodKey === 'toy_anal') {
            if (vag + anal > 1.0) {
                vag = parseFloat((1.0 - anal).toFixed(2));
            }
        }

        // Hand ist der Rest
        let hand = parseFloat((1.0 - vag - anal).toFixed(2));
        hand = Math.max(0, Math.min(1, hand));

        const newMethods = {
            hand: hand,
            toy_vaginal: vag,
            toy_anal: anal
        };

        handleChange('instruction', 'forcedReleaseMethods', newMethods);
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

    // Helper für sichere Anzeige
    const methods = rules.instruction?.forcedReleaseMethods || { hand: 0, toy_vaginal: 0, toy_anal: 0 };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            
            {/* BASIS-TRAGEZEIT */}
            <Paper sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.05)', borderLeft: `4px solid ${PALETTE.accents.green}` }}>
                <Typography variant="h6" sx={{ color: PALETTE.accents.green }} gutterBottom>Tragezeit-Ziel (Basis)</Typography>
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
                        marks={[{ value: 4, label: '4h' }, { value: 8, label: '8h' }, { value: 12, label: '12h' }]}
                    />
                </Box>
            </Paper>

            {/* TZD SEKTION */}
            <Paper sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.05)', borderLeft: `4px solid ${PALETTE.accents.red}` }}>
                <Typography variant="h6" color="primary" gutterBottom>Zeitloses Diktat (TZD)</Typography>
                
                {/* Trigger */}
                <Box sx={{ px: 2, mb: 4 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Trigger Wahrscheinlichkeit</Typography>
                        <Typography color="primary" fontWeight="bold">
                            {rules.tzd?.triggerChance ? (rules.tzd.triggerChance * 100).toFixed(1) : '0.0'}%
                        </Typography>
                    </Box>
                    <Slider 
                        value={rules.tzd?.triggerChance || 0.08} 
                        min={0} max={0.5} step={0.01}
                        onChange={(_, v) => handleChange('tzd', 'triggerChance', v)}
                    />
                </Box>

                {/* Matrix - 2 Adjustable, 1 Calculated */}
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, color: 'text.secondary' }}>Dauer & Wahrscheinlichkeit</Typography>
                
                {/* 1. BAIT (Einstellbar) */}
                <Box sx={{ mb: 2, px: 2, borderLeft: '2px solid #555', pl: 2 }}>
                    <Grid container justifyContent="space-between">
                        <Grid item><Typography variant="body2" fontWeight="bold">The Bait</Typography></Grid>
                        <Grid item><Typography variant="caption">6-12 Std</Typography></Grid>
                    </Grid>
                    <Slider 
                        value={rules.tzd?.durationMatrix?.[0]?.weight || 0} 
                        min={0} max={1} step={0.05}
                        onChange={(_, v) => handleTZDWeightChange(0, v)}
                        valueLabelDisplay="auto"
                        valueLabelFormat={v => `${(v*100).toFixed(0)}%`}
                        sx={{ color: PALETTE.accents.green }}
                    />
                </Box>

                {/* 2. STANDARD (Einstellbar) */}
                <Box sx={{ mb: 2, px: 2, borderLeft: '2px solid #555', pl: 2 }}>
                    <Grid container justifyContent="space-between">
                        <Grid item><Typography variant="body2" fontWeight="bold">The Standard</Typography></Grid>
                        <Grid item><Typography variant="caption">12-24 Std</Typography></Grid>
                    </Grid>
                    <Slider 
                        value={rules.tzd?.durationMatrix?.[1]?.weight || 0} 
                        min={0} max={1} step={0.05}
                        onChange={(_, v) => handleTZDWeightChange(1, v)}
                        valueLabelDisplay="auto"
                        valueLabelFormat={v => `${(v*100).toFixed(0)}%`}
                        sx={{ color: PALETTE.primary.main }}
                    />
                </Box>

                {/* 3. WALL (Berechnet) */}
                <Box sx={{ mb: 2, px: 2, borderLeft: '2px solid #555', pl: 2, opacity: 0.7 }}>
                    <Grid container justifyContent="space-between">
                        <Grid item><Typography variant="body2" fontWeight="bold">The Wall (Rest)</Typography></Grid>
                        <Grid item><Typography variant="caption">24-36 Std</Typography></Grid>
                    </Grid>
                    <Slider 
                        value={rules.tzd?.durationMatrix?.[2]?.weight || 0} 
                        min={0} max={1} step={0.05}
                        disabled // Read-Only
                        valueLabelDisplay="auto"
                        valueLabelFormat={v => `${(v*100).toFixed(0)}%`}
                        sx={{ color: PALETTE.accents.red }}
                    />
                </Box>
            </Paper>

            {/* FORCED RELEASE */}
            <Paper sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.05)', borderLeft: `4px solid ${PALETTE.accents.purple}` }}>
                <Typography variant="h6" sx={{ color: PALETTE.accents.purple }} gutterBottom>Forced Release</Typography>
                
                <Box sx={{ px: 2, mb: 4 }}>
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

                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, color: 'text.secondary' }}>Methoden Wahrscheinlichkeit</Typography>

                {/* Toy Vaginal (Einstellbar) */}
                <Box sx={{ mb: 2, px: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption">Toy Vaginal</Typography>
                        <Typography variant="caption" fontWeight="bold">{(methods.toy_vaginal * 100).toFixed(0)}%</Typography>
                    </Box>
                    <Slider 
                        value={methods.toy_vaginal || 0} min={0} max={1} step={0.01}
                        onChange={(_, v) => handleMethodChange('toy_vaginal', v)}
                        sx={{ color: PALETTE.accents.pink }}
                    />
                </Box>

                {/* Toy Anal (Einstellbar) */}
                <Box sx={{ mb: 2, px: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption">Toy Anal</Typography>
                        <Typography variant="caption" fontWeight="bold">{(methods.toy_anal * 100).toFixed(0)}%</Typography>
                    </Box>
                    <Slider 
                        value={methods.toy_anal || 0} min={0} max={1} step={0.01}
                        onChange={(_, v) => handleMethodChange('toy_anal', v)}
                        sx={{ color: PALETTE.accents.purple }}
                    />
                </Box>

                {/* Hand (Rest - Read Only) */}
                <Box sx={{ mb: 2, px: 2, opacity: 0.6 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption">Hand (Restwahrscheinlichkeit)</Typography>
                        <Typography variant="caption" fontWeight="bold">{(methods.hand * 100).toFixed(0)}%</Typography>
                    </Box>
                    <Slider 
                        value={methods.hand || 0} min={0} max={1}
                        disabled
                        sx={{ color: 'text.secondary' }}
                    />
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
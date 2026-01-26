import React from 'react';
import { Box, Typography, Slider, Paper, Grid } from '@mui/material';
import { PALETTE } from '../../theme/obsidianDesign';

// Diese Komponente ist nun "stateless" bzgl. Datenbank.
// Sie zeigt nur an und meldet Änderungen an Settings.jsx zurück.
export default function ProtocolSettings({ rules, onChange }) {
    
    if (!rules) return <Typography sx={{p:3}}>Lade Konfiguration...</Typography>;

    // Helper für sichere Anzeige
    const methods = rules.instruction?.forcedReleaseMethods || { hand: 0, toy_vaginal: 0, toy_anal: 0 };

    const handleChange = (section, key, value) => {
        const newRules = {
            ...rules,
            [section]: {
                ...rules[section],
                [key]: value
            }
        };
        onChange(newRules);
    };

    const handleRootChange = (key, value) => {
        const newRules = {
            ...rules,
            [key]: value
        };
        onChange(newRules);
    };

    // --- LOGIK FÜR TZD SLIDER (2 Adjustable, 1 Remainder) ---
    const handleTZDWeightChange = (changedIndex, newValue) => {
        if (!rules.tzd?.durationMatrix) return;
        
        const newMatrix = [...rules.tzd.durationMatrix];
        // Clone objects inside array to avoid mutation
        newMatrix[0] = { ...newMatrix[0] };
        newMatrix[1] = { ...newMatrix[1] };
        newMatrix[2] = { ...newMatrix[2] };

        newMatrix[changedIndex].weight = parseFloat(newValue.toFixed(2));

        let bait = newMatrix[0].weight;
        let standard = newMatrix[1].weight;

        if (changedIndex === 0) {
            if (bait + standard > 1.0) {
                standard = parseFloat((1.0 - bait).toFixed(2));
                newMatrix[1].weight = standard;
            }
        }
        else if (changedIndex === 1) {
            if (bait + standard > 1.0) {
                bait = parseFloat((1.0 - standard).toFixed(2));
                newMatrix[0].weight = bait;
            }
        }

        let wall = parseFloat((1.0 - bait - standard).toFixed(2));
        wall = Math.max(0, Math.min(1, wall));
        newMatrix[2].weight = wall;

        handleChange('tzd', 'durationMatrix', newMatrix);
    };

    // --- LOGIK FÜR FORCED RELEASE METHODEN ---
    const handleMethodChange = (methodKey, newValue) => {
        if (!rules.instruction?.forcedReleaseMethods) return;

        const currentMethods = { ...rules.instruction.forcedReleaseMethods };
        currentMethods[methodKey] = parseFloat(newValue.toFixed(2));

        let vag = currentMethods.toy_vaginal || 0;
        let anal = currentMethods.toy_anal || 0;

        if (methodKey === 'toy_vaginal') {
            if (vag + anal > 1.0) anal = parseFloat((1.0 - vag).toFixed(2));
        }
        else if (methodKey === 'toy_anal') {
            if (vag + anal > 1.0) vag = parseFloat((1.0 - anal).toFixed(2));
        }

        let hand = parseFloat((1.0 - vag - anal).toFixed(2));
        hand = Math.max(0, Math.min(1, hand));

        const newMethods = { hand, toy_vaginal: vag, toy_anal: anal };
        handleChange('instruction', 'forcedReleaseMethods', newMethods);
    };

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

                {/* Matrix */}
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, color: 'text.secondary' }}>Dauer & Wahrscheinlichkeit</Typography>
                
                {/* 1. BAIT */}
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

                {/* 2. STANDARD */}
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

                {/* 3. WALL */}
                <Box sx={{ mb: 2, px: 2, borderLeft: '2px solid #555', pl: 2, opacity: 0.7 }}>
                    <Grid container justifyContent="space-between">
                        <Grid item><Typography variant="body2" fontWeight="bold">The Wall (Rest)</Typography></Grid>
                        <Grid item><Typography variant="caption">24-36 Std</Typography></Grid>
                    </Grid>
                    <Slider 
                        value={rules.tzd?.durationMatrix?.[2]?.weight || 0} 
                        min={0} max={1} step={0.05}
                        disabled
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
        </Box>
    );
}
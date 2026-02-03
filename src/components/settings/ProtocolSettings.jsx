import React from 'react';
import { Box, Typography, Slider, Paper, Grid } from '@mui/material';
import { PALETTE } from '../../theme/obsidianDesign';
import { DEFAULT_PROTOCOL_RULES } from '../../config/defaultRules';

// --- HELPER ZUR BERECHNUNG DER ZONEN (Lokal für UI-Visualisierung) ---
const calculateZones = (maxHours) => {
    return [
        { label: 'The Bait', min: maxHours / 6, max: maxHours / 3, color: PALETTE.accents.green, weight: '20%' },
        { label: 'The Standard', min: maxHours / 3, max: (maxHours * 2) / 3, color: PALETTE.primary.main, weight: '50%' },
        { label: 'The Wall', min: (maxHours * 2) / 3, max: maxHours, color: PALETTE.accents.red, weight: '30%' }
    ];
};

export default function ProtocolSettings({ rules, onChange }) {
    
    if (!rules) return <Typography sx={{p:3}}>Lade Konfiguration...</Typography>;

    // Helper für sichere Anzeige der Forced Release Methoden
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
        const newRules = { ...rules, [key]: value };
        onChange(newRules);
    };

    // Forced Release Logic (Methoden Balance)
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

    // Aktueller TZD Max Wert (oder Default)
    const tzdMax = rules.tzd?.tzdMaxHours || DEFAULT_PROTOCOL_RULES.tzd.tzdMaxHours;
    const zones = calculateZones(tzdMax);

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

            {/* TZD SEKTION (REFAKTORIERT) */}
            <Paper sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.05)', borderLeft: `4px solid ${PALETTE.accents.red}` }}>
                <Typography variant="h6" color="primary" gutterBottom>Zeitloses Diktat (TZD)</Typography>
                
                {/* 1. Trigger Chance */}
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

                {/* 2. Maximaldauer Slider */}
                <Box sx={{ px: 2, mb: 4 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Maximaldauer (Anker)</Typography>
                        <Typography variant="h5" sx={{ color: PALETTE.accents.red, fontWeight: 'bold' }}>
                            {tzdMax} Std.
                        </Typography>
                    </Box>
                    <Slider 
                        value={tzdMax} 
                        min={6} max={72} step={6}
                        onChange={(_, v) => handleChange('tzd', 'tzdMaxHours', v)}
                        marks={[
                            { value: 6, label: '6h' },
                            { value: 24, label: '24h' },
                            { value: 48, label: '48h' },
                            { value: 72, label: '72h' }
                        ]}
                        sx={{ 
                            color: PALETTE.accents.red,
                            '& .MuiSlider-thumb': { boxShadow: `0 0 10px ${PALETTE.accents.red}` }
                        }}
                    />
                </Box>

                {/* 3. Zonen Visualisierung */}
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, color: 'text.secondary' }}>Berechnete Zonen (Dauer & Wahrscheinlichkeit)</Typography>
                
                {zones.map((zone, idx) => (
                    <Box key={idx} sx={{ mb: 2, px: 2, borderLeft: `2px solid ${zone.color}`, pl: 2, bgcolor: 'rgba(0,0,0,0.2)', py: 1 }}>
                        <Grid container justifyContent="space-between" alignItems="center">
                            <Grid item xs={5}>
                                <Typography variant="body2" fontWeight="bold" sx={{ color: zone.color }}>{zone.label}</Typography>
                            </Grid>
                            <Grid item xs={4} sx={{ textAlign: 'center' }}>
                                <Typography variant="caption" sx={{ color: '#fff' }}>
                                    {Math.round(zone.min)}-{Math.round(zone.max)} Std
                                </Typography>
                            </Grid>
                            <Grid item xs={3} sx={{ textAlign: 'right' }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    {zone.weight}
                                </Typography>
                            </Grid>
                        </Grid>
                    </Box>
                ))}

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
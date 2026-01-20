import React from 'react';
import { Box, Typography, LinearProgress, Paper, Stack } from '@mui/material';
import { motion } from 'framer-motion';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import NightlightRoundIcon from '@mui/icons-material/NightlightRound';
import LockIcon from '@mui/icons-material/Lock';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { PALETTE, DESIGN_TOKENS } from '../../theme/obsidianDesign';

export default function ProgressBar({ currentMinutes, targetHours, isGoalMetToday, progressData }) {
    // Wenn es nach 23:00 Uhr ist und das Ziel erreicht wurde, bleibt es grün (UI Logic via Parent oder hier)
    // Die Anforderung: "Bis 23:00 Uhr so bleiben". 
    // Wir nehmen an, der Reset passiert um Mitternacht oder morgens via Logik.
    
    const targetMinutes = targetHours * 60;
    
    // Berechnung für den Balken (max 100% visuell)
    const percentage = Math.min(100, (currentMinutes / targetMinutes) * 100);
    
    // Farbe: Grün wenn Ziel erreicht, sonst Primary (Lila/Blau)
    const barColor = isGoalMetToday ? PALETTE.accents.green : PALETTE.primary.main;
    const glowColor = isGoalMetToday ? 'rgba(0, 255, 157, 0.4)' : 'rgba(187, 134, 252, 0.3)';

    // Zeit-Formatierung (h min)
    const formatTime = (totalMins) => {
        const h = Math.floor(totalMins / 60);
        const m = Math.floor(totalMins % 60);
        return `${h}h ${m}m`;
    };

    const nightSuccess = progressData?.nightCompliance === true;

    return (
        <Paper 
            elevation={0}
            sx={{ 
                p: 3, 
                mb: 4, 
                borderRadius: '24px',
                background: `linear-gradient(145deg, rgba(30,30,30,0.8) 0%, rgba(20,20,20,0.9) 100%)`,
                border: `1px solid rgba(255,255,255,0.08)`,
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {/* Header: Titel und Nacht-Status */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LockIcon fontSize="small" sx={{ color: barColor }} />
                    TAGESZIEL
                </Typography>
                
                {/* Nacht-Status Anzeige */}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ 
                    bgcolor: 'rgba(0,0,0,0.3)', 
                    px: 1.5, py: 0.5, 
                    borderRadius: '12px',
                    border: `1px solid ${nightSuccess ? PALETTE.accents.gold : 'rgba(255,255,255,0.1)'}`
                }}>
                    <NightlightRoundIcon sx={{ 
                        fontSize: 16, 
                        color: nightSuccess ? PALETTE.accents.gold : 'text.disabled' 
                    }} />
                    <Typography variant="caption" sx={{ 
                        color: nightSuccess ? PALETTE.accents.gold : 'text.disabled',
                        fontWeight: 'bold',
                        textTransform: 'uppercase'
                    }}>
                        {nightSuccess ? "Nacht erfüllt" : "Nacht offen"}
                    </Typography>
                </Stack>
            </Box>

            {/* Große Zeit-Anzeige */}
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
                <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#fff' }}>
                    {formatTime(currentMinutes)}
                </Typography>
                <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 300 }}>
                    / {targetHours}h
                </Typography>
            </Box>

            {/* Status Text (Dynamisch) */}
            <Typography variant="body2" sx={{ color: barColor, mb: 2, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>
                {isGoalMetToday ? "ZIEL ERREICHT - OVERACHIEVEMENT AKTIV" : "IN PROGRESS"}
            </Typography>

            {/* Der Balken */}
            <Box sx={{ position: 'relative', height: 12, borderRadius: 6, bgcolor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    style={{
                        height: '100%',
                        backgroundColor: barColor,
                        borderRadius: 6,
                        boxShadow: `0 0 15px ${glowColor}`
                    }}
                />
                
                {/* Animierter Glanz-Effekt wenn aktiv */}
                {percentage > 0 && (
                    <motion.div
                        animate={{ x: ['-100%', '200%'] }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        style={{
                            position: 'absolute',
                            top: 0, left: 0, bottom: 0, width: '40%',
                            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                            zIndex: 1
                        }}
                    />
                )}
            </Box>
        </Paper>
    );
}
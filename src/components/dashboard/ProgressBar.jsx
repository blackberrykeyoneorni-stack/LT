import React from 'react';
import { Box, Typography, LinearProgress, Paper, Stack } from '@mui/material';
import NightlightRoundIcon from '@mui/icons-material/NightlightRound';
import { PALETTE } from '../../theme/obsidianDesign';

export default function ProgressBar({ currentMinutes, targetHours, isGoalMetToday, progressData }) {
    
    const targetMinutes = targetHours * 60;
    // Balken darf max 100% sein für die Anzeige
    const progressPercent = Math.min(100, Math.max(0, (currentMinutes / targetMinutes) * 100));
    
    // 1. FARB-LOGIK
    // Wenn Ziel erreicht: Schönes Erfolgs-Grün (PALETTE.accents.green oder hardcoded '#00E676')
    // Sonst: Standard Primary (Lila/Blau)
    const activeColor = isGoalMetToday ? '#00E676' : PALETTE.primary.main;
    
    // Nacht-Status: Gold für Erfolg, Grau für Offen (KEIN ROT MEHR)
    const nightSuccess = progressData?.nightCompliance === true;
    const nightColor = nightSuccess ? '#FFD700' : 'text.disabled'; // Gold vs Grau

    const formatTime = (totalMins) => {
        const h = Math.floor(totalMins / 60);
        const m = Math.floor(totalMins % 60);
        return `${h}h ${m}m`;
    };

    return (
        <Paper 
            elevation={0}
            sx={{ 
                p: 2.5, 
                mb: 3, 
                borderRadius: '16px',
                bgcolor: 'rgba(255,255,255,0.05)', 
                border: `1px solid ${isGoalMetToday ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255,255,255,0.05)'}` // Zarter grüner Rahmen bei Erfolg
            }}
        >
            {/* Header Zeile: Titel und Zeit */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="body2" sx={{ color: isGoalMetToday ? activeColor : 'text.secondary', letterSpacing: 1, fontWeight: 'bold' }}>
                    TAGESZIEL
                </Typography>
                
                <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', lineHeight: 1, color: isGoalMetToday ? '#fff' : 'text.primary' }}>
                        {formatTime(currentMinutes)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        von {targetHours}h
                    </Typography>
                </Box>
            </Box>

            {/* Der Balken */}
            <LinearProgress 
                variant="determinate" 
                value={progressPercent} 
                sx={{ 
                    height: 12, 
                    borderRadius: 6,
                    bgcolor: 'rgba(255,255,255,0.1)',
                    mb: 1.5,
                    '& .MuiLinearProgress-bar': {
                        backgroundColor: activeColor,
                        borderRadius: 6,
                        boxShadow: isGoalMetToday ? `0 0 10px ${activeColor}` : 'none' // Leichter Glow bei Erfolg
                    }
                }}
            />

            {/* Footer Zeile: Status Text und Mond */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: activeColor, fontWeight: 'bold', textTransform: 'uppercase' }}>
                    {isGoalMetToday ? "ZIEL ERREICHT" : "IN PROGRESS"}
                </Typography>

                <Stack direction="row" spacing={0.5} alignItems="center">
                    <NightlightRoundIcon sx={{ 
                        fontSize: 16, 
                        color: nightColor 
                    }} />
                    <Typography variant="caption" sx={{ 
                        color: nightColor,
                        fontWeight: nightSuccess ? 'bold' : 'normal',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5
                    }}>
                        {nightSuccess ? "NACHT ERFÜLLT" : "NACHT OFFEN"}
                    </Typography>
                </Stack>
            </Box>
        </Paper>
    );
}
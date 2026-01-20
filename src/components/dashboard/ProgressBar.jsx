import React from 'react';
import { Box, Typography, LinearProgress, Paper, Stack } from '@mui/material';
import NightlightRoundIcon from '@mui/icons-material/NightlightRound';
import { PALETTE } from '../../theme/obsidianDesign';

export default function ProgressBar({ currentMinutes, targetHours, isGoalMetToday, progressData }) {
    
    const targetMinutes = targetHours * 60;
    // Balken darf max 100% sein für die Anzeige
    const progressPercent = Math.min(100, Math.max(0, (currentMinutes / targetMinutes) * 100));
    
    // Logik für Farben und Icons
    const barColor = isGoalMetToday ? PALETTE.accents.green : PALETTE.primary.main;
    const nightSuccess = progressData?.nightCompliance === true;

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
                bgcolor: 'rgba(255,255,255,0.05)', // Das "graue Feld" wie beim FemIndexBar
                border: '1px solid rgba(255,255,255,0.05)'
            }}
        >
            {/* Header Zeile: Titel und Zeit */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', letterSpacing: 1, fontWeight: 'bold' }}>
                    TAGESZIEL
                </Typography>
                
                <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', lineHeight: 1 }}>
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
                        backgroundColor: barColor,
                        borderRadius: 6
                    }
                }}
            />

            {/* Footer Zeile: Status Text und Mond */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: barColor, fontWeight: 'bold', textTransform: 'uppercase' }}>
                    {isGoalMetToday ? "Erreicht" : "In Progress"}
                </Typography>

                <Stack direction="row" spacing={0.5} alignItems="center">
                    <NightlightRoundIcon sx={{ 
                        fontSize: 14, 
                        color: nightSuccess ? PALETTE.accents.gold : 'text.disabled' 
                    }} />
                    <Typography variant="caption" sx={{ 
                        color: nightSuccess ? PALETTE.accents.gold : 'text.disabled',
                        fontWeight: nightSuccess ? 'bold' : 'normal'
                    }}>
                        {nightSuccess ? "NACHT ERFÜLLT" : "NACHT OFFEN"}
                    </Typography>
                </Stack>
            </Box>
        </Paper>
    );
}
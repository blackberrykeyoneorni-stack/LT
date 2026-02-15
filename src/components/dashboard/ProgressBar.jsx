import React from 'react';
import { Box, Typography, LinearProgress, Paper, Stack } from '@mui/material';
import NightlightRoundIcon from '@mui/icons-material/NightlightRound';
import { PALETTE } from '../../theme/obsidianDesign';

export default function ProgressBar({ currentMinutes, targetHours, isGoalMetToday, progressData }) {
    
    const targetMinutes = targetHours * 60;
    // Balken darf max 100% sein für die Anzeige
    const progressPercent = Math.min(100, Math.max(0, (currentMinutes / targetMinutes) * 100));
    
    // Status der Nacht extrahieren
    const nightFailed = progressData?.nightCompliance === false;
    const nightSuccess = progressData?.nightCompliance === true;

    // 1. STRIKTE ERFOLGS-LOGIK
    // Balken darf nur auf Smaragdgrün springen, wenn das Tagesziel erreicht ist 
    // UND die vorangegangene Nacht nicht fehlgeschlagen ist.
    const isStrictlySuccessful = isGoalMetToday && !nightFailed;
    
    // Neues "Dark Boudoir" Smaragdgrün für Erfolge
    const emeraldGreen = '#10B981'; 
    const activeColor = isStrictlySuccessful ? emeraldGreen : PALETTE.primary.main;
    
    // Nacht-Status Icon Farbe
    let nightColor = 'text.disabled'; // Default: Grau (Offen/Wartend)
    if (nightSuccess) nightColor = '#FFD700'; // Gold bei Erfolg
    else if (nightFailed) nightColor = PALETTE.error.main; // Crimson Rot bei Versagen

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
                border: `1px solid ${isStrictlySuccessful ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)'}` // Zarter grüner Rahmen bei Erfolg
            }}
        >
            {/* Header Zeile: Titel und Zeit */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="body2" sx={{ color: isStrictlySuccessful ? activeColor : 'text.secondary', letterSpacing: 1, fontWeight: 'bold' }}>
                    TAGESZIEL
                </Typography>
                
                <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', lineHeight: 1, color: isStrictlySuccessful ? '#fff' : 'text.primary' }}>
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
                        boxShadow: isStrictlySuccessful ? `0 0 10px ${activeColor}` : 'none' // Leichter Glow bei Erfolg
                    }
                }}
            />

            {/* Footer Zeile: Status Text und Mond */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: activeColor, fontWeight: 'bold', textTransform: 'uppercase' }}>
                    {isStrictlySuccessful ? "ZIEL ERREICHT" : "IN PROGRESS"}
                </Typography>

                <Stack direction="row" spacing={0.5} alignItems="center">
                    <NightlightRoundIcon sx={{ 
                        fontSize: 16, 
                        color: nightColor 
                    }} />
                    <Typography variant="caption" sx={{ 
                        color: nightColor,
                        fontWeight: (nightSuccess || nightFailed) ? 'bold' : 'normal',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5
                    }}>
                        {nightSuccess ? "NACHT ERFÜLLT" : (nightFailed ? "NACHT GESCHEITERT" : "NACHT OFFEN")}
                    </Typography>
                </Stack>
            </Box>
        </Paper>
    );
}
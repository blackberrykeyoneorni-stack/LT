import React from 'react';
import { Box, Typography, Tooltip, useTheme, Card } from '@mui/material';
import { motion } from 'framer-motion';
import NightlightRoundIcon from '@mui/icons-material/NightlightRound';
import LockIcon from '@mui/icons-material/Lock';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const formatTargetTime = (decimalHours) => {
    if (!decimalHours || isNaN(decimalHours)) return "0h 0m";
    const h = Math.floor(decimalHours);
    const m = Math.round((decimalHours - h) * 60);
    return `${h}h ${m}m`;
};

export default function ProgressBar({ currentMinutes, targetHours, isGoalMetToday, progressData }) {
    const theme = useTheme();
    const m3 = theme.palette.m3;

    // Berechnung des echten Prozentsatzes (kann > 100 sein)
    const rawPercentage = progressData?.percentage || (isGoalMetToday ? 100 : ((currentMinutes / (targetHours * 60)) * 100));
    
    // Für die visuelle Breite max 100%
    const visualWidth = Math.min(100, rawPercentage);

    const nightStatus = progressData?.nightStatus || 'unknown'; 
    const isLocked = progressData?.isNightLocked || false;

    // Farben bestimmen
    let barColor = m3.primary;
    let trackColor = m3.surfaceContainerHighest;
    let iconColor = m3.onSurfaceVariant;
    
    if (isLocked) {
        barColor = m3.error;
        trackColor = m3.errorContainer;
        iconColor = m3.error;
    } else if (isGoalMetToday || rawPercentage >= 100) {
        barColor = '#4caf50'; // Explizites Grün (Success)
        iconColor = '#4caf50';
    }

    return (
        <Card sx={{ mb: 3, p: 2.5, position: 'relative', overflow: 'visible' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                    <Typography variant="subtitle2" sx={{ color: isLocked ? m3.error : theme.palette.text.primary }}>
                        {isLocked ? "TAGESZIEL GESPERRT" : "Tagesfortschritt"}
                    </Typography>
                    {!isLocked && (
                        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontSize: '0.75rem' }}>
                            {formatTargetTime(targetHours)} Zielvorgabe
                        </Typography>
                    )}
                </Box>
                
                <Tooltip title={isLocked ? "Gesperrt" : "Status"}>
                    <Box sx={{ 
                        display: 'flex', alignItems: 'center', gap: 1,
                        color: iconColor,
                        bgcolor: isLocked ? m3.errorContainer : m3.surfaceContainerHighest,
                        px: 1.5, py: 0.5, borderRadius: '8px'
                    }}>
                        {isLocked ? <LockIcon fontSize="small" /> : (
                            (isGoalMetToday || rawPercentage >= 100) ? <CheckCircleIcon fontSize="small" sx={{color: '#4caf50'}}/> : <NightlightRoundIcon fontSize="small" />
                        )}
                        {nightStatus === 'fulfilled' && !isLocked && <Typography variant="caption" fontWeight="bold">Nacht OK</Typography>}
                    </Box>
                </Tooltip>
            </Box>

            {/* M3 PROGRESS TRACK */}
            <Box sx={{ 
                position: 'relative', 
                height: 16, 
                bgcolor: trackColor, 
                borderRadius: '9999px',
                overflow: 'hidden' 
            }}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${visualWidth}%` }}
                    transition={{ duration: 1, type: 'spring', stiffness: 50 }}
                    style={{
                        height: '100%',
                        backgroundColor: barColor,
                        borderRadius: '9999px',
                    }}
                />
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="body2" sx={{ color: isLocked ? m3.error : theme.palette.text.secondary, fontWeight: 500 }}>
                    {isLocked ? "Zugriff verweigert" : `${Math.floor(currentMinutes / 60)}h ${currentMinutes % 60}m`}
                </Typography>
                <Typography variant="body2" sx={{ color: (rawPercentage >= 100 && !isLocked) ? '#4caf50' : theme.palette.text.primary, fontWeight: 'bold' }}>
                    {rawPercentage.toFixed(0)}%
                </Typography>
            </Box>
        </Card>
    );
}
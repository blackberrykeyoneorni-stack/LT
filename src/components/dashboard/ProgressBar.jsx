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
    const m3 = theme.palette.m3; // Zugriff auf unsere Android 16 Tokens

    const percentage = progressData?.percentage || (isGoalMetToday ? 100 : Math.min(100, (currentMinutes / (targetHours * 60)) * 100));
    const nightStatus = progressData?.nightStatus || 'unknown'; 
    const isLocked = progressData?.isNightLocked || false;

    // M3 STATE LOGIK
    // 1. Locked: Error State (Rot/Gedämpft)
    // 2. Goal Met: Primary Container (Abgeschlossen/Erledigt)
    // 3. Active: Primary (Teal)
    let barColor = m3.primary;
    let trackColor = m3.surfaceContainerHighest;
    let iconColor = m3.onSurfaceVariant;
    
    if (isLocked) {
        barColor = m3.error;
        trackColor = m3.errorContainer; // Rötlicher Hintergrund
        iconColor = m3.error;
    } else if (isGoalMetToday) {
        barColor = m3.primary; // Bleibt Primary für Konsistenz
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
                            isGoalMetToday ? <CheckCircleIcon fontSize="small" sx={{color: m3.primary}}/> : <NightlightRoundIcon fontSize="small" />
                        )}
                        {nightStatus === 'fulfilled' && !isLocked && <Typography variant="caption" fontWeight="bold">Nacht OK</Typography>}
                    </Box>
                </Tooltip>
            </Box>

            {/* M3 PROGRESS TRACK (Pill Shape) */}
            <Box sx={{ 
                position: 'relative', 
                height: 16, // Höher für Touch/Visibility
                bgcolor: trackColor, 
                borderRadius: '9999px', // Pill
                overflow: 'hidden' 
            }}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, type: 'spring', stiffness: 50 }}
                    style={{
                        height: '100%',
                        backgroundColor: barColor,
                        borderRadius: '9999px', // Inner Pill
                    }}
                />
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="body2" sx={{ color: isLocked ? m3.error : theme.palette.text.secondary, fontWeight: 500 }}>
                    {isLocked ? "Zugriff verweigert" : `${Math.floor(currentMinutes / 60)}h ${currentMinutes % 60}m`}
                </Typography>
                <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: 'bold' }}>
                    {percentage.toFixed(0)}%
                </Typography>
            </Box>
        </Card>
    );
}
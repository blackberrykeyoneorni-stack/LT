import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import { motion } from 'framer-motion';
import NightlightRoundIcon from '@mui/icons-material/NightlightRound';
import LockIcon from '@mui/icons-material/Lock';

const formatTargetTime = (decimalHours) => {
    if (!decimalHours || isNaN(decimalHours)) return "0h 0m";
    const h = Math.floor(decimalHours);
    const m = Math.round((decimalHours - h) * 60);
    if (m === 60) return `${h + 1}h 0m`;
    return `${h}h ${m}m`;
};

export default function ProgressBar({ currentMinutes, targetHours, isGoalMetToday, progressData }) {
    const percentage = progressData?.percentage || (isGoalMetToday ? 100 : Math.min(100, (currentMinutes / (targetHours * 60)) * 100));
    const nightStatus = progressData?.nightStatus || 'unknown'; 
    const isLocked = progressData?.isNightLocked || false;

    let barColor = isGoalMetToday ? PALETTE.accents.green : PALETTE.primary.main;
    let borderColor = 'rgba(255, 255, 255, 0.1)'; 
    
    if (isLocked) {
        barColor = PALETTE.accents.red; 
        borderColor = `${PALETTE.accents.red}50`;
    } else if (nightStatus === 'fulfilled') {
        borderColor = `${PALETTE.accents.gold}40`; 
    }

    return (
        <Box 
            component={motion.div}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            sx={{ 
                mb: 3, position: 'relative',
                ...DESIGN_TOKENS.glassCard,
                border: `1px solid ${borderColor}`,
                p: 2.5
            }}
        >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: isLocked ? PALETTE.accents.red : 'text.primary' }}>
                    {isLocked ? "TAGESZIEL GESPERRT" : "Tagesfortschritt"}
                    {!isLocked && (
                        <Typography component="span" color="text.secondary" sx={{ fontWeight: 400, ml: 1 }}>
                            ({formatTargetTime(targetHours)} Ziel)
                        </Typography>
                    )}
                </Typography>
                
                <Tooltip title={isLocked ? "Gesperrt" : "Nachtstatus"}>
                    <motion.div animate={{ scale: nightStatus === 'fulfilled' ? 1.1 : 1, opacity: 1 }}>
                        <Box sx={{ 
                            display: 'flex', alignItems: 'center', gap: 0.5, 
                            color: nightStatus === 'fulfilled' ? PALETTE.accents.gold : 'text.disabled',
                            filter: nightStatus === 'fulfilled' ? 'drop-shadow(0 0 5px rgba(255, 215, 0, 0.5))' : 'none'
                        }}>
                            {isLocked ? <LockIcon fontSize="small" color="error" /> : <NightlightRoundIcon fontSize="small" />}
                        </Box>
                    </motion.div>
                </Tooltip>
            </Box>

            <Box sx={{ position: 'relative', height: 10, bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden' }}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, type: 'spring' }}
                    style={{
                        height: '100%',
                        backgroundColor: barColor,
                        backgroundImage: isLocked 
                            ? `repeating-linear-gradient(45deg, ${PALETTE.accents.red}, ${PALETTE.accents.red} 10px, #330000 10px, #330000 20px)`
                            : `linear-gradient(90deg, ${barColor}, ${isGoalMetToday ? '#00ff88' : PALETTE.primary.light})`,
                    }}
                />
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="caption" color={isLocked ? "error" : "text.secondary"}>
                    {isLocked ? "Nicht erfüllt" : `${Math.floor(currentMinutes / 60)}h ${currentMinutes % 60}m`}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight="bold">
                    {percentage.toFixed(0)}%
                </Typography>
            </Box>
        </Box>
    );
}
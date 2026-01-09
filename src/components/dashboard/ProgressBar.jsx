import React from 'react';
import { Box, Typography, LinearProgress, Tooltip } from '@mui/material';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import { motion } from 'framer-motion';
import NightlightRoundIcon from '@mui/icons-material/NightlightRound';
import LockIcon from '@mui/icons-material/Lock';

export default function ProgressBar({ currentMinutes, targetHours, isGoalMetToday, progressData }) {
    // Falls progressData fehlt (Fallback), nehmen wir die Props
    const percentage = progressData?.percentage || (isGoalMetToday ? 100 : Math.min(100, (currentMinutes / (targetHours * 60)) * 100));
    const nightStatus = progressData?.nightStatus || 'unknown'; 
    const isLocked = progressData?.isNightLocked || false;

    // Farben und Styles basierend auf Status
    let barColor = isGoalMetToday ? PALETTE.accents.green : PALETTE.primary.main;
    let borderColor = 'rgba(255, 255, 255, 0.1)'; // Standard Rahmen
    let containerBg = 'rgba(255, 255, 255, 0.03)'; // Standard Hintergrund

    if (isLocked) {
        barColor = PALETTE.accents.red; 
        borderColor = `${PALETTE.accents.red}50`; // Roter Rahmen (50% Deckkraft)
        containerBg = 'rgba(40, 0, 0, 0.2)'; // Leichter Rotschimmer im Hintergrund
    } else if (nightStatus === 'fulfilled') {
        borderColor = `${PALETTE.accents.gold}40`; // Goldener Rahmen (40% Deckkraft)
        // barColor bleibt Standard (oder Green bei Erfolg), aber Rahmen zeigt den Status
    }

    return (
        <Box 
            component={motion.div}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            sx={{ 
                mb: 3, 
                position: 'relative',
                // --- NEUER RAHMEN / CONTAINER STYLE ---
                border: `1px solid ${borderColor}`,
                borderRadius: '16px',
                p: 2.5, // Innenabstand damit es "atmen" kann
                bgcolor: containerBg,
                backdropFilter: 'blur(10px)',
                boxShadow: isLocked ? '0 0 15px rgba(255, 0, 0, 0.1)' : '0 4px 20px rgba(0,0,0,0.2)'
            }}
        >
            
            {/* Header: Titel & Mond-Status */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: isLocked ? PALETTE.accents.red : 'text.primary' }}>
                    {isLocked ? "TAGESZIEL GESPERRT" : "Tagesfortschritt"}
                    {!isLocked && <Typography component="span" color="text.secondary" sx={{ fontWeight: 400, ml: 1 }}>({targetHours}h Ziel)</Typography>}
                </Typography>
                
                {/* DER GOLDENE MOND / STATUS ICON */}
                <Tooltip title={isLocked ? "Nacht-Checkpoints verfehlt! Tag gesperrt." : "Nacht erfolgreich durchgehalten."}>
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0.5 }}
                        animate={{ 
                            scale: nightStatus === 'fulfilled' ? 1.1 : 1, 
                            opacity: 1,
                            textShadow: nightStatus === 'fulfilled' ? `0 0 10px ${PALETTE.accents.gold}` : 'none'
                        }}
                    >
                        <Box sx={{ 
                            display: 'flex', alignItems: 'center', gap: 0.5, 
                            color: nightStatus === 'fulfilled' ? PALETTE.accents.gold : 'text.disabled',
                            filter: nightStatus === 'fulfilled' ? 'drop-shadow(0 0 5px rgba(255, 215, 0, 0.5))' : 'none'
                        }}>
                            {isLocked ? <LockIcon fontSize="small" color="error" /> : <NightlightRoundIcon fontSize="small" />}
                            {nightStatus === 'fulfilled' && (
                                <Typography variant="caption" sx={{ fontWeight: 'bold', color: PALETTE.accents.gold, display: ['none', 'block'] }}>
                                    NACHT ERFÜLLT
                                </Typography>
                            )}
                        </Box>
                    </motion.div>
                </Tooltip>
            </Box>

            {/* Balken Container */}
            <Box sx={{ position: 'relative', height: 10, bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden' }}>
                
                {/* Animierter Füll-Balken */}
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, type: 'spring' }}
                    style={{
                        height: '100%',
                        backgroundColor: barColor,
                        backgroundImage: isLocked 
                            ? `repeating-linear-gradient(45deg, ${PALETTE.accents.red}, ${PALETTE.accents.red} 10px, #330000 10px, #330000 20px)`
                            : (isGoalMetToday ? `linear-gradient(90deg, ${PALETTE.accents.green}, #00ff88)` : `linear-gradient(90deg, ${PALETTE.primary.main}, ${PALETTE.primary.light})`),
                        boxShadow: isGoalMetToday ? `0 0 15px ${PALETTE.accents.green}` : 'none',
                    }}
                />
            </Box>
            
            {/* Text unter dem Balken */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="caption" color={isLocked ? "error" : "text.secondary"}>
                    {isLocked ? "Anforderung nicht erfüllt" : `${Math.floor(currentMinutes / 60)}h ${currentMinutes % 60}m erreicht`}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight="bold">
                    {percentage.toFixed(0)}%
                </Typography>
            </Box>

        </Box>
    );
}

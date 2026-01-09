import React from 'react';
import { Box, Button, Paper, Typography, LinearProgress, Stack, Avatar } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import HotelIcon from '@mui/icons-material/Hotel'; 
import WarningAmberIcon from '@mui/icons-material/WarningAmber'; 
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';

export default function ActionPanel({ isBusy, recoveryInfo, onStartSession }) {
    
    // Fall 1: Elasthan Recovery (Goldgelb)
    if (recoveryInfo?.isResting && !isBusy) {
        return (
            <Box sx={{ mb: 4 }}>
                <Paper sx={{ 
                    ...DESIGN_TOKENS.glassCard, 
                    p: 2, mb: 2, 
                    borderLeft: `4px solid ${PALETTE.accents.gold}`,
                    display: 'flex', flexDirection: 'column', gap: 2
                }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar sx={{ bgcolor: `${PALETTE.accents.gold}22`, color: PALETTE.accents.gold }}>
                            <HotelIcon />
                        </Avatar>
                        <Box>
                            <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600, color: PALETTE.accents.gold }}>
                                Elasthan Recovery Mode
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Struktur-Erholung läuft. Verbleibend: <strong>{recoveryInfo.remainingHours} Std.</strong>
                            </Typography>
                        </Box>
                    </Stack>
                    
                    <LinearProgress 
                        variant="determinate" 
                        value={recoveryInfo.progress} 
                        sx={{ 
                            borderRadius: 1, height: 6, 
                            bgcolor: `${PALETTE.accents.gold}22`,
                            '& .MuiLinearProgress-bar': { backgroundColor: PALETTE.accents.gold }
                        }} 
                    />
                    
                    <Button 
                        variant="outlined" 
                        size="small"
                        startIcon={<WarningAmberIcon />}
                        onClick={() => onStartSession(true)} // Force start
                        sx={{ 
                            justifyContent: 'flex-start',
                            color: PALETTE.accents.gold,
                            borderColor: `${PALETTE.accents.gold}66`,
                            '&:hover': { 
                                borderColor: PALETTE.accents.gold,
                                bgcolor: `${PALETTE.accents.gold}11`
                            }
                        }}
                    >
                        Trotzdem tragen (Verschleiß riskieren)
                    </Button>
                </Paper>
            </Box>
        );
    }

    // Fall 2: Normaler Start
    if (!isBusy) {
        return (
            <Box sx={{ mb: 4 }}>
                <Button 
                    variant="contained" fullWidth size="large"
                    onClick={() => onStartSession(false)}
                    startIcon={<PlayArrowIcon />}
                    sx={{ 
                        py: 1.5, fontWeight: 'bold', mb: 1,
                        ...DESIGN_TOKENS.buttonGradient
                    }}
                >
                    TRAGEN BEGINNEN
                </Button>
            </Box>
        );
    }

    // Fall 3: Wird getragen
    return (
        <Box sx={{ mb: 4 }}>
             <Paper sx={{ ...DESIGN_TOKENS.glassCard, p: 2, bgcolor: `${PALETTE.accents.green}20`, border: `1px solid ${PALETTE.accents.green}`, textAlign: 'center' }}>
                <Typography variant="h6" color="success.main" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                  <PlayArrowIcon /> WIRD GERADE GETRAGEN
                </Typography>
            </Paper>
        </Box>
    );
}

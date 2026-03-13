import React from 'react';
import { Box, Button, Paper, Typography, LinearProgress, Stack, Avatar } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import HotelIcon from '@mui/icons-material/Hotel'; 
import WarningAmberIcon from '@mui/icons-material/WarningAmber'; 
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';

export default function ActionPanel({ isBusy, recoveryInfo, onStartSession }) {
    
    // Fall 1: Recovery Mode
    if (recoveryInfo?.isResting && !isBusy) {
        return (
            <Box sx={{ mb: 4 }}>
                <Paper sx={{ 
                    ...DESIGN_TOKENS.glassCard, 
                    p: 2, mb: 2, 
                    borderLeft: `4px solid ${PALETTE.accents.blue}`,
                    display: 'flex', flexDirection: 'column', gap: 2
                }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar sx={{ bgcolor: `${PALETTE.accents.blue}22`, color: PALETTE.accents.blue }}>
                            <HotelIcon />
                        </Avatar>
                        <Box>
                            <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 800, color: PALETTE.accents.blue, textTransform: 'uppercase' }}>
                                Recovery Mode
                            </Typography>
                            <Typography variant="body2" sx={{ color: PALETTE.text.secondary }}>
                                Material-Erholung. Verbleibend: <strong style={{ color: '#FFF' }}>{recoveryInfo.remainingHours} Std.</strong>
                            </Typography>
                        </Box>
                    </Stack>
                    
                    <LinearProgress 
                        variant="determinate" 
                        value={recoveryInfo.progress} 
                        sx={{ 
                            borderRadius: 1, height: 6, 
                            bgcolor: `${PALETTE.accents.blue}22`,
                            '& .MuiLinearProgress-bar': { backgroundColor: PALETTE.accents.blue, filter: `drop-shadow(0 0 5px ${PALETTE.accents.blue})` }
                        }} 
                    />
                    
                    <Button 
                        variant="outlined" size="small" startIcon={<WarningAmberIcon />}
                        onClick={() => onStartSession(true)}
                        sx={{ 
                            justifyContent: 'flex-start', color: PALETTE.accents.blue, borderColor: `${PALETTE.accents.blue}66`,
                            borderRadius: '9999px', fontWeight: 'bold',
                            '&:hover': { borderColor: PALETTE.accents.blue, bgcolor: `${PALETTE.accents.blue}11` }
                        }}
                    >
                        Trotzdem tragen (Risk)
                    </Button>
                </Paper>
            </Box>
        );
    }

    // Fall 2: Startbereit (The massive pink pill)
    if (!isBusy) {
        return (
            <Box sx={{ mb: 4 }}>
                <Button 
                    variant="contained" fullWidth size="large"
                    onClick={() => onStartSession(false)}
                    startIcon={<PlayArrowIcon sx={{ fontSize: '1.8rem !important' }}/>}
                    sx={{ 
                        py: 2, fontWeight: 900, mb: 1, fontSize: '1.1rem',
                        ...DESIGN_TOKENS.buttonGradient, color: '#000' 
                    }}
                >
                    TRAGEN BEGINNEN
                </Button>
            </Box>
        );
    }

    // Fall 3: Aktiv (Lavender devotion)
    return (
        <Box sx={{ mb: 4 }}>
             <Paper sx={{ ...DESIGN_TOKENS.glassCard, p: 2, bgcolor: `${PALETTE.accents.green}20`, border: `1px solid ${PALETTE.accents.green}`, textAlign: 'center' }}>
                <Typography variant="h6" sx={{ color: PALETTE.accents.green, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>
                  <PlayArrowIcon /> WIRD GERADE GETRAGEN
                </Typography>
            </Paper>
        </Box>
    );
}
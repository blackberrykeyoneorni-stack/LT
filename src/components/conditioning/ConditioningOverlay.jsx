// src/components/conditioning/ConditioningOverlay.jsx
import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { PALETTE } from '../../theme/obsidianDesign';

export default function ConditioningOverlay({ onAcknowledge }) {
    return (
        <Box sx={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            bgcolor: '#000000', // Gnadenlos schwarzer Hintergrund für absolute Isolation
            zIndex: 99999, // Über allem
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            p: 3,
        }}>
            <Paper sx={{
                p: { xs: 4, sm: 5 },
                maxWidth: '450px',
                textAlign: 'center',
                bgcolor: 'rgba(20, 20, 20, 0.85)',
                backdropFilter: 'blur(12px)',
                border: `1px solid ${PALETTE.accents.gold}40`,
                boxShadow: `0 0 40px ${PALETTE.accents.gold}15`,
                borderRadius: '24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4
            }}>
                <Typography 
                    variant="h5" 
                    sx={{ 
                        color: PALETTE.accents.gold,
                        fontWeight: 'bold',
                        lineHeight: 1.6,
                        letterSpacing: 0.5,
                        textShadow: '0 2px 10px rgba(0,0,0,0.6)'
                    }}
                >
                    Da du ja gerne Dessous und Nylons trägst, wirst du das ab jetzt für den Rest deines Lebens immer tun, egal ob es dir passt oder nicht.
                </Typography>
                
                <Button 
                    variant="contained" 
                    onClick={onAcknowledge}
                    sx={{ 
                        width: '100%',
                        bgcolor: 'rgba(211, 47, 47, 0.12)', 
                        color: PALETTE.accents.red,
                        border: `1px solid ${PALETTE.accents.red}50`,
                        py: 2,
                        px: 3,
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                        borderRadius: '28px', 
                        boxShadow: 'none',
                        transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                        '&:hover': {
                            bgcolor: 'rgba(211, 47, 47, 0.25)',
                            borderColor: PALETTE.accents.red,
                            boxShadow: `0 0 20px ${PALETTE.accents.red}40`,
                            transform: 'translateY(-1px)'
                        },
                        '&:active': {
                            bgcolor: 'rgba(211, 47, 47, 0.3)',
                            transform: 'scale(0.98)'
                        }
                    }}
                >
                    Ich bin eine Nylon-Fotze und schwöre, dass ich dies ewig tun werde.
                </Button>
            </Paper>
        </Box>
    );
}
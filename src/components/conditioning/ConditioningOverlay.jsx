// src/components/conditioning/ConditioningOverlay.jsx
import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { keyframes } from '@mui/system';

// Aggressive Neon-Puls-Animation für den Button
const pulseNeon = keyframes`
  0% { box-shadow: 0 0 10px #FF1493, 0 0 5px #FF1493 inset; transform: scale(1); }
  50% { box-shadow: 0 0 30px #FF1493, 0 0 15px #FF1493 inset; transform: scale(1.02); }
  100% { box-shadow: 0 0 10px #FF1493, 0 0 5px #FF1493 inset; transform: scale(1); }
`;

export default function ConditioningOverlay({ onAcknowledge }) {
    return (
        <Box sx={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            // Dunkler, schmutziger Rotlicht-Verlauf im Hintergrund
            background: 'radial-gradient(circle at center, #4A0024 0%, #000000 85%)',
            zIndex: 99999, // Über allem
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            p: 3,
            
            // NYLON: Gepunktete Strumpfhose (Point d'esprit / Polka Dots)
            '&::before': {
                content: '""',
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundImage: `
                  radial-gradient(rgba(0,0,0,0.85) 15%, transparent 16%),
                  radial-gradient(rgba(0,0,0,0.85) 15%, transparent 16%)
                `,
                backgroundSize: '30px 30px',
                backgroundPosition: '0 0, 15px 15px',
                zIndex: -1,
                pointerEvents: 'none',
                opacity: 0.8
            }
        }}>
            <Paper sx={{
                position: 'relative',
                p: { xs: 4, sm: 5 },
                maxWidth: '450px',
                textAlign: 'center',
                
                // LATEX-GLANZ: Diagonaler Reflexions-Effekt über tiefem Schwarz-Pink
                background: 'linear-gradient(135deg, rgba(20, 0, 10, 0.95) 0%, rgba(20, 0, 10, 0.95) 45%, rgba(255, 105, 180, 0.15) 50%, rgba(20, 0, 10, 0.95) 55%, rgba(20, 0, 10, 0.95) 100%)',
                backdropFilter: 'blur(10px)',
                border: '2px solid #FF1493',
                boxShadow: '0 0 40px rgba(255, 20, 147, 0.5)',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                // overflow: visible erlaubt das Herausragen der Spitzen-Ränder
                overflow: 'visible', 
                
                // SPITZE: CSS-Applikation am oberen Rand
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: '-15px',
                    left: '10px',
                    right: '10px',
                    height: '30px',
                    background: 'radial-gradient(circle, transparent 40%, #FF1493 41%, #FF1493 46%, transparent 47%)',
                    backgroundSize: '30px 30px',
                    backgroundPosition: 'center',
                    zIndex: -1,
                    opacity: 0.9
                },
                // SPITZE: CSS-Applikation am unteren Rand
                '&::after': {
                    content: '""',
                    position: 'absolute',
                    bottom: '-15px',
                    left: '10px',
                    right: '10px',
                    height: '30px',
                    background: 'radial-gradient(circle, transparent 40%, #FF1493 41%, #FF1493 46%, transparent 47%)',
                    backgroundSize: '30px 30px',
                    backgroundPosition: 'center',
                    zIndex: -1,
                    opacity: 0.9
                }
            }}>
                <Typography 
                    variant="h5" 
                    sx={{ 
                        color: '#FF69B4', // Hot Pink
                        fontWeight: '900',
                        lineHeight: 1.3,
                        letterSpacing: 1.5,
                        textShadow: '0 0 10px #FF1493, 0 0 20px #FF1493, 0 0 30px #FF1493' // Starker Neon Glow
                    }}
                >
                    Da du ja so gerne Dessous und Nylons trägst, wirst du das ab jetzt für den Rest deines Lebens immer tun, egal ob es dir passt oder nicht.
                </Typography>
                
                <Button 
                    variant="contained" 
                    onClick={onAcknowledge}
                    sx={{ 
                        width: '100%',
                        bgcolor: '#FF1493', // Schreiendes Pink
                        color: '#FFFFFF',
                        border: '1px solid #FF69B4',
                        py: 2.5,
                        px: 3,
                        fontWeight: '900',
                        fontSize: '1rem',
                        letterSpacing: '1px',
                        borderRadius: '30px', 
                        animation: `${pulseNeon} 2s infinite`, // Pulsierender Zwang
                        transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                        '&:hover': {
                            bgcolor: '#C71585',
                            transform: 'scale(1.05)'
                        },
                        '&:active': {
                            transform: 'scale(0.95)'
                        }
                    }}
                >
                    Ich schwöre, dass ich für den Rest meines Lebens nur noch Dessous und Nylons tragen werde.
                </Button>
            </Paper>
        </Box>
    );
}
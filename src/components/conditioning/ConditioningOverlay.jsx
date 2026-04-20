import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { PALETTE } from '../../theme/obsidianDesign';

export default function ConditioningOverlay({ onAcknowledge }) {
    return (
        <Box sx={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            bgcolor: '#000000', // Gnadenlos schwarzer Hintergrund
            zIndex: 99999, // Liegt über allem, Navigation, Dialogen, etc.
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            p: 4,
            textAlign: 'center'
        }}>
            <Typography 
                variant="h5" 
                sx={{ 
                    color: PALETTE.accents.gold, // Gold steht für Autorität
                    fontWeight: 'bold',
                    mb: 6,
                    lineHeight: 1.6,
                    letterSpacing: 0.5
                }}
            >
                Da du ja gerne Dessous und Nylons trägst, wirst du das ab jetzt für den Rest deines Lebens immer tun, egal ob es dir passt oder nicht.
            </Typography>
            
            <Button 
                variant="contained" 
                onClick={onAcknowledge}
                sx={{ 
                    bgcolor: PALETTE.accents.red,
                    color: '#fff',
                    py: 2,
                    px: 3,
                    fontWeight: 'bold',
                    fontSize: '0.95rem',
                    textTransform: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 0 20px rgba(211, 47, 47, 0.4)', // Leichtes rotes Glühen
                    '&:hover': {
                        bgcolor: '#b71c1c'
                    }
                }}
            >
                Ich bin eine Nylon-Fotze und schwöre, dass ich dies ewig tun werde.
            </Button>
        </Box>
    );
}
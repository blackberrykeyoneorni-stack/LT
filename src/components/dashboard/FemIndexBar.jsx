import React, { useState } from 'react';
import { 
    Box, 
    Typography, 
    LinearProgress, 
    Dialog, 
    DialogTitle, 
    DialogContent, 
    IconButton,
    List,
    ListItem,
    ListItemText,
    Divider,
    Paper
} from '@mui/material';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';
import CalculateIcon from '@mui/icons-material/Calculate';
import { useFemIndex } from '../../hooks/dashboard/useFemIndex';
import { motion } from 'framer-motion';

export default function FemIndexBar() {
    const { femIndex, details } = useFemIndex();
    const [open, setOpen] = useState(false);

    // Farbe basierend auf Index berechnen
    const getColor = (value) => {
        if (value < 30) return PALETTE.accents.red;
        if (value < 70) return PALETTE.accents.gold;
        return PALETTE.accents.green;
    };

    const currentColor = getColor(femIndex);

    // Dialog öffnen
    const handleClick = () => {
        setOpen(true);
    };

    return (
        <>
            {/* Klickbarer Container */}
            <Box 
                onClick={handleClick}
                sx={{ 
                    width: '100%', 
                    mb: 2, 
                    cursor: 'pointer',
                    position: 'relative',
                    '&:hover': { opacity: 0.9 }
                }}
            >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    {/* HIER: Schrift exakt wie "Tagesziel" im ProgressBar (Caption, Secondary, Bold, Uppercase) */}
                    <Typography 
                        variant="caption" 
                        sx={{ 
                            color: 'text.secondary', 
                            fontWeight: 'bold',
                            textTransform: 'uppercase', // "Tagesziel" ist oft uppercase
                            letterSpacing: '0.5px'
                        }}
                    >
                        FEM-INDEX
                    </Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" fontWeight="bold" sx={{ color: currentColor }}>
                            {femIndex}%
                        </Typography>
                        <InfoIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                    </Box>
                </Box>

                <LinearProgress 
                    variant="determinate" 
                    value={femIndex} 
                    sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        bgcolor: 'rgba(255,255,255,0.05)',
                        '& .MuiLinearProgress-bar': {
                            bgcolor: currentColor,
                            borderRadius: 4
                        }
                    }} 
                />
            </Box>

            {/* OVERLAY: Berechnung */}
            <Dialog 
                open={open} 
                onClose={() => setOpen(false)}
                PaperProps={{ 
                    sx: DESIGN_TOKENS.dialog?.paper?.sx || { borderRadius: '20px', bgcolor: '#1e1e1e', p: 1 }
                }}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalculateIcon color="primary" />
                        <Typography variant="h6">Index Berechnung</Typography>
                    </Box>
                    <IconButton onClick={() => setOpen(false)} size="small">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                
                <DialogContent>
                    <Box sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="h2" sx={{ fontWeight: 'bold', color: currentColor }}>
                            {femIndex}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            AKTUELLER FEM-INDEX
                        </Typography>
                    </Box>
                    
                    <Divider sx={{ my: 2 }} />

                    <List dense>
                        {details.components.map((comp, index) => (
                            <ListItem key={index} sx={{ py: 1 }}>
                                <ListItemText 
                                    primary={comp.label}
                                    primaryTypographyProps={{ variant: 'body2' }}
                                />
                                {comp.value !== null && (
                                    <Typography 
                                        variant="body2" 
                                        fontWeight="bold"
                                        sx={{ 
                                            color: comp.type === 'positive' ? PALETTE.accents.green : 
                                                   comp.type === 'negative' ? PALETTE.accents.red : 'text.primary'
                                        }}
                                    >
                                        {comp.value > 0 && comp.type !== 'negative' ? '+' : ''}{comp.value}
                                    </Typography>
                                )}
                            </ListItem>
                        ))}
                    </List>

                    <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.1)' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                            FORMEL
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            (Basis - Denial + Bonus) x Faktor
                        </Typography>
                    </Paper>

                </DialogContent>
            </Dialog>
        </>
    );
}
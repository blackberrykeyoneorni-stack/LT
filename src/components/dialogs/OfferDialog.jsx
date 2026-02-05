import React, { useState } from 'react';
import { 
  Dialog, DialogContent, DialogActions, DialogTitle, 
  Typography, Box, Button, CircularProgress, Avatar 
} from '@mui/material';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import { motion, AnimatePresence } from 'framer-motion'; 
import CasinoIcon from '@mui/icons-material/Casino';
import ShieldIcon from '@mui/icons-material/Shield';
import LockIcon from '@mui/icons-material/Lock';

export default function OfferDialog({ open, stakeItems, onAccept, onDecline }) {
    const [isFlipping, setIsFlipping] = useState(false);

    const handlePlay = () => {
        setIsFlipping(true);
        // Künstliche Verzögerung für Spannung
        setTimeout(() => {
            onAccept(); // Trigger Logik im Parent
        }, 2000);
    };

    if (!stakeItems) return null;

    return (
        <Dialog 
            open={open} 
            disableEscapeKeyDown
            maxWidth="xs" 
            fullWidth 
            PaperProps={{ 
                sx: { 
                    ...DESIGN_TOKENS.dialog.paper.sx, 
                    border: `1px solid ${PALETTE.accents.gold}`,
                    boxShadow: `0 0 20px ${PALETTE.accents.gold}40`
                } 
            }}
        >
            <DialogTitle sx={{ ...DESIGN_TOKENS.dialog.title.sx, color: PALETTE.accents.gold, justifyContent: 'center' }}>
                <CasinoIcon sx={{ mr: 1 }} /> THE GAMBLE
            </DialogTitle>
            
            <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
                <Box sx={{ textAlign: 'center', py: 2 }}>
                    {!isFlipping ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#fff', mb: 3 }}>
                                ALLES ODER NICHTS
                            </Typography>
                            
                            {/* RISIKO VS GEWINN */}
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 4 }}>
                                <Box sx={{ textAlign: 'center', width: '45%' }}>
                                    <ShieldIcon sx={{ fontSize: 40, color: PALETTE.accents.green, mb: 1 }} />
                                    <Typography variant="body2" sx={{ color: PALETTE.accents.green, fontWeight: 'bold' }}>GEWINN</Typography>
                                    <Typography variant="caption" color="text.secondary">24h Immunität (Ruhe)</Typography>
                                </Box>
                                <Box sx={{ width: '1px', bgcolor: 'rgba(255,255,255,0.2)' }} />
                                <Box sx={{ textAlign: 'center', width: '45%' }}>
                                    <LockIcon sx={{ fontSize: 40, color: PALETTE.accents.red, mb: 1 }} />
                                    <Typography variant="body2" sx={{ color: PALETTE.accents.red, fontWeight: 'bold' }}>VERLUST</Typography>
                                    <Typography variant="caption" color="text.secondary">24h TZD sofort</Typography>
                                </Box>
                            </Box>

                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
                                Dein Einsatz
                            </Typography>
                            
                            {/* ITEM DISPLAY UPDATE: Name & ID sichtbar */}
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 2 }}>
                                {stakeItems.map(item => (
                                    <Box key={item.id} sx={{ position: 'relative', width: 100, textAlign: 'center' }}>
                                        <Avatar 
                                            src={item.imageUrl} 
                                            variant="rounded" 
                                            sx={{ 
                                                width: 70, 
                                                height: 70, 
                                                border: `1px solid ${PALETTE.accents.gold}`,
                                                mx: 'auto',
                                                mb: 1
                                            }} 
                                        />
                                        <Typography 
                                            variant="body2" 
                                            sx={{ fontWeight: 'bold', color: '#fff', lineHeight: 1.2, fontSize: '0.75rem', mb: 0.5 }}
                                            noWrap
                                        >
                                            {item.name || item.brand || 'Unbekannt'}
                                        </Typography>
                                        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: PALETTE.accents.gold, display: 'block' }}>
                                            {item.customId || 'ID ???'}
                                        </Typography>
                                        <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', display: 'block' }}>
                                            {item.subCategory}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        </motion.div>
                    ) : (
                        <Box sx={{ py: 6 }}>
                            <CircularProgress sx={{ color: PALETTE.accents.gold }} />
                            <Typography variant="overline" sx={{ display: 'block', mt: 2, animation: 'pulse 1s infinite' }}>
                                FATE IS DECIDING...
                            </Typography>
                        </Box>
                    )}
                </Box>
            </DialogContent>

            {!isFlipping && (
                <DialogActions sx={{ ...DESIGN_TOKENS.dialog.actions.sx, flexDirection: 'column', gap: 1 }}>
                    <Button 
                        fullWidth 
                        variant="contained" 
                        onClick={handlePlay}
                        sx={{ 
                            bgcolor: PALETTE.accents.gold, 
                            color: '#000', 
                            fontWeight: 'bold',
                            '&:hover': { bgcolor: '#fff' } 
                        }}
                    >
                        SPIELEN (RISIKO)
                    </Button>
                    <Button 
                        fullWidth 
                        onClick={onDecline} 
                        color="inherit"
                        sx={{ opacity: 0.6 }}
                    >
                        Ablehnen (Sicher)
                    </Button>
                </DialogActions>
            )}
        </Dialog>
    );
}
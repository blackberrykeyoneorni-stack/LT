import React, { useState } from 'react';
import { 
  Dialog, DialogContent, DialogActions, DialogTitle, 
  Typography, Box, Button, CircularProgress, Avatar 
} from '@mui/material';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import { motion } from 'framer-motion'; 
import CasinoIcon from '@mui/icons-material/Casino';
import ShieldIcon from '@mui/icons-material/Shield';
import LockIcon from '@mui/icons-material/Lock';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';

export default function OfferDialog({ open, stakeItems, onAccept, onDecline, hasActiveSession, isForced }) {
    const [isFlipping, setIsFlipping] = useState(false);

    const handlePlay = () => {
        setIsFlipping(true);
        setTimeout(() => {
            onAccept(); 
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
                    border: `1px solid ${isForced ? PALETTE.accents.red : PALETTE.accents.gold}`,
                    boxShadow: `0 0 20px ${isForced ? PALETTE.accents.red : PALETTE.accents.gold}40`
                } 
            }}
        >
            <DialogTitle sx={{ ...DESIGN_TOKENS.dialog.title.sx, color: isForced ? PALETTE.accents.red : PALETTE.accents.gold, justifyContent: 'center' }}>
                <CasinoIcon sx={{ mr: 1 }} /> THE GAMBLE
            </DialogTitle>
            
            <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
                <Box sx={{ textAlign: 'center', py: 2 }}>
                    {!isFlipping ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <Typography variant="h5" sx={{ fontWeight: 'bold', color: isForced ? PALETTE.accents.red : '#fff', mb: isForced ? 1 : 3 }}>
                                {isForced ? "KONTROLLÜBERNAHME" : "ALLES ODER NICHTS"}
                            </Typography>

                            {isForced && (
                                <Typography variant="body2" sx={{ color: PALETTE.accents.red, mb: 3, fontWeight: 'bold' }}>
                                    DEIN FLUCHTKONTINGENT IST ERSCHÖPFT. DAS SYSTEM ERZWINGT DIESES SPIEL.
                                </Typography>
                            )}
                            
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
                                    <Typography variant="caption" color="text.secondary">24h Spiel-TZD</Typography>
                                </Box>
                            </Box>

                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
                                Es stehen {stakeItems.length} Items auf dem Spiel.<br/>Zwei sind bekannt, eines ist dein Restrisiko.
                            </Typography>
                            
                            {/* ITEM DISPLAY */}
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 2 }}>
                                {stakeItems.map((item, index) => (
                                    <Box key={item.id || index} sx={{ position: 'relative', width: 90, textAlign: 'center' }}>
                                        {item.isMystery ? (
                                            <>
                                                <Avatar 
                                                    variant="rounded" 
                                                    sx={{ 
                                                        width: 70, height: 70, mx: 'auto', mb: 1,
                                                        border: `1px dashed ${isForced ? PALETTE.accents.red : PALETTE.accents.gold}`,
                                                        bgcolor: 'rgba(0,0,0,0.5)',
                                                        color: isForced ? PALETTE.accents.red : PALETTE.accents.gold,
                                                        fontWeight: 'bold', fontSize: '1.5rem'
                                                    }} 
                                                >
                                                    ?
                                                </Avatar>
                                                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#fff', lineHeight: 1.2, fontSize: '0.75rem', mb: 0.5 }} noWrap>
                                                    Mystery Item
                                                </Typography>
                                                <Typography variant="caption" sx={{ fontSize: '0.65rem', color: isForced ? PALETTE.accents.red : PALETTE.accents.gold, display: 'block' }}>
                                                    Ungewisses Schicksal
                                                </Typography>
                                            </>
                                        ) : (
                                            <>
                                                <Avatar 
                                                    src={item.imageUrl} 
                                                    variant="rounded" 
                                                    sx={{ 
                                                        width: 70, height: 70, mx: 'auto', mb: 1,
                                                        border: `1px solid ${isForced ? PALETTE.accents.red : PALETTE.accents.gold}`
                                                    }} 
                                                />
                                                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#fff', lineHeight: 1.2, fontSize: '0.75rem', mb: 0.5 }} noWrap>
                                                    {item.name || item.brand || 'Unbekannt'}
                                                </Typography>
                                                <Typography variant="caption" sx={{ fontSize: '0.65rem', color: isForced ? PALETTE.accents.red : PALETTE.accents.gold, display: 'block' }}>
                                                    {item.customId || 'ID ???'}
                                                </Typography>
                                                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', display: 'block' }}>
                                                    {item.subCategory}
                                                </Typography>
                                            </>
                                        )}
                                    </Box>
                                ))}
                            </Box>

                            {/* SYSTEM OVERRIDE WARNUNG */}
                            {hasActiveSession && (
                                <Box sx={{ 
                                    mt: 2, 
                                    p: 1.5, 
                                    bgcolor: 'rgba(255, 0, 0, 0.1)', 
                                    border: `1px solid ${PALETTE.accents.red}`,
                                    borderRadius: '8px' 
                                }}>
                                    <Typography variant="caption" sx={{ color: PALETTE.accents.red, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, fontWeight: 'bold' }}>
                                        <ReportProblemIcon fontSize="small" />
                                        ACHTUNG: SYSTEM OVERRIDE
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                                        Deine laufende Session wird bei Verlust sofort und ohne Rückfrage terminiert.
                                    </Typography>
                                </Box>
                            )}

                        </motion.div>
                    ) : (
                        <Box sx={{ py: 6 }}>
                            <CircularProgress sx={{ color: isForced ? PALETTE.accents.red : PALETTE.accents.gold }} />
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
                            bgcolor: isForced ? PALETTE.accents.red : PALETTE.accents.gold, 
                            color: '#000', 
                            fontWeight: 'bold',
                            '&:hover': { bgcolor: '#fff' } 
                        }}
                    >
                        SPIELEN (RISIKO)
                    </Button>
                    
                    {!isForced && (
                        <Button 
                            fullWidth 
                            onClick={onDecline} 
                            color="inherit"
                            sx={{ opacity: 0.6 }}
                        >
                            Ablehnen (Sicher)
                        </Button>
                    )}
                </DialogActions>
            )}
        </Dialog>
    );
}
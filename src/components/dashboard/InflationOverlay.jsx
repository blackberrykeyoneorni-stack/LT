import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, Button } from '@mui/material';
import { PALETTE, DESIGN_TOKENS } from '../../theme/obsidianDesign';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';

export default function InflationOverlay({ open, noticeData, onAcknowledge }) {
    if (!noticeData) return null;

    return (
        <Dialog 
            open={open} 
            disableEscapeKeyDown 
            PaperProps={{ 
                sx: { 
                    ...DESIGN_TOKENS.dialog.paper.sx, 
                    border: `1px solid ${PALETTE.accents.red}`, 
                    boxShadow: `0 0 20px ${PALETTE.accents.red}40` 
                } 
            }}
        >
            <DialogTitle sx={{ ...DESIGN_TOKENS.dialog.title.sx, color: PALETTE.accents.red, justifyContent: 'center' }}>
                <AccountBalanceWalletIcon sx={{ mr: 1 }} /> WÖCHENTLICHER TRIBUT
            </DialogTitle>
            <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
                <Box sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="body2" sx={{ mb: 4, color: 'text.secondary' }}>
                        Der wöchentliche Tribut von 10% wurde zum Stichtag (Sonntag, 23:00 Uhr) von deinen positiven Salden eingezogen.
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
                        {noticeData.deductedNc > 0 && (
                            <Box sx={{ p: 2, bgcolor: 'rgba(255,0,0,0.1)', border: `1px solid ${PALETTE.accents.red}`, borderRadius: 2 }}>
                                <Typography variant="caption" color="text.secondary" display="block">Nylon Credits (NC)</Typography>
                                <Typography variant="h4" sx={{ color: PALETTE.accents.red, fontWeight: 'bold' }}>
                                    -{noticeData.deductedNc}
                                </Typography>
                            </Box>
                        )}
                        {noticeData.deductedLc > 0 && (
                            <Box sx={{ p: 2, bgcolor: 'rgba(255,0,0,0.1)', border: `1px solid ${PALETTE.accents.red}`, borderRadius: 2 }}>
                                <Typography variant="caption" color="text.secondary" display="block">Lingerie Credits (LC)</Typography>
                                <Typography variant="h4" sx={{ color: PALETTE.accents.red, fontWeight: 'bold' }}>
                                    -{noticeData.deductedLc}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                    
                    <Typography variant="caption" sx={{ color: PALETTE.accents.red, display: 'block', mt: 4, fontWeight: 'bold' }}>
                        LUXUS IST EIN PRIVILEG, KEIN RECHT.
                    </Typography>
                </Box>
            </DialogContent>
            <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
                <Button 
                    fullWidth 
                    variant="contained" 
                    onClick={onAcknowledge} 
                    sx={{ bgcolor: PALETTE.accents.red, color: '#000', fontWeight: 'bold', '&:hover': { bgcolor: '#fff' } }}
                >
                    TRIBUT AKZEPTIEREN
                </Button>
            </DialogActions>
        </Dialog>
    );
}
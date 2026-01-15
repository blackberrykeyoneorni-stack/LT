import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, CircularProgress } from '@mui/material';
import NfcIcon from '@mui/icons-material/Nfc';
import WarningIcon from '@mui/icons-material/Warning';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import { motion } from 'framer-motion';

export default function PunishmentDialog({ open, onClose, mode, punishmentItem, isScanning, onScan }) {
    const isStart = mode === 'start';
    const title = isStart ? "Strafe antreten" : "Strafe beenden";
    const instruction = isStart 
        ? "Scanne den NFC-Tag des Straf-Items, um die Session zu beginnen."
        : "Scanne den NFC-Tag, um die Strafe offiziell zu beenden.";

    // Farbe basierend auf Modus (Rot für Start, Standard für Ende)
    const activeColor = isStart ? PALETTE.accents.red : PALETTE.primary.main;

    return (
        <Dialog 
            open={open} 
            onClose={!isScanning ? onClose : undefined} 
            maxWidth="xs" 
            fullWidth
            PaperProps={DESIGN_TOKENS.dialog.paper}
        >
            <DialogTitle sx={{ ...DESIGN_TOKENS.dialog.title.sx, color: activeColor }}>
                {isStart ? <WarningIcon sx={{mr:1}}/> : <LockOpenIcon sx={{mr:1}}/>}
                {title}
            </DialogTitle>
            
            <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
                <Box sx={{ textAlign: 'center', py: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    
                    {/* Item Name */}
                    {punishmentItem && (
                        <Typography variant="h6" sx={{ color: PALETTE.text.primary, fontWeight: 'bold' }}>
                            {punishmentItem.name || "Straf-Item"}
                        </Typography>
                    )}

                    {/* Instruction */}
                    <Typography variant="body2" color="text.secondary">
                        {instruction}
                    </Typography>

                    {/* Scan Animation / Button */}
                    <Box sx={{ position: 'relative', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>
                        {isScanning && (
                            <Box sx={{ position: 'absolute' }}>
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                >
                                    <CircularProgress size={90} sx={{ color: activeColor, opacity: 0.5 }} thickness={2} />
                                </motion.div>
                            </Box>
                        )}
                        
                        <Button 
                            variant="outlined"
                            onClick={onScan}
                            disabled={isScanning}
                            sx={{ 
                                width: 80, height: 80, borderRadius: '50%', 
                                borderColor: activeColor,
                                color: activeColor,
                                borderWidth: 2,
                                '&:hover': { borderWidth: 2, bgcolor: 'rgba(255,255,255,0.05)', borderColor: activeColor }
                            }}
                        >
                            <NfcIcon sx={{ fontSize: 40 }} />
                        </Button>
                    </Box>

                    <Typography variant="caption" sx={{ color: isScanning ? PALETTE.text.primary : PALETTE.text.muted }}>
                        {isScanning ? "Suche nach NFC Tag..." : "Tippe zum Scannen"}
                    </Typography>

                </Box>
            </DialogContent>

            <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
                <Button onClick={onClose} disabled={isScanning} color="inherit">
                    Abbrechen
                </Button>
            </DialogActions>
        </Dialog>
    );
}
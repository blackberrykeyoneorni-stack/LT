import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';

export default function PunishmentDialog({ open, onClose, mode, punishmentItem, isScanning, onScan }) {
    const isStart = mode === 'start';
    const title = isStart ? "Strafe antreten" : "Strafe beenden";
    
    // Das spezifisch zugewiesene Instrument anzeigen
    const instrument = (punishmentItem && punishmentItem.instrument) || "Vorgeschriebenes Instrument";
    
    const instruction = isStart 
        ? "Setze das folgende Instrument ein und bestätige den Vollzug auf deinen Honor Code."
        : "Die Strafzeit ist abgelaufen. Du darfst das Instrument nun entfernen.";

    const activeColor = isStart ? PALETTE.accents.red : PALETTE.primary.main;

    return (
        <Dialog 
            open={open} 
            onClose={undefined} // Zwingt zur Interaktion
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
                    
                    <Typography variant="h5" sx={{ color: activeColor, fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {instrument}
                    </Typography>

                    <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
                        {instruction}
                    </Typography>

                    {/* Button fungiert als Honor Code Bestätigung */}
                    <Button 
                        variant="contained"
                        onClick={onScan}
                        disabled={isScanning}
                        startIcon={<VerifiedUserIcon />}
                        sx={{ 
                            mt: 2,
                            py: 1.5, px: 3, 
                            bgcolor: activeColor,
                            color: isStart ? '#ffffff' : '#000000',
                            fontWeight: 'bold',
                            '&:hover': { bgcolor: activeColor, filter: 'brightness(0.8)' }
                        }}
                    >
                        {isScanning ? "Wird verarbeitet..." : (isStart ? "Einsetzen bestätigt" : "Entfernen bestätigt")}
                    </Button>

                    <Typography variant="caption" sx={{ color: PALETTE.text.muted }}>
                        Honor Code: Meine Bestätigung ist absolut bindend.
                    </Typography>

                </Box>
            </DialogContent>

            <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
                <Button onClick={onClose} disabled={isScanning} color="inherit">
                    Später
                </Button>
            </DialogActions>
        </Dialog>
    );
}
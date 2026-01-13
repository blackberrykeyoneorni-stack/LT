import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign'; // NEU

export default function PunishmentDialog({ open, onClose, activePunishment, onResolve }) {
  return (
    <Dialog 
        open={open} onClose={onClose} maxWidth="xs" fullWidth
        PaperProps={{
            ...DESIGN_TOKENS.dialog.paper,
            sx: {
                ...DESIGN_TOKENS.dialog.paper.sx,
                border: `1px solid ${PALETTE.accents.red}`, // Override für Alarm-Look
                boxShadow: `0 0 30px ${PALETTE.accents.red}40`
            }
        }}
    >
        <DialogTitle sx={{ ...DESIGN_TOKENS.dialog.title.sx, color: PALETTE.accents.red }}>
            <WarningIcon /> Aktive Strafe
        </DialogTitle>
        <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
            <Box sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h6" gutterBottom>{activePunishment?.reason || "Verstoß"}</Typography>
                <Typography variant="body2" color="text.secondary">
                    Dauer: {activePunishment?.durationMinutes} Minuten
                </Typography>
                <Typography variant="caption" display="block" sx={{ mt: 2, color: PALETTE.accents.red }}>
                    Die Strafe muss vollständig abgesessen werden.
                </Typography>
            </Box>
        </DialogContent>
        <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
            <Button onClick={onClose} fullWidth color="inherit">Schließen</Button>
            {/* Optional: Resolve Button falls Logik existiert */}
        </DialogActions>
    </Dialog>
  );
}
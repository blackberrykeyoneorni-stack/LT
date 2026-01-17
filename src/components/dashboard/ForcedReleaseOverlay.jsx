import React from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    Typography, Button, Box, Paper 
} from '@mui/material';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PanToolIcon from '@mui/icons-material/PanTool'; // Hand
import SmartToyIcon from '@mui/icons-material/SmartToy'; // Toy

export default function ForcedReleaseOverlay({ open, method, onConfirm, onRefuse }) {
    if (!open) return null;

    // Mapping Methode -> Anzeige
    let methodLabel = "Manuell";
    let MethodIcon = PanToolIcon;
    let description = "Mache es dir mit deiner Hand.";

    if (method === 'toy_vaginal') {
        methodLabel = "Toy (Vaginal)";
        MethodIcon = SmartToyIcon;
        description = "Steck deinen Schwanz in die Fotze deines Spielzeugs.";
    } else if (method === 'toy_anal') {
        methodLabel = "Toy (Anal)";
        MethodIcon = SmartToyIcon;
        description = "benutze die Arschfotze deines Masturbators.";
    }

    return (
        <Dialog 
            open={open} 
            // Kein onClose Handler -> Dialog ist modal und zwingend
            fullWidth 
            maxWidth="xs" 
            PaperProps={{
                ...DESIGN_TOKENS.dialog.paper,
                sx: {
                    ...DESIGN_TOKENS.dialog.paper.sx,
                    border: `2px solid ${PALETTE.accents.red}`, // Roter Rahmen für Alarm
                    bgcolor: '#1a0505' // Dunkelroter Hintergrund
                }
            }}
        >
            <DialogTitle sx={{ textAlign: 'center', color: PALETTE.accents.red, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <WarningAmberIcon sx={{ fontSize: 50 }} />
                <Typography variant="h5" fontWeight="bold">PROTOKOLL INTERVENTION</Typography>
            </DialogTitle>

            <DialogContent sx={{ textAlign: 'center', py: 3 }}>
                <Typography variant="body1" sx={{ mb: 3 }}>
                    Bevor du schlafen darfst, wird ein Tribut deines Spermas gefordert.
                    Du trägst bereits deine Dessous und Nylons. Es gibt kein Zurück.
                </Typography>

                <Paper sx={{ 
                    p: 3, 
                    bgcolor: 'rgba(255,0,0,0.1)', 
                    border: `1px solid ${PALETTE.accents.red}`,
                    mb: 3,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1
                }}>
                    <MethodIcon sx={{ fontSize: 40, color: PALETTE.text.primary }} />
                    <Typography variant="h6" color="primary">{methodLabel}</Typography>
                    <Typography variant="caption" color="text.secondary">{description}</Typography>
                </Paper>

                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    Verweigerung führt zu sofortiger Bestrafung. Die Nacht-Session bleibt dennoch aktiv.
                </Typography>
            </DialogContent>

            <DialogActions sx={{ p: 2, flexDirection: 'column', gap: 1 }}>
                <Button 
                    variant="contained" 
                    fullWidth 
                    size="large"
                    onClick={onConfirm}
                    sx={{ 
                        bgcolor: PALETTE.accents.red, 
                        color: '#fff',
                        fontWeight: 'bold',
                        py: 1.5,
                        '&:hover': { bgcolor: '#d32f2f' }
                    }}
                >
                    PROTOKOLL AUSFÜHREN
                </Button>

                <Button 
                    variant="text" 
                    fullWidth
                    onClick={onRefuse}
                    sx={{ color: 'text.secondary', fontSize: '0.8rem' }}
                >
                    Verweigern (Bestrafung akzeptieren)
                </Button>
            </DialogActions>
        </Dialog>
    );
}
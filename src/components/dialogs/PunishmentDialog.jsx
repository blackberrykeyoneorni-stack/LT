import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Grid } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';

export default function PunishmentDialog({ open, onClose, pendingPunishments, items, isScanning, onScanTrigger }) {
    const [selectedInstrument, setSelectedInstrument] = useState(null);

    // Identifiziere das älteste Ticket aus dem Ledger
    const activeTicket = pendingPunishments && pendingPunishments.length > 0 ? pendingPunishments[0] : null;

    // Finde die spezifischen Werkzeuge im Inventar
    const plugItem = items?.find(i => i.subCategory === 'Buttplug' && i.status === 'active');
    const dildoItem = items?.find(i => i.subCategory === 'Dildo' && i.status === 'active');

    const handleSelect = (instrument) => {
        setSelectedInstrument(instrument);
    };

    const handleScan = () => {
        if (!selectedInstrument || !activeTicket) return;
        const targetItem = selectedInstrument === 'plug' ? plugItem : dildoItem;
        
        // Übergibt Ticket-ID, gewählten Faktor und das NFC-Ziel an das Dashboard
        onScanTrigger(activeTicket.id, selectedInstrument, targetItem);
    };

    // Reset der Auswahl, wenn der Dialog schließt
    useEffect(() => {
        if (!open) setSelectedInstrument(null);
    }, [open]);

    if (!activeTicket) return null;

    return (
        <Dialog 
            open={open} 
            onClose={undefined} // Zwingt zur Entscheidung
            maxWidth="sm" 
            fullWidth
            PaperProps={DESIGN_TOKENS.dialog.paper}
        >
            <DialogTitle sx={{ ...DESIGN_TOKENS.dialog.title.sx, color: PALETTE.accents.red, textAlign: 'center' }}>
                <WarningIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                INSTRUMENTEN-TRIBUNAL
            </DialogTitle>
            
            <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
                <Box sx={{ textAlign: 'center', py: 2 }}>
                    
                    <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 2 }}>
                        VERGEHEN REGISTRIERT
                    </Typography>
                    <Typography variant="h6" sx={{ color: PALETTE.accents.red, mb: 3, fontStyle: 'italic' }}>
                        "{activeTicket.reason}"
                    </Typography>

                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4, px: 2 }}>
                        Das System hat eine Strafzeit generiert. Diese bleibt für dich unsichtbar. Wähle nun dein Instrument für den Vollzug. Deine Wahl beeinflusst den Straf-Multiplikator.
                    </Typography>

                    {!selectedInstrument ? (
                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                <Button 
                                    variant="outlined"
                                    fullWidth
                                    disabled={!plugItem}
                                    onClick={() => handleSelect('plug')}
                                    sx={{ 
                                        height: '100%', py: 3, flexDirection: 'column', 
                                        borderColor: 'rgba(255,255,255,0.2)', color: '#fff',
                                        '&:hover': { borderColor: PALETTE.accents.red, bgcolor: 'rgba(255,0,0,0.05)' }
                                    }}
                                >
                                    <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>Buttplug</Typography>
                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>Passiver Vollzug</Typography>
                                    <Typography variant="caption" sx={{ color: PALETTE.accents.red, fontWeight: 'bold', mt: 1 }}>Volle Zeit (1.0x)</Typography>
                                    {!plugItem && <Typography variant="caption" color="error" sx={{ mt: 1 }}>Nicht im Inventar</Typography>}
                                </Button>
                            </Grid>
                            <Grid item xs={6}>
                                <Button 
                                    variant="outlined"
                                    fullWidth
                                    disabled={!dildoItem}
                                    onClick={() => handleSelect('dildo')}
                                    sx={{ 
                                        height: '100%', py: 3, flexDirection: 'column', 
                                        borderColor: 'rgba(255,255,255,0.2)', color: '#fff',
                                        '&:hover': { borderColor: PALETTE.accents.red, bgcolor: 'rgba(255,0,0,0.05)' }
                                    }}
                                >
                                    <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>Dildo</Typography>
                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>Aktive Penetration</Typography>
                                    <Typography variant="caption" sx={{ color: PALETTE.accents.green, fontWeight: 'bold', mt: 1 }}>Halbe Zeit (0.5x)</Typography>
                                    {!dildoItem && <Typography variant="caption" color="error" sx={{ mt: 1 }}>Nicht im Inventar</Typography>}
                                </Button>
                            </Grid>
                        </Grid>
                    ) : (
                        <Box sx={{ mt: 2, p: 3, border: `1px solid ${PALETTE.accents.red}`, borderRadius: 2, bgcolor: 'rgba(255,0,0,0.05)' }}>
                            <Typography variant="subtitle1" sx={{ color: '#fff', mb: 2 }}>
                                Wahl geloggt: <strong>{selectedInstrument === 'plug' ? 'Buttplug (1.0x)' : 'Dildo (0.5x)'}</strong>
                            </Typography>
                            <Button 
                                variant="contained"
                                fullWidth
                                onClick={handleScan}
                                disabled={isScanning}
                                startIcon={<VerifiedUserIcon />}
                                sx={{ 
                                    py: 2,
                                    bgcolor: PALETTE.accents.red,
                                    color: '#fff',
                                    fontWeight: 'bold',
                                    '&:hover': { bgcolor: '#b71c1c' }
                                }}
                            >
                                {isScanning ? "Warte auf NFC Scan..." : "NFC SCAN: URTEIL EMPFANGEN"}
                            </Button>
                            <Button size="small" sx={{ mt: 2, color: 'text.secondary' }} onClick={() => setSelectedInstrument(null)} disabled={isScanning}>
                                Auswahl ändern
                            </Button>
                        </Box>
                    )}

                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 2, pt: 0, justifyContent: 'center' }}>
                <Button onClick={onClose} disabled={isScanning} sx={{ color: 'text.secondary' }}>
                    Abbrechen
                </Button>
            </DialogActions>
        </Dialog>
    );
}
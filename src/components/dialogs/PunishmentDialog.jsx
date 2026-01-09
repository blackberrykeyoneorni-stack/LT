import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, Button, CircularProgress } from '@mui/material';
import LockClockIcon from '@mui/icons-material/LockClock';
import NfcIcon from '@mui/icons-material/Nfc';
import { PALETTE } from '../../theme/obsidianDesign';

export default function PunishmentDialog({ 
  open, 
  onClose, 
  mode, // 'start' oder 'stop'
  punishmentItem, 
  isScanning, 
  onScan 
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle sx={{ bgcolor: PALETTE.accents.red, color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
            <LockClockIcon /> {mode === 'start' ? "STRAFE BEGINNEN" : "STRAFE BEENDEN"}
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" gutterBottom>
                {mode === 'start' ? "Lege die Fessel an!" : "Darfst du die Fessel lösen?"}
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
                Scanne den NFC-Tag des Straf-Items ({punishmentItem?.name || "Buttplug"}), um fortzufahren.
            </Typography>
            
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                <Button 
                    variant="contained" 
                    color="error" 
                    size="large" 
                    onClick={onScan} 
                    disabled={isScanning}
                    startIcon={isScanning ? <CircularProgress size={20} color="inherit" /> : <NfcIcon />}
                    sx={{ py: 2, px: 4, fontSize: '1.2rem', borderRadius: 10 }}
                >
                    {isScanning ? "Suche Tag..." : "JETZT SCANNEN"}
                </Button>
            </Box>
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose} color="inherit">Abbrechen</Button>
        </DialogActions>
    </Dialog>
  );
}

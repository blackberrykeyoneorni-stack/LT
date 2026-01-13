import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Slider, Box, ToggleButton, ToggleButtonGroup } from '@mui/material';
import SpaIcon from '@mui/icons-material/Spa';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign'; // NEU

export default function ReleaseProtocolDialog({ open, onClose, onRegister }) {
  const [intensity, setIntensity] = useState(5);
  const [outcome, setOutcome] = useState('ruined');

  const handleSubmit = () => {
      onRegister(outcome, intensity);
      onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={DESIGN_TOKENS.dialog.paper}>
        <DialogTitle sx={{ ...DESIGN_TOKENS.dialog.title.sx, color: PALETTE.accents.pink }}>
            <SpaIcon /> Release Protokoll
        </DialogTitle>
        <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
            <Typography gutterBottom>Intensität (1-10)</Typography>
            <Slider 
                value={intensity} onChange={(e, v) => setIntensity(v)} 
                min={1} max={10} marks 
                sx={{ color: PALETTE.accents.pink, mb: 3 }} 
            />
            
            <Typography gutterBottom>Ergebnis</Typography>
            <ToggleButtonGroup 
                value={outcome} exclusive onChange={(e, v) => v && setOutcome(v)} 
                fullWidth orientation="vertical"
                sx={{ gap: 1 }}
            >
                <ToggleButton value="full" sx={{ borderColor: 'rgba(255,255,255,0.2)', color: 'white', '&.Mui-selected': { bgcolor: `${PALETTE.accents.pink}40`, color: 'white' } }}>
                    Full Release
                </ToggleButton>
                <ToggleButton value="ruined" sx={{ borderColor: 'rgba(255,255,255,0.2)', color: 'white', '&.Mui-selected': { bgcolor: `${PALETTE.accents.purple}40`, color: 'white' } }}>
                    Ruined / Denied
                </ToggleButton>
                <ToggleButton value="leaked" sx={{ borderColor: 'rgba(255,255,255,0.2)', color: 'white', '&.Mui-selected': { bgcolor: `${PALETTE.accents.blue}40`, color: 'white' } }}>
                    Leaked / Pre-Cum
                </ToggleButton>
            </ToggleButtonGroup>
        </DialogContent>
        <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
            <Button onClick={onClose} color="inherit">Abbrechen</Button>
            <Button variant="contained" onClick={handleSubmit} sx={{ bgcolor: PALETTE.accents.pink }}>Protokollieren</Button>
        </DialogActions>
    </Dialog>
  );
}
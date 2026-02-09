import React, { useState } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    Button, Typography, Slider, Box, ToggleButton, ToggleButtonGroup,
    CircularProgress 
} from '@mui/material';
import SpaIcon from '@mui/icons-material/Spa';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';

export default function ReleaseProtocolDialog({ 
    open, onClose, 
    step, timer, 
    intensity, setIntensity, 
    onStartTimer, onSkipTimer, onDecision 
}) {
  const [outcome, setOutcome] = useState('ruined');

  // Helper: Sekunden zu MM:SS formatieren
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const renderContent = () => {
      switch(step) {
          case 'confirm':
              return (
                  <Box sx={{ textAlign: 'center', py: 2 }}>
                      <AccessTimeIcon sx={{ fontSize: 60, color: PALETTE.primary.main, mb: 2 }} />
                      <Typography variant="h6" gutterBottom>Edging Phase</Typography>
                      <Typography variant="body2" color="text.secondary">
                          Das Protokoll schreibt eine 10-minütige Edging-Phase vor.
                          Halte die Erregung hoch, aber komme nicht zum Höhepunkt.
                      </Typography>
                  </Box>
              );
          case 'timer':
              return (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                          <CircularProgress 
                            variant="determinate" 
                            value={(1 - timer/600)*100} 
                            size={120} 
                            thickness={2} 
                            sx={{ color: PALETTE.primary.main }} 
                          />
                          <Box sx={{ top: 0, left: 0, bottom: 0, right: 0, position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Typography variant="h4" component="div" color="text.primary">
                                  {formatTime(timer)}
                              </Typography>
                          </Box>
                      </Box>
                      <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary' }}>
                          Halten...
                      </Typography>
                  </Box>
              );
          case 'decision':
              return (
                  <Box>
                      <Typography gutterBottom color="text.secondary">Intensität (1-10)</Typography>
                      <Slider 
                          value={intensity} 
                          onChange={(e, v) => setIntensity(v)} 
                          min={1} max={10} marks 
                          sx={{ color: PALETTE.accents.pink, mb: 3 }} 
                      />
                      
                      <Typography gutterBottom color="text.secondary">Ergebnis</Typography>
                      <ToggleButtonGroup 
                          value={outcome} 
                          exclusive 
                          onChange={(e, v) => v && setOutcome(v)} 
                          fullWidth 
                          orientation="vertical"
                          sx={{ gap: 1 }}
                      >
                          <ToggleButton value="full" sx={{ borderColor: 'rgba(255,255,255,0.1)', color: 'text.secondary', '&.Mui-selected': { bgcolor: `${PALETTE.accents.pink}20`, color: '#fff', borderColor: PALETTE.accents.pink } }}>
                              Full Release
                          </ToggleButton>
                          <ToggleButton value="ruined" sx={{ borderColor: 'rgba(255,255,255,0.1)', color: 'text.secondary', '&.Mui-selected': { bgcolor: `${PALETTE.accents.purple}20`, color: '#fff', borderColor: PALETTE.accents.purple } }}>
                              Ruined / Denied
                          </ToggleButton>
                          <ToggleButton value="leaked" sx={{ borderColor: 'rgba(255,255,255,0.1)', color: 'text.secondary', '&.Mui-selected': { bgcolor: `${PALETTE.accents.blue}20`, color: '#fff', borderColor: PALETTE.accents.blue } }}>
                              Leaked / Pre-Cum
                          </ToggleButton>
                      </ToggleButtonGroup>
                  </Box>
              );
          default:
              return null;
      }
  };

  const renderActions = () => {
      switch(step) {
          case 'confirm':
              return (
                  <>
                      <Button onClick={onClose} color="inherit">Abbrechen</Button>
                      <Button variant="contained" onClick={onStartTimer} sx={{ bgcolor: PALETTE.primary.main }}>Timer Starten</Button>
                  </>
              );
          case 'timer':
              return (
                  <>
                      <Button onClick={onClose} color="inherit">Abbrechen</Button>
                      <Button onClick={onSkipTimer} color="warning">Überspringen</Button>
                  </>
              );
          case 'decision':
              return (
                  <>
                      <Button onClick={onClose} color="inherit">Abbrechen</Button>
                      <Button 
                        variant="contained" 
                        onClick={() => onDecision(outcome)} 
                        sx={{ bgcolor: PALETTE.accents.pink, color: '#fff' }}
                      >
                        Protokollieren
                      </Button>
                  </>
              );
          default:
              return <Button onClick={onClose}>Schließen</Button>;
      }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={DESIGN_TOKENS.dialog.paper}>
        <DialogTitle sx={{ ...DESIGN_TOKENS.dialog.title.sx, color: PALETTE.accents.pink }}>
            <SpaIcon sx={{ mr: 1 }} /> Release Protokoll
        </DialogTitle>
        <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
            {renderContent()}
        </DialogContent>
        <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
            {renderActions()}
        </DialogActions>
    </Dialog>
  );
}
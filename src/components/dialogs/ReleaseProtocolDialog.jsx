import React from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, 
    Box, Typography, Button, Rating, LinearProgress 
} from '@mui/material';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import TimerIcon from '@mui/icons-material/Timer';
import ShieldIcon from '@mui/icons-material/Shield';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { PALETTE, DESIGN_TOKENS } from '../../theme/obsidianDesign';

export default function ReleaseProtocolDialog({ 
  open, 
  onClose, 
  step, 
  timer, 
  intensity, 
  setIntensity, 
  onStartTimer, 
  onSkipTimer, 
  onDecision 
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
        <DialogTitle sx={{ textAlign: 'center', color: PALETTE.accents.blue }}>
            RELEASE PROTOCOL
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
            {step === 'confirm' && (
                <Box>
                    <WaterDropIcon sx={{ fontSize: 60, color: PALETTE.accents.blue, mb: 2 }} />
                    <DialogContentText sx={{ mb: 3 }}>
                        Entladung bestätigen? Dies startet das Post-Climax Protocol.
                    </DialogContentText>
                    <Typography variant="caption" display="block" gutterBottom>Intensität</Typography>
                    <Rating value={intensity} onChange={(e,v) => setIntensity(v)} />
                </Box>
            )}

            {step === 'timer' && (
                <Box>
                    <TimerIcon sx={{ fontSize: 60, color: PALETTE.accents.purple, mb: 2 }} />
                    <Typography variant="h3" sx={{ fontFamily: 'monospace', my: 2 }}>
                        {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}
                    </Typography>
                    <DialogContentText>
                        Wartezeit ("Post-Nut Clarity"). Triff keine voreilige Entscheidung.
                    </DialogContentText>
                    <LinearProgress variant="determinate" value={((600 - timer) / 600) * 100} sx={{ mt: 2 }} />
                </Box>
            )}

            {step === 'decision' && (
                <Box>
                    <ShieldIcon sx={{ fontSize: 60, color: PALETTE.primary.main, mb: 2 }} />
                    <Typography variant="h6" gutterBottom>Entscheidung</Typography>
                    <DialogContentText sx={{ mb: 3 }}>
                        Wie ist der Status nach der Entladung?
                    </DialogContentText>
                </Box>
            )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 3, px: 2, flexDirection: 'column', gap: 1.5 }}>
            {step === 'confirm' && (
                <>
                    <Button variant="contained" fullWidth onClick={onStartTimer} color="info">Start Protocol</Button>
                    <Button onClick={onClose} color="inherit">Abbrechen</Button>
                </>
            )}
            {step === 'timer' && (
                  <Button onClick={onSkipTimer} color="inherit" size="small">Überspringen (Riskant)</Button>
            )}
            {step === 'decision' && (
                <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* OPTION 1: SPERMASCORE HERO ACTION */}
                    <Button 
                        variant="contained" fullWidth 
                        onClick={() => onDecision('cum_kept')}
                        startIcon={<WaterDropIcon />}
                        sx={{ 
                            ...DESIGN_TOKENS.buttonGradient, // Hervorgehoben
                            py: 1.5
                        }}
                    >
                        Gekommen & Anbehalten
                    </Button>

                    {/* OPTION 2: DENIAL / DISZIPLIN */}
                    <Button 
                        variant="outlined" color="success" fullWidth 
                        onClick={() => onDecision('maintained')}
                        startIcon={<CheckCircleIcon />}
                    >
                        Nicht gekommen (Disziplin)
                    </Button>

                    {/* OPTION 3: FAIL */}
                    <Button 
                        variant="outlined" color="error" fullWidth 
                        onClick={() => onDecision('removed')}
                    >
                        Ausziehen (Fail)
                    </Button>
                </Box>
            )}
        </DialogActions>
    </Dialog>
  );
}

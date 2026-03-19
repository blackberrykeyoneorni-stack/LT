import React, { useEffect } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    Button, Typography, Box, Avatar, RadioGroup, 
    FormControlLabel, Radio, LinearProgress 
} from '@mui/material';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import useUIStore from '../../store/uiStore';

export default function AuditDialog({ open, onClose, currentItem, progress, onConfirm }) {
    const currentCondition = useUIStore(s => s.currentCondition);
    const setCurrentCondition = useUIStore(s => s.setCurrentCondition);

    // Reset auf "Einwandfrei" bei jedem neuen Item im Audit-Zyklus
    useEffect(() => {
        if (open && setCurrentCondition) {
            setCurrentCondition('perfect');
        }
    }, [open, currentItem, setCurrentCondition]);

    // Wenn kein Item geladen ist, rendere nichts (verhindert Crash)
    if (!currentItem) return null;

    const progressPercent = (progress.current / progress.total) * 100;

    return (
        <Dialog open={open} disableEscapeKeyDown fullWidth maxWidth="xs" PaperProps={DESIGN_TOKENS.dialog.paper}>
            <DialogTitle sx={DESIGN_TOKENS.dialog.title.sx}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <FactCheckIcon color="primary" /> System Audit
                </Box>
            </DialogTitle>
            
            <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
                <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">Fortschritt</Typography>
                        <Typography variant="caption" fontWeight="bold" color="primary">
                            {progress.current} / {progress.total}
                        </Typography>
                    </Box>
                    <LinearProgress 
                        variant="determinate" 
                        value={progressPercent} 
                        sx={{ 
                            height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.1)', 
                            '& .MuiLinearProgress-bar': { bgcolor: PALETTE.primary.main } 
                        }} 
                    />
                </Box>

                <Typography variant="body2" color="text.secondary" align="center" gutterBottom>
                    Bitte verifiziere den physischen Zustand des folgenden Items:
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 3 }}>
                    <Avatar 
                        src={currentItem.imageUrl || currentItem.img} 
                        sx={{ width: 100, height: 100, border: `2px solid ${PALETTE.primary.main}`, mb: 2 }} 
                    />
                    <Typography variant="h6" fontWeight="bold" align="center">
                        {currentItem.name || currentItem.brand}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {currentItem.customId || currentItem.id}
                    </Typography>
                </Box>

                <Box sx={{ bgcolor: 'rgba(0,0,0,0.3)', p: 2, borderRadius: 2, border: `1px solid ${PALETTE.accents.grey}` }}>
                    <Typography variant="subtitle2" gutterBottom color="primary">Zustand bestätigen:</Typography>
                    <RadioGroup 
                        value={currentCondition || 'perfect'} 
                        onChange={(e) => setCurrentCondition && setCurrentCondition(e.target.value)}
                    >
                        <FormControlLabel 
                            value="perfect" 
                            control={<Radio sx={{ color: PALETTE.text.secondary, '&.Mui-checked': { color: PALETTE.accents.green } }} />} 
                            label={<Typography variant="body2">Einwandfrei / Sehr gut</Typography>} 
                        />
                        <FormControlLabel 
                            value="damaged" 
                            control={<Radio sx={{ color: PALETTE.text.secondary, '&.Mui-checked': { color: PALETTE.accents.gold } }} />} 
                            label={<Typography variant="body2">Beschädigt (Laufmasche/Riss)</Typography>} 
                        />
                        <FormControlLabel 
                            value="destroyed" 
                            control={<Radio sx={{ color: PALETTE.text.secondary, '&.Mui-checked': { color: PALETTE.accents.red } }} />} 
                            label={<Typography variant="body2">Zerstört / Unbrauchbar</Typography>} 
                        />
                    </RadioGroup>
                </Box>
            </DialogContent>
            
            <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
                <Button onClick={onClose} color="inherit">Später fortsetzen</Button>
                <Button onClick={onConfirm} variant="contained" sx={DESIGN_TOKENS.buttonGradient}>Verifizieren</Button>
            </DialogActions>
        </Dialog>
    );
}
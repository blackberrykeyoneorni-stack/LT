import React, { useState, useEffect } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    Button, Stack, FormControl, InputLabel, Select, MenuItem, Typography 
} from '@mui/material';
import { DESIGN_TOKENS } from '../../theme/obsidianDesign';

export default function PlanSessionDialog({ open, onClose, date, items, onSave }) {
    const [selectedItemId, setSelectedItemId] = useState('');
    const [plannedPeriod, setPlannedPeriod] = useState('day'); // 'day' oder 'night'

    // BUGFIX: Hard-Reset des Formulars, sobald der Dialog geöffnet wird
    useEffect(() => {
        if (open) {
            setSelectedItemId('');
            setPlannedPeriod('day');
        }
    }, [open]);

    const handleSave = () => {
        if (!selectedItemId) return;
        
        const startDateTime = new Date(date);
        
        // Optische Zeiten für den Kalender setzen, damit die Blöcke richtig gerendert werden
        if (plannedPeriod === 'day') {
            startDateTime.setHours(8, 0, 0, 0); 
        } else {
            startDateTime.setHours(20, 0, 0, 0);
        }
        
        onSave({
            itemId: selectedItemId,
            startTime: startDateTime,
            durationMinutes: 720, // 12 Stunden optischer Block im Kalender
            type: 'planned',
            plannedPeriod: plannedPeriod // WICHTIG: Neues Feld für die Instruction-Zuweisung
        });
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" PaperProps={DESIGN_TOKENS.dialog.paper}>
            <DialogTitle sx={DESIGN_TOKENS.dialog.title.sx}>Planung: {date?.toLocaleDateString()}</DialogTitle>
            <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
                <Stack spacing={3} sx={{ mt: 1 }}>
                    <FormControl fullWidth>
                        <InputLabel sx={{ color: 'text.secondary' }}>Item auswählen</InputLabel>
                        <Select 
                            value={selectedItemId} 
                            label="Item auswählen" 
                            onChange={(e) => setSelectedItemId(e.target.value)}
                            sx={{ 
                                color: 'text.primary',
                                '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' }
                            }}
                            MenuProps={{ PaperProps: { sx: { bgcolor: '#1a1a1a' } } }}
                        >
                            {items.filter(i => i.status === 'active').map(item => (
                                <MenuItem key={item.id} value={item.id}>
                                    {item.name || item.brand} <Typography component="span" variant="caption" color="text.secondary" sx={{ml: 1}}>({item.customId || item.id})</Typography>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl fullWidth>
                        <InputLabel sx={{ color: 'text.secondary' }}>Tageszeit</InputLabel>
                        <Select 
                            value={plannedPeriod} 
                            label="Tageszeit" 
                            onChange={(e) => setPlannedPeriod(e.target.value)}
                            sx={{ 
                                color: 'text.primary',
                                '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' }
                            }}
                            MenuProps={{ PaperProps: { sx: { bgcolor: '#1a1a1a' } } }}
                        >
                            <MenuItem value="day">Tag (Tagtrageanweisung)</MenuItem>
                            <MenuItem value="night">Nacht (Nachttrageanweisung)</MenuItem>
                        </Select>
                    </FormControl>
                </Stack>
            </DialogContent>
            <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
                <Button onClick={onClose} color="inherit">Abbrechen</Button>
                <Button onClick={handleSave} variant="contained" sx={DESIGN_TOKENS.buttonGradient}>Speichern</Button>
            </DialogActions>
        </Dialog>
    );
}
import React, { useState } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    Button, Stack, FormControl, InputLabel, Select, MenuItem, TextField, Typography 
} from '@mui/material';
import { DESIGN_TOKENS } from '../../theme/obsidianDesign';

export default function PlanSessionDialog({ open, onClose, date, items, onSave }) {
    const [selectedItemId, setSelectedItemId] = useState('');
    const [time, setTime] = useState('20:00');
    const [duration, setDuration] = useState(60);

    const handleSave = () => {
        if (!selectedItemId) return;
        const [hours, minutes] = time.split(':');
        const startDateTime = new Date(date);
        startDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        onSave({
            itemId: selectedItemId,
            startTime: startDateTime,
            durationMinutes: parseInt(duration),
            type: 'planned'
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

                    <TextField
                        label="Startzeit"
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        fullWidth
                        InputLabelProps={{ shrink: true, sx: { color: 'text.secondary' } }}
                        sx={DESIGN_TOKENS.inputField}
                    />

                    <TextField
                        label="Geplante Dauer (Minuten)"
                        type="number"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        fullWidth
                        sx={DESIGN_TOKENS.inputField}
                    />
                </Stack>
            </DialogContent>
            <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
                <Button onClick={onClose} color="inherit">Abbrechen</Button>
                <Button onClick={handleSave} variant="contained" sx={DESIGN_TOKENS.buttonGradient}>Speichern</Button>
            </DialogActions>
        </Dialog>
    );
}
import React, { useState, useEffect } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    Button, Stack, FormControl, InputLabel, Select, MenuItem, Typography, Checkbox, ListItemText 
} from '@mui/material';
import { DESIGN_TOKENS } from '../../theme/obsidianDesign';

export default function PlanSessionDialog({ open, onClose, date, items, onSave }) {
    const [selectedItemIds, setSelectedItemIds] = useState([]);
    const [plannedPeriod, setPlannedPeriod] = useState('day'); // 'day' oder 'night'

    // Hard-Reset des Formulars, sobald der Dialog geöffnet wird
    useEffect(() => {
        if (open) {
            setSelectedItemIds([]);
            setPlannedPeriod('day');
        }
    }, [open]);

    const handleSave = () => {
        if (selectedItemIds.length === 0) return;
        
        const startDateTime = new Date(date);
        
        // Optische Zeiten für den Kalender basierend auf defaultRules (07:30 und 23:00)
        if (plannedPeriod === 'day') {
            startDateTime.setHours(7, 30, 0, 0); 
        } else {
            startDateTime.setHours(23, 0, 0, 0);
        }
        
        onSave({
            itemIds: selectedItemIds,
            startTime: startDateTime,
            durationMinutes: plannedPeriod === 'day' ? 930 : 510, // 15.5h oder 8.5h Block
            type: 'planned',
            plannedPeriod: plannedPeriod
        });
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" PaperProps={DESIGN_TOKENS.dialog.paper}>
            <DialogTitle sx={DESIGN_TOKENS.dialog.title.sx}>Planung: {date?.toLocaleDateString()}</DialogTitle>
            <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
                <Stack spacing={3} sx={{ mt: 1 }}>
                    <FormControl fullWidth>
                        <InputLabel sx={{ color: 'text.secondary' }}>Items auswählen</InputLabel>
                        <Select 
                            multiple
                            value={selectedItemIds} 
                            label="Items auswählen" 
                            onChange={(e) => {
                                const value = e.target.value;
                                setSelectedItemIds(typeof value === 'string' ? value.split(',') : value);
                            }}
                            renderValue={(selected) => {
                                return items.filter(i => selected.includes(i.id)).map(i => i.name || i.brand).join(', ');
                            }}
                            sx={{ 
                                color: 'text.primary',
                                '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' }
                            }}
                            MenuProps={{ PaperProps: { sx: { bgcolor: '#1a1a1a' } } }}
                        >
                            {items.filter(i => i.status === 'active').map(item => (
                                <MenuItem key={item.id} value={item.id}>
                                    <Checkbox 
                                        checked={selectedItemIds.indexOf(item.id) > -1} 
                                        sx={{ color: 'rgba(255,255,255,0.7)', '&.Mui-checked': { color: '#fff' } }}
                                    />
                                    <ListItemText 
                                        primary={`${item.name || item.brand}`} 
                                        secondary={`(${item.customId || item.id})`} 
                                        secondaryTypographyProps={{variant: 'caption', color: 'text.secondary'}} 
                                    />
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
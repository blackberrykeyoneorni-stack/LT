import React from 'react';
import { Box, Typography, FormControl, InputLabel, Select, MenuItem, Stack, Button, Dialog } from '@mui/material';

export default function ArchiveDialog({ open, onClose, onConfirm, dropdowns, values, setValues }) {
    return (
        <Dialog open={open} onClose={onClose}>
            <Box sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>Item Archivieren</Typography>
                <Typography variant="body2" color="text.secondary" paragraph>Wähle den Grund für das Archivieren.</Typography>
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Grund</InputLabel>
                    <Select value={values.reason} onChange={(e) => setValues(prev => ({...prev, reason: e.target.value}))} label="Grund">
                        {dropdowns.archiveReasons.map(r => (
                            <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {values.reason === 'run' && (
                    <Stack spacing={2} sx={{ mb: 2 }}>
                        <FormControl fullWidth>
                            <InputLabel>Laufmaschen-Ort</InputLabel>
                            <Select value={values.runLocation} onChange={(e) => setValues(prev => ({...prev, runLocation: e.target.value}))} label="Laufmaschen-Ort">
                                {dropdowns.runLocations.map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <FormControl fullWidth>
                            <InputLabel>Ursache</InputLabel>
                            <Select value={values.runCause} onChange={(e) => setValues(prev => ({...prev, runCause: e.target.value}))} label="Ursache">
                                {dropdowns.runCauses.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Stack>
                )}

                <Stack direction="row" spacing={2} justifyContent="flex-end">
                    <Button onClick={onClose}>Abbrechen</Button>
                    <Button onClick={onConfirm} variant="contained" color="error">Bestätigen</Button>
                </Stack>
            </Box>
        </Dialog>
    );
}

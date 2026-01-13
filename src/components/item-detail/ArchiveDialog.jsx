import React from 'react';
import { Box, Typography, FormControl, InputLabel, Select, MenuItem, Stack, Button, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { DESIGN_TOKENS } from '../../theme/obsidianDesign';

export default function ArchiveDialog({ open, onClose, onConfirm, dropdowns, values, setValues }) {
    return (
        <Dialog open={open} onClose={onClose} PaperProps={DESIGN_TOKENS.dialog.paper}>
            <DialogTitle sx={DESIGN_TOKENS.dialog.title.sx}>Item Archivieren</DialogTitle>
            <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
                <Typography variant="body2" color="text.secondary" paragraph sx={{mt:1}}>Wähle den Grund für das Archivieren.</Typography>
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Grund</InputLabel>
                    <Select value={values.reason} onChange={(e) => setValues(prev => ({...prev, reason: e.target.value}))} label="Grund">
                        {dropdowns.archiveReasons.map(r => (<MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>))}
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
            </DialogContent>
            <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
                <Button onClick={onClose} color="inherit">Abbrechen</Button>
                <Button onClick={onConfirm} variant="contained" color="error">Archivieren</Button>
            </DialogActions>
        </Dialog>
    );
}
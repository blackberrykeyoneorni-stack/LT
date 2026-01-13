import React from 'react';
import { Paper, Button } from '@mui/material';
import LocalLaundryServiceIcon from '@mui/icons-material/LocalLaundryService';
import DeleteIcon from '@mui/icons-material/Delete';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';

export default function FooterActions({ onWash, onArchive }) {
    return (
        <Paper sx={{ p: 2, mb: 4, ...DESIGN_TOKENS.glassCard, display: 'flex', gap: 2 }}>
            <Button 
                variant="outlined" fullWidth 
                startIcon={<LocalLaundryServiceIcon />}
                onClick={onWash}
                sx={{ borderColor: PALETTE.accents.blue, color: PALETTE.accents.blue, '&:hover': { bgcolor: `${PALETTE.accents.blue}10` } }}
            >
                Waschen
            </Button>
            <Button 
                variant="outlined" color="error" fullWidth 
                startIcon={<DeleteIcon />}
                onClick={onArchive}
            >
                Archiv
            </Button>
        </Paper>
    );
}
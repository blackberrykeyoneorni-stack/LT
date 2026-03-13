import React from 'react';
import { Grid, Paper, Typography } from '@mui/material';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import ShieldIcon from '@mui/icons-material/Shield';
import { PALETTE, DESIGN_TOKENS } from '../../theme/obsidianDesign';

export default function ItemStats({ stats }) {
    const StatBox = ({ icon, val, label, color }) => (
        <Paper sx={{ p: 1.5, textAlign: 'center', ...DESIGN_TOKENS.glassCard }}>
            {React.cloneElement(icon, { sx: { color: color, fontSize: 24, mb: 0.5, filter: `drop-shadow(0 0 5px ${color})` } })}
            <Typography variant="h5" sx={{ fontWeight: 800, color: PALETTE.accents.blue, textShadow: `0 0 10px ${PALETTE.accents.blue}80` }}>{val}</Typography>
            <Typography variant="caption" sx={{ color: PALETTE.text.secondary, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</Typography>
        </Paper>
    );

    return (
        <Grid container spacing={2} sx={{ mt: 3 }}>
            <Grid item xs={3}><StatBox icon={<FitnessCenterIcon />} val={stats.wearCount} label="Wears" color={PALETTE.primary.main} /></Grid>
            <Grid item xs={3}><StatBox icon={<AttachMoneyIcon />} val={stats.cpw} label="CPW" color={PALETTE.accents.green} /></Grid>
            <Grid item xs={3}><StatBox icon={<WaterDropIcon />} val={stats.releaseCount} label="Sperma" color={PALETTE.accents.blue} /></Grid>
            <Grid item xs={3}><StatBox icon={<ShieldIcon />} val={`${stats.survivalRate}%`} label="Survive" color={PALETTE.accents.red} /></Grid>
        </Grid>
    );
}
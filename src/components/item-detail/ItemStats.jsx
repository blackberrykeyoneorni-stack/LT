import React from 'react';
import { Grid, Paper, Typography } from '@mui/material';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import ShieldIcon from '@mui/icons-material/Shield';
import { PALETTE } from '../../theme/obsidianDesign';

export default function ItemStats({ stats }) {
    const StatBox = ({ icon, val, label, color }) => (
        <Paper sx={{ p: 1, textAlign: 'center', bgcolor: PALETTE.background.lightGlass }}>
            {React.cloneElement(icon, { sx: { color: color, fontSize: 20 } })}
            <Typography variant="h6" sx={{ mt: 0.5 }}>{val}</Typography>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
        </Paper>
    );

    return (
        <Grid container spacing={2} sx={{ mt: 3 }}>
            <Grid item xs={3}><StatBox icon={<FitnessCenterIcon />} val={stats.wearCount} label="Wears" color={PALETTE.accents.purple} /></Grid>
            <Grid item xs={3}><StatBox icon={<AttachMoneyIcon />} val={stats.cpw} label="CPW" color={PALETTE.accents.green} /></Grid>
            <Grid item xs={3}><StatBox icon={<WaterDropIcon />} val={stats.releaseCount} label="Releases" color={PALETTE.accents.blue} /></Grid>
            <Grid item xs={3}><StatBox icon={<ShieldIcon />} val={`${stats.survivalRate}%`} label="Survive" color={PALETTE.primary.main} /></Grid>
        </Grid>
    );
}
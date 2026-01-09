import React from 'react';
import { Grid, Paper, Typography } from '@mui/material';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import ShieldIcon from '@mui/icons-material/Shield';

export default function ItemStats({ stats }) {
    return (
        <Grid container spacing={2} sx={{ mt: 3 }}>
            <Grid item xs={3}>
                <Paper sx={{ p: 1, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.03)' }}>
                    <FitnessCenterIcon color="secondary" fontSize="small" />
                    <Typography variant="h6">{stats.wearCount}</Typography>
                    <Typography variant="caption" color="text.secondary">Wears</Typography>
                </Paper>
            </Grid>
            <Grid item xs={3}>
                <Paper sx={{ p: 1, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.03)' }}>
                    <AttachMoneyIcon color="success" fontSize="small" />
                    <Typography variant="h6">{stats.cpw}</Typography>
                    <Typography variant="caption" color="text.secondary">CPW</Typography>
                </Paper>
            </Grid>
            <Grid item xs={3}>
                <Paper sx={{ p: 1, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.03)' }}>
                    <WaterDropIcon color="info" fontSize="small" />
                    <Typography variant="h6">{stats.releaseCount}</Typography>
                    <Typography variant="caption" color="text.secondary">Releases</Typography>
                </Paper>
            </Grid>
            <Grid item xs={3}>
                <Paper sx={{ p: 1, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.03)' }}>
                    <ShieldIcon color="primary" fontSize="small" />
                    <Typography variant="h6">{stats.survivalRate}%</Typography>
                    <Typography variant="caption" color="text.secondary">Survive</Typography>
                </Paper>
            </Grid>
        </Grid>
    );
}

import React from 'react';
import { Grid, Card, CardContent, Typography, Box } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';

export default function InfoTiles({ kpis }) {
  const orphanCount = kpis?.health?.orphanCount || 0;
  const avgCPW = kpis?.financials?.avgCPW || 0;
  const nylonIndex = kpis?.usage?.nylonIndex || 0;
  const spermaScore = kpis?.spermaScore || { rate: 0, total: 0, kept: 0 };

  return (
      <Grid container spacing={2} sx={{ mb: 3 }}>
        
        {/* KACHEL 1: ORPHANS */}
        <Grid item xs={6}>
            <Card sx={{ 
                height: '100%', 
                ...DESIGN_TOKENS.glassCard,
                borderColor: orphanCount > 5 ? PALETTE.accents.red : 'rgba(255,255,255,0.1)' 
            }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                         <WarningAmberIcon sx={{ fontSize: 16, color: orphanCount > 0 ? PALETTE.accents.red : 'text.secondary' }} />
                         <Typography color="text.secondary" variant="caption">Orphans</Typography>
                    </Box>
                    <Typography variant="h5" sx={{fontWeight:'bold', color: orphanCount > 0 ? PALETTE.accents.red : 'text.primary'}}>
                        {orphanCount} <Typography component="span" variant="caption" color="text.secondary">Items</Typography>
                    </Typography>
                </CardContent>
            </Card>
        </Grid>

        {/* KACHEL 2: SPERMA SCORE */}
        <Grid item xs={6}>
            <Card sx={{ height: '100%', ...DESIGN_TOKENS.glassCard }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                         <WaterDropIcon sx={{ fontSize: 16, color: PALETTE.accents.blue }} />
                         <Typography color="text.secondary" variant="caption">SpermaScore</Typography>
                    </Box>
                    <Typography variant="h5" sx={{fontWeight:'bold', color: PALETTE.accents.blue}}>
                        {spermaScore.rate}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        {spermaScore.kept} / {spermaScore.total}
                    </Typography>
                </CardContent>
            </Card>
        </Grid>

        {/* KACHEL 3: CPW */}
        <Grid item xs={6}>
            <Card sx={{ height: '100%', ...DESIGN_TOKENS.glassCard }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography color="text.secondary" variant="caption">Ø Cost per Wear</Typography>
                    <Typography variant="h5" sx={{fontWeight:'bold', color: PALETTE.accents.green}}>
                        {avgCPW.toFixed(2)} €
                    </Typography>
                </CardContent>
            </Card>
        </Grid>

        {/* KACHEL 4: NYLON INDEX */}
        <Grid item xs={6}>
            <Card sx={{ height: '100%', ...DESIGN_TOKENS.glassCard }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography color="text.secondary" variant="caption">Nylon Index</Typography>
                    <Typography variant="h5" sx={{fontWeight:'bold', color: PALETTE.accents.gold}}>
                        {nylonIndex.toFixed(1)} h
                    </Typography>
                </CardContent>
            </Card>
        </Grid>
      </Grid>
  );
}
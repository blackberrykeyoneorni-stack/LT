import React from 'react';
import { Grid, Card, CardActionArea, CardContent, Typography, Box } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import WaterDropIcon from '@mui/icons-material/WaterDrop'; // Passendes Icon
import { PALETTE } from '../../theme/obsidianDesign';

export default function InfoTiles({ 
    kpis, 
    wishlistCount, 
    highestPriorityItem, 
    onOpenBudget, 
    onNavigateWishlist 
}) {
  
  const orphanCount = kpis?.health?.orphanCount || 0;
  const avgCPW = kpis?.financials?.avgCPW || 0;
  const nylonIndex = kpis?.usage?.nylonIndex || 0;
  
  // NEUE DATEN FÜR SPERMA SCORE
  const spermaScore = kpis?.spermaScore || { rate: 0, total: 0, kept: 0 };

  return (
      <Grid container spacing={2} sx={{ mb: 3 }}>
        
        {/* KACHEL 1: ORPHAN ALARM */}
        <Grid item xs={6}>
            <Card sx={{ height: '100%', borderColor: orphanCount > 5 ? PALETTE.accents.red : 'default' }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                         <WarningAmberIcon sx={{ fontSize: 16, color: orphanCount > 0 ? PALETTE.accents.red : 'text.secondary' }} />
                         <Typography color="text.secondary" variant="caption">Orphans</Typography>
                    </Box>
                    <Typography variant="h5" sx={{fontWeight:'bold', color: orphanCount > 0 ? PALETTE.accents.red : 'text.primary'}}>
                        {orphanCount} <Typography component="span" variant="caption" color="text.secondary">Items</Typography>
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                        &gt; 60 Tage inaktiv
                    </Typography>
                </CardContent>
            </Card>
        </Grid>

        {/* KACHEL 2: SPERMA SCORE (Ersetzt Wishlist) */}
        <Grid item xs={6}>
            <Card sx={{ height: '100%' }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                         <WaterDropIcon sx={{ fontSize: 16, color: PALETTE.accents.blue }} />
                         <Typography color="text.secondary" variant="caption">SpermaScore</Typography>
                    </Box>
                    <Typography variant="h5" sx={{fontWeight:'bold', color: PALETTE.accents.blue}}>
                        {spermaScore.rate}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', display: 'block', mt: 0.5 }}>
                        {spermaScore.kept} / {spermaScore.total} behalten
                    </Typography>
                </CardContent>
            </Card>
        </Grid>

        {/* KACHEL 3: Ø COST PER WEAR */}
        <Grid item xs={6}>
            <Card sx={{ height: '100%' }}>
                <CardContent>
                    <Typography color="text.secondary" variant="caption">Ø Cost per Wear</Typography>
                    <Typography variant="h5" sx={{fontWeight:'bold', color: PALETTE.accents.green}}>
                        {avgCPW.toFixed(2)} €
                    </Typography>
                </CardContent>
            </Card>
        </Grid>

        {/* KACHEL 4: NYLON INDEX */}
        <Grid item xs={6}>
            <Card sx={{ height: '100%' }}>
                <CardContent>
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

import React from 'react';
import { Grid, Card, CardContent, Typography, Box } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import SavingsIcon from '@mui/icons-material/Savings';
import EuroIcon from '@mui/icons-material/Euro';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';

export default function InfoTiles({ kpis, timeBank }) {
  // Sicherheits-Abfragen mit Defaults
  const orphanCount = kpis?.health?.orphanCount || 0;
  const avgCPW = kpis?.financials?.avgCPW || 0;
  const nylonIndex = kpis?.usage?.nylonIndex || 0;
  
  // Time Bank
  const nc = timeBank?.nc || 0;
  const lc = timeBank?.lc || 0;
  
  // SpermaScore
  const spermaScore = kpis?.spermaScore || { rate: 0, total: 0, count: 0 };

  // Hilfsfunktion für einheitliche kleine Karten
  const SmallCard = ({ icon, title, value, unit, color }) => (
      <Grid item xs={6}>
        <Card sx={{ height: '100%', ...DESIGN_TOKENS.glassCard }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        {icon}
                        <Typography color="text.secondary" variant="caption">{title}</Typography>
                </Box>
                <Typography variant="h6" sx={{fontWeight:'bold', color: color}}>
                    {value} <Typography component="span" variant="caption" color="text.secondary">{unit}</Typography>
                </Typography>
            </CardContent>
        </Card>
      </Grid>
  );

  return (
      <Grid container spacing={2} sx={{ mb: 3 }}>
        
        {/* REIHE 1: CREDITS (The Vault) */}
        <SmallCard 
            icon={<SavingsIcon sx={{ fontSize: 16, color: PALETTE.accents.gold }} />}
            title="Nylon Credits"
            value={nc}
            unit="min"
            color={nc < 0 ? PALETTE.accents.red : PALETTE.accents.gold}
        />
        <SmallCard 
            icon={<SavingsIcon sx={{ fontSize: 16, color: PALETTE.accents.pink }} />}
            title="Lingerie Credits"
            value={lc}
            unit="min"
            color={lc < 0 ? PALETTE.accents.red : PALETTE.accents.pink}
        />

        {/* REIHE 2: FINANCIALS & INDEX */}
        <SmallCard 
            icon={<EuroIcon sx={{ fontSize: 16, color: PALETTE.accents.green }} />}
            title="Ø Cost/Wear"
            value={typeof avgCPW === 'number' ? avgCPW.toFixed(2) : '0.00'}
            unit="€"
            color={PALETTE.accents.green}
        />
        <SmallCard 
            icon={<AccessTimeIcon sx={{ fontSize: 16, color: PALETTE.accents.gold }} />}
            title="Nylon Index"
            value={typeof nylonIndex === 'number' ? nylonIndex.toFixed(1) : '0.0'}
            unit="h"
            color={PALETTE.accents.gold}
        />

        {/* REIHE 3: ORPHANS & SPERMASCORE */}
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
                    <Typography variant="h6" sx={{fontWeight:'bold', color: orphanCount > 0 ? PALETTE.accents.red : 'text.primary'}}>
                        {orphanCount} <Typography component="span" variant="caption" color="text.secondary">Stk.</Typography>
                    </Typography>
                </CardContent>
            </Card>
        </Grid>

        <SmallCard 
            icon={<WaterDropIcon sx={{ fontSize: 16, color: PALETTE.accents.blue }} />}
            title="SpermaScore"
            value={spermaScore.rate}
            unit="%"
            color={PALETTE.accents.blue}
        />

      </Grid>
  );
}
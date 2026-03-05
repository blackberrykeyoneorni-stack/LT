import React, { useState } from 'react';
import { Grid, Card, CardContent, Typography, Box, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import SavingsIcon from '@mui/icons-material/Savings';
import EuroIcon from '@mui/icons-material/Euro';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';

export default function InfoTiles({ kpis, timeBank }) {
  const orphanCount = kpis?.health?.orphanCount || 0;
  const avgCPW = kpis?.financials?.avgCPW || '0.00';
  const nylonIndex = kpis?.usage?.nylonIndex || '0.0';
  const nylonChartData = kpis?.usage?.nylonChartData || [];
  
  const nc = timeBank?.nc || 0;
  const lc = timeBank?.lc || 0;
  
  const spermaScore = kpis?.spermaScore || { rate: '0.0', total: 0, count: 0 };

  const [chartOpen, setChartOpen] = useState(false);

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
        
        {/* REIHE 1: CREDITS */}
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
            value={avgCPW}
            unit="€"
            color={PALETTE.accents.green}
        />
        <Grid item xs={6}>
            <Card 
                onClick={() => setChartOpen(true)}
                sx={{ 
                    height: '100%', 
                    cursor: 'pointer',
                    ...DESIGN_TOKENS.glassCard, 
                    transition: 'all 0.2s',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', transform: 'translateY(-2px)' } 
                }}
            >
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                         <AccessTimeIcon sx={{ fontSize: 16, color: PALETTE.accents.gold }} />
                         <Typography color="text.secondary" variant="caption">Nylon Index</Typography>
                    </Box>
                    <Typography variant="h6" sx={{fontWeight:'bold', color: PALETTE.accents.gold}}>
                        {nylonIndex} <Typography component="span" variant="caption" color="text.secondary">h</Typography>
                    </Typography>
                </CardContent>
            </Card>
        </Grid>

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

        {/* CHART DIALOG */}
        <Dialog open={chartOpen} onClose={() => setChartOpen(false)} maxWidth="md" fullWidth PaperProps={DESIGN_TOKENS.dialog.paper}>
            <DialogTitle sx={DESIGN_TOKENS.dialog.title.sx}>Nylon Trage-Historie (letzte 60 Tage)</DialogTitle>
            <DialogContent sx={{ ...DESIGN_TOKENS.dialog.content.sx, p: 2, height: 400 }}>
                {nylonChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={nylonChartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis 
                                dataKey="dateStr" 
                                stroke="rgba(255,255,255,0.5)" 
                                fontSize={11} 
                                tickMargin={10} 
                                minTickGap={20} 
                            />
                            <YAxis 
                                stroke="rgba(255,255,255,0.5)" 
                                fontSize={11} 
                                tickFormatter={(value) => `${value}h`}
                            />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                                itemStyle={{ color: '#fff', fontSize: '14px' }}
                                labelStyle={{ color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: 20, fontSize: '14px' }} />
                            <Bar dataKey="Stunden" fill={PALETTE.accents.purple} radius={[4, 4, 0, 0]} barSize={12} name="Tagesstunden" />
                            <Line type="monotone" dataKey="Trend" stroke={PALETTE.accents.gold} strokeWidth={3} dot={false} name="5-Tage-Trend" />
                        </ComposedChart>
                    </ResponsiveContainer>
                ) : (
                    <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography color="text.secondary">Keine Daten verfügbar.</Typography>
                    </Box>
                )}
            </DialogContent>
            <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
                <Button onClick={() => setChartOpen(false)} fullWidth color="inherit">Schließen</Button>
            </DialogActions>
        </Dialog>

      </Grid>
  );
}
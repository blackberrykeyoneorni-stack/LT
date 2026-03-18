import React from 'react';
import { Dialog, DialogTitle, DialogContent, Box, Typography, IconButton } from '@mui/material';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { DESIGN_TOKENS, PALETTE, CHART_THEME } from '../../theme/obsidianDesign';
import { Icons } from '../../theme/appIcons';
import { getUnit } from '../../utils/statsCalculator';

export default function TrendDialog({ selectedMetric, trendData, onClose }) {
    return (
        <Dialog open={!!selectedMetric} onClose={onClose} fullWidth maxWidth="sm" PaperProps={DESIGN_TOKENS.dialog.paper}>
            <DialogTitle sx={DESIGN_TOKENS.dialog.title.sx}>
                <Box><Typography variant="h6">{selectedMetric?.title} Trend</Typography></Box>
                <IconButton onClick={onClose} sx={{ color: 'white' }}><Icons.Close /></IconButton>
            </DialogTitle>
            <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
                <Box sx={{ height: 300, mt: 2 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={trendData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid.line.stroke} vertical={false} />
                            <XAxis dataKey="name" stroke={CHART_THEME.textColor} tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                            <YAxis stroke={CHART_THEME.textColor} tick={{fontSize: 10}} unit={getUnit(selectedMetric?.id)} width={35} axisLine={false} tickLine={false} />
                            <RechartsTooltip 
                                contentStyle={CHART_THEME.tooltip.container} 
                                formatter={(value, name) => [value + getUnit(selectedMetric?.id), name === 'value' ? 'Ø Monatswert' : 'Trend (Regression)']} 
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                            />
                            <Bar dataKey="value" fill={selectedMetric?.id === 'nylonGap' ? '#00e5ff' : PALETTE.accents.pink} radius={[4, 4, 0, 0]} maxBarSize={40} />
                            <Line dataKey="trend" type="linear" stroke={PALETTE.accents.gold} strokeWidth={2} dot={false} strokeDasharray="5 5" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </Box>
                <Typography variant="caption" color="text.secondary" align="center" display="block" sx={{mt:2}}>
                    Monatlicher Durchschnitt (letzte 6 Monate) • Lineare Regression
                </Typography>
            </DialogContent>
        </Dialog>
    );
}
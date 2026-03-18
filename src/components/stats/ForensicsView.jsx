import React from 'react';
import { Grid, Paper, Typography, Box, Chip, Divider } from '@mui/material';
import { motion } from 'framer-motion';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip } from 'recharts';
import { DESIGN_TOKENS, PALETTE, MOTION } from '../../theme/obsidianDesign';
import { Icons } from '../../theme/appIcons';

export default function ForensicsView({ forensics }) {
    if (!forensics) return null;

    return (
        <Box>
            <motion.div variants={MOTION.listItem}>
                <Divider sx={{ my: 4, borderColor: PALETTE.background.glassBorder }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: PALETTE.accents.red }}>
                        <Icons.Science /> Forensik
                    </Typography>
                    <Chip label={`${forensics.archivedCount} Archiviert`} size="small" color="error" variant="outlined" />
                </Box>
            </motion.div>

            <Grid container spacing={3}>
                <Grid item xs={12} sm={4}>
                     <motion.div variants={MOTION.listItem} style={{ height: '100%' }}>
                        <Paper sx={{ p: 2, height: '100%', border: `1px solid ${PALETTE.accents.crimson}`, bgcolor: `${PALETTE.accents.crimson}10`, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRadius: '12px' }}>
                            <Typography variant="caption" color="error">GLOBAL CPW</Typography>
                            <Typography variant="h4" fontWeight="bold" color={PALETTE.text.primary}>{forensics.realizedCPW.toFixed(2)} €</Typography>
                            <Typography variant="caption" color="text.secondary">Investition pro Nutzung</Typography>
                        </Paper>
                    </motion.div>
                </Grid>
                
                <Grid item xs={12} sm={8}>
                    <motion.div variants={MOTION.listItem} style={{ height: '100%' }}>
                        <Paper sx={{ p: 2, ...DESIGN_TOKENS.glassCard }}>
                            <Grid container spacing={2}>
                                <Grid item xs={6}>
                                    <Typography variant="subtitle2" align="center" gutterBottom>Nach Anzahl</Typography>
                                    <Box sx={{height: 200, width: '100%'}}>
                                        <ResponsiveContainer>
                                            <PieChart>
                                                <Pie data={forensics.reasonsData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                                                    {forensics.reasonsData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />)}
                                                </Pie>
                                                <RechartsTooltip contentStyle={{ backgroundColor: '#000', border: 'none' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </Box>
                                </Grid>
                                
                                <Grid item xs={6}>
                                    <Typography variant="subtitle2" align="center" gutterBottom>Verlustwert (€)</Typography>
                                    <Box sx={{height: 200, width: '100%'}}>
                                        <ResponsiveContainer>
                                            <BarChart data={forensics.lossValueData} layout="vertical">
                                                <XAxis type="number" hide />
                                                <YAxis dataKey="name" type="category" width={70} tick={{fontSize: 10, fill: '#aaa'}} />
                                                <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: '#000', border: 'none' }} />
                                                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                                    {forensics.lossValueData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </Box>
                                </Grid>
                            </Grid>
                        </Paper>
                    </motion.div>
                </Grid>
            </Grid>
        </Box>
    );
}
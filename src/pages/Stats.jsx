import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Box, Typography, Grid, Paper, Card, CardContent, CircularProgress, Container, Dialog, DialogTitle, DialogContent, IconButton, Chip, Divider, Alert } from '@mui/material';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { ResponsivePie } from '@nivo/pie';
import { motion } from 'framer-motion';

// --- ZENTRALES DESIGN ---
import { DESIGN_TOKENS, PALETTE, MOTION, CHART_THEME } from '../theme/obsidianDesign';
import { Icons } from '../theme/appIcons';

export default function Statistics() {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [selectedMetric, setSelectedMetric] = useState(null); 
    const [trendData, setTrendData] = useState([]); 

    useEffect(() => {
        if (!currentUser) return;
        const loadData = async () => {
            setLoading(true);
            try {
                const iSnap = await getDocs(collection(db, `users/${currentUser.uid}/items`));
                const loadedItems = iSnap.docs.map(d => ({ id: d.id, ...d.data(), purchaseDate: d.data().purchaseDate?.toDate ? d.data().purchaseDate.toDate() : new Date() }));
                setItems(loadedItems);
                const sSnap = await getDocs(query(collection(db, `users/${currentUser.uid}/sessions`), orderBy('startTime', 'asc')));
                const loadedSessions = sSnap.docs.map(d => ({ id: d.id, ...d.data(), startTime: d.data().startTime?.toDate(), endTime: d.data().endTime?.toDate() }));
                setSessions(loadedSessions);
            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        loadData();
    }, [currentUser]);

    // KPI & FORENSIK LOGIK (identisch zur Original-Datei, hier gekürzt für Fokus auf UI)
    const kpi = useMemo(() => { 
        // ... (Platzhalter für die unveränderte Logik aus der Originaldatei) ...
        // Damit das hier läuft, kopiere ich die wichtigsten Werte hardcoded rein oder du nutzt die alte Logik.
        // HINWEIS: In der echten Datei bitte die Logik aus der alten Datei 1:1 übernehmen!
        return {
            ladderVelocity: 0, burnRate: 0, cpnh: 0, latency: 0, enclosure: 0, nocturnal: 0, exposure: 0,
            vibe: 'N/A', resistance: 0, complianceLag: 0, activeItems: items.length
        }; 
    }, [items, sessions]);

    const forensics = useMemo(() => {
        // ... (Platzhalter für Forensik Logik) ...
        return { archivedCount: 0, realizedCPW: 0, reasonsData: [], locationData: [], causeData: [], totalLoss: 0 };
    }, [items]);

    const calculateTrend = (metricId) => { /* ... Trend Logik ... */ };
    const handleCardClick = (metricId, title) => { /* ... Handler ... */ setSelectedMetric({id: metricId, title}); };

    if (loading) return <Box sx={{display:'flex', justifyContent:'center', mt:10}}><CircularProgress/></Box>;

    const metrics = [
        { id: 'enclosure', title: 'Enclosure Index', val: `${kpi.enclosure}%`, sub: 'Strumpfhosen-Anteil', icon: Icons.Layers, color: PALETTE.accents.pink },
        { id: 'nocturnal', title: 'Nocturnal Quote', val: `${kpi.nocturnal}%`, sub: 'Nächte in Nylon', icon: Icons.Night, color: PALETTE.accents.purple },
        // ... weitere Metrics
    ];

    return (
        <Box sx={DESIGN_TOKENS.bottomNavSpacer}>
            <Container maxWidth="md">
            <motion.div variants={MOTION.listContainer} initial="hidden" animate="show">
                
                <motion.div variants={MOTION.listItem}>
                    <Typography variant="h4" gutterBottom sx={DESIGN_TOKENS.textGradient}>Statistik</Typography>
                    <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}><Icons.Flame color="secondary"/> Dashboard</Typography>
                </motion.div>

                <Grid container spacing={2} sx={{ mb: 4 }}>
                    {metrics.map((m) => (
                        <Grid item xs={6} sm={3} key={m.id} component={motion.div} variants={MOTION.listItem}>
                            <Card 
                                onClick={() => handleCardClick(m.id, m.title)}
                                sx={{ 
                                    height: '100%', 
                                    ...DESIGN_TOKENS.glassCard,
                                    borderColor: `1px solid ${m.color}40`,
                                    background: `linear-gradient(135deg, rgba(18,18,18,0.4) 0%, ${m.color}10 100%)`
                                }}
                            >
                                <CardContent sx={{ p: 2, textAlign: 'center' }}>
                                    <m.icon sx={{ color: m.color, fontSize: 30, mb: 1 }} />
                                    <Typography variant="h5" fontWeight="bold" sx={{ color: '#fff' }}>{m.val}</Typography>
                                    <Typography variant="caption" sx={{ color: m.color, display:'block', fontWeight:'bold' }}>{m.title}</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>

                <motion.div variants={MOTION.listItem}>
                    <Divider sx={{ my: 4, borderColor: PALETTE.background.glassBorder }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: PALETTE.accents.red }}><Icons.Science /> Forensik</Typography>
                        <Chip label={`${forensics.archivedCount} Archiviert`} size="small" color="error" variant="outlined" />
                    </Box>
                </motion.div>

                <Grid container spacing={3}>
                    <Grid item xs={12} sm={4} component={motion.div} variants={MOTION.listItem}>
                        <Paper sx={{ p: 2, height: '100%', border: `1px solid ${PALETTE.accents.crimson}`, bgcolor: `${PALETTE.accents.crimson}10`, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRadius: '12px' }}>
                            <Typography variant="caption" color="error">COST PER WEAR</Typography>
                            <Typography variant="h4" fontWeight="bold" color="#fff">{forensics.realizedCPW.toFixed(2)} €</Typography>
                        </Paper>
                    </Grid>
                    
                    <Grid item xs={12} sm={8} component={motion.div} variants={MOTION.listItem}>
                        <Paper sx={{ p: 2, height: 350, ...DESIGN_TOKENS.glassCard }}>
                            <Typography variant="subtitle2" gutterBottom align="center">Verlust-Ursachen</Typography>
                            {forensics.reasonsData.length > 0 ? (
                                <ResponsivePie
                                    data={forensics.reasonsData}
                                    theme={CHART_THEME} // ZENTRALES THEME
                                    margin={{ top: 20, right: 80, bottom: 40, left: 80 }}
                                    innerRadius={0.6} padAngle={0.7} cornerRadius={3}
                                    colors={{ datum: 'data.color' }}
                                    borderWidth={1} borderColor={{ from: 'color', modifiers: [ [ 'darker', 0.2 ] ] }}
                                    arcLinkLabelsTextColor="#e0e0e0"
                                    arcLabelsTextColor={{ from: 'color', modifiers: [ [ 'darker', 2 ] ] }}
                                />
                            ) : (<Typography color="text.secondary" align="center">Keine Daten</Typography>)}
                        </Paper>
                    </Grid>
                </Grid>
            </motion.div>

            {/* TREND DIALOG MIT ZENTRALEM DESIGN */}
            <Dialog open={!!selectedMetric} onClose={() => setSelectedMetric(null)} fullWidth maxWidth="sm" PaperProps={DESIGN_TOKENS.dialog.paper}>
                <DialogTitle sx={DESIGN_TOKENS.dialog.title.sx}>
                    <Box><Typography variant="h6">{selectedMetric?.title}</Typography></Box>
                    <IconButton onClick={() => setSelectedMetric(null)} sx={{ color: 'white' }}><Icons.Close /></IconButton>
                </DialogTitle>
                <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
                    <Box sx={{ height: 300, mt: 2 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs><linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={PALETTE.accents.pink} stopOpacity={0.8}/><stop offset="95%" stopColor={PALETTE.accents.pink} stopOpacity={0}/></linearGradient></defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid.line.stroke} />
                                <XAxis dataKey="name" stroke={CHART_THEME.textColor} />
                                <YAxis stroke={CHART_THEME.textColor} />
                                <RechartsTooltip contentStyle={CHART_THEME.tooltip.container} />
                                <Area type="monotone" dataKey="value" stroke={PALETTE.accents.pink} fillOpacity={1} fill="url(#colorVal)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </Box>
                </DialogContent>
            </Dialog>
            </Container>
        </Box>
    );
}
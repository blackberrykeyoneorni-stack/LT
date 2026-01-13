import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Box, Typography, Grid, Paper, Card, CardContent, CircularProgress, Container, Dialog, DialogTitle, DialogContent, IconButton, Chip, Divider } from '@mui/material';
// KORREKTUR: ResponsivePie aus dem Import entfernt, da es in recharts nicht existiert
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { ResponsivePie as NivoPie } from '@nivo/pie'; 
import { motion } from 'framer-motion';

// --- ZENTRALES DESIGN ---
import { DESIGN_TOKENS, PALETTE, MOTION, CHART_THEME } from '../theme/obsidianDesign';
import { Icons } from '../theme/appIcons';

// Icons für Kacheln
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SpeedIcon from '@mui/icons-material/Speed';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PsychologyIcon from '@mui/icons-material/Psychology';
import BrokenImageIcon from '@mui/icons-material/BrokenImage';
import SecurityIcon from '@mui/icons-material/Security';

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
                // 1. Items laden
                const iSnap = await getDocs(collection(db, `users/${currentUser.uid}/items`));
                const loadedItems = iSnap.docs.map(d => ({ 
                    id: d.id, 
                    ...d.data(), 
                    purchaseDate: d.data().purchaseDate?.toDate ? d.data().purchaseDate.toDate() : new Date(d.data().purchaseDate || Date.now()) 
                }));
                setItems(loadedItems);

                // 2. Sessions (Historie) laden
                const sSnap = await getDocs(query(collection(db, `users/${currentUser.uid}/sessions`), orderBy('startTime', 'asc')));
                const loadedSessions = sSnap.docs.map(d => ({ 
                    id: d.id, 
                    ...d.data(), 
                    startTime: d.data().startTime?.toDate ? d.data().startTime.toDate() : new Date(d.data().startTime),
                    endTime: d.data().endTime?.toDate ? d.data().endTime.toDate() : (d.data().endTime ? new Date(d.data().endTime) : null)
                }));
                setSessions(loadedSessions);

            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        loadData();
    }, [currentUser]);

    // --- KPI Berechnung ---
    const kpi = useMemo(() => {
        if (!items.length) return { enclosure: 0, nocturnal: 0, cpnh: 0, ladderVelocity: 0, exposure: 0, resistance: 0, vibe: 'N/A' };
        
        const activeItems = items.filter(i => i.status === 'active' || i.status === 'washing');
        const nylons = activeItems.filter(i => i.mainCategory === 'Nylons');
        const enclosure = activeItems.length > 0 ? Math.round((nylons.length / activeItems.length) * 100) : 0;

        const instructionSessions = sessions.filter(s => s.type === 'instruction');
        const nightSessions = instructionSessions.filter(s => s.period && s.period.includes('night'));
        const nocturnal = instructionSessions.length > 0 ? Math.round((nightSessions.length / instructionSessions.length) * 100) : 0;

        const totalCost = items.reduce((acc, i) => acc + (parseFloat(i.cost) || 0), 0);
        const totalMinutes = items.reduce((acc, i) => acc + (i.totalMinutes || 0), 0);
        const totalHours = totalMinutes / 60;
        const cpnh = totalHours > 0 ? (totalCost / totalHours).toFixed(2) : "0.00";

        const archivedCount = items.filter(i => i.status === 'archived').length;
        const ladderVelocity = archivedCount; 

        let firstSession = new Date();
        let totalSessionDuration = 0;
        if (sessions.length > 0) {
            firstSession = sessions[0].startTime;
            sessions.forEach(s => {
                if(s.endTime) {
                    totalSessionDuration += (s.endTime - s.startTime);
                }
            });
        }
        const totalTimeSinceStart = Date.now() - firstSession.getTime();
        const exposure = totalTimeSinceStart > 0 ? Math.round((totalSessionDuration / totalTimeSinceStart) * 100) : 0;

        const punishmentCount = sessions.filter(s => s.type === 'punishment').length;
        const resistance = sessions.length > 0 ? Math.round((punishmentCount / sessions.length) * 100) : 0;

        const tags = {};
        items.forEach(i => {
            if(Array.isArray(i.vibeTags)) i.vibeTags.forEach(t => tags[t] = (tags[t] || 0) + 1);
        });
        const topVibe = Object.keys(tags).sort((a,b) => tags[b] - tags[a])[0] || "Neutral";

        return { enclosure, nocturnal, cpnh, ladderVelocity, exposure, resistance, vibe: topVibe };
    }, [items, sessions]);

    // --- Trend Berechnung (30 TAGE) ---
    const calculateTrend = (metricId) => {
        const days = 30;
        const lastDays = [...Array(days)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - ((days - 1) - i));
            return d.toISOString().split('T')[0]; 
        });

        const data = lastDays.map(dateStr => {
            const daySessions = sessions.filter(s => {
                if (!s.startTime) return false;
                const sDate = s.startTime.toISOString().split('T')[0];
                return sDate === dateStr;
            });

            let value = 0;
            if (metricId === 'enclosure' || metricId === 'exposure' || metricId === 'nocturnal') {
                value = daySessions.reduce((acc, s) => {
                    const end = s.endTime || new Date();
                    return acc + (end - s.startTime) / 60000;
                }, 0);
            } else if (metricId === 'resistance') {
                value = daySessions.filter(s => s.type === 'punishment').length;
            } else {
                value = daySessions.length;
            }

            return { 
                name: dateStr.split('-').slice(2).join('.'), 
                fullDate: dateStr,
                value: Math.round(value) 
            };
        });

        setTrendData(data);
    };

    const handleCardClick = (metricId, title) => { 
        calculateTrend(metricId); 
        setSelectedMetric({id: metricId, title}); 
    };

    // --- Forensik Daten ---
    const forensics = useMemo(() => {
        const archived = items.filter(i => i.status === 'archived');
        let totalCost = 0;
        let totalWears = 0;
        items.forEach(i => {
            totalCost += (parseFloat(i.cost) || 0);
            totalWears += (i.wearCount || 0);
        });
        const realizedCPW = totalWears > 0 ? (totalCost / totalWears) : 0;

        const reasonCounts = {};
        archived.forEach(i => {
            const r = i.archiveReason || 'Unbekannt';
            reasonCounts[r] = (reasonCounts[r] || 0) + 1;
        });
        const reasonsData = Object.keys(reasonCounts).map((key, idx) => ({
            id: key, label: key, value: reasonCounts[key], color: CHART_THEME.colors[idx % CHART_THEME.colors.length]
        }));

        return { archivedCount: archived.length, realizedCPW, reasonsData };
    }, [items]);

    if (loading) return <Box sx={{display:'flex', justifyContent:'center', mt:10}}><CircularProgress/></Box>;

    const metrics = [
        { id: 'enclosure', title: 'Enclosure', val: `${kpi.enclosure}%`, sub: 'Bestands-Dichte', icon: Icons.Layers, color: PALETTE.accents.pink },
        { id: 'nocturnal', title: 'Nocturnal', val: `${kpi.nocturnal}%`, sub: 'Nacht-Quote', icon: Icons.Night, color: PALETTE.accents.purple },
        { id: 'cpnh', title: 'CPNH', val: `${kpi.cpnh}€`, sub: 'Cost/NylonHour', icon: TrendingUpIcon, color: PALETTE.accents.green },
        { id: 'ladder', title: 'Attrition', val: kpi.ladderVelocity, sub: 'Archiviert Total', icon: BrokenImageIcon, color: PALETTE.accents.red },
        { id: 'exposure', title: 'Exposure', val: `${kpi.exposure}%`, sub: 'Zeit getragen', icon: AccessTimeIcon, color: PALETTE.primary.main },
        { id: 'resistance', title: 'Resistance', val: `${kpi.resistance}%`, sub: 'Straf-Quote', icon: SecurityIcon, color: PALETTE.accents.gold },
        { id: 'vibe', title: 'Vibe', val: kpi.vibe, sub: 'Dominanter Stil', icon: PsychologyIcon, color: PALETTE.accents.blue },
        { id: 'velocity', title: 'Latency', val: '24h', sub: 'Recovery Avg', icon: SpeedIcon, color: PALETTE.text.secondary },
    ];

    const getUnit = (metricId) => {
        if (metricId === 'exposure') return ' min';
        if (metricId === 'enclosure' || metricId === 'nocturnal') return '%';
        return '';
    };

    return (
        <Box sx={DESIGN_TOKENS.bottomNavSpacer}>
            <Container maxWidth="md">
            <motion.div variants={MOTION.listContainer} initial="hidden" animate="show">
                
                <motion.div variants={MOTION.listItem}>
                    <Typography variant="h4" gutterBottom sx={DESIGN_TOKENS.textGradient}>Statistik</Typography>
                    <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}><Icons.Flame color="secondary"/> Core Metrics</Typography>
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
                                    background: `linear-gradient(135deg, rgba(18,18,18,0.4) 0%, ${m.color}10 100%)`,
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s',
                                    '&:hover': { transform: 'translateY(-2px)', borderColor: m.color }
                                }}
                            >
                                <CardContent sx={{ p: 2, textAlign: 'center' }}>
                                    <m.icon sx={{ color: m.color, fontSize: 28, mb: 1 }} />
                                    <Typography variant="h5" fontWeight="bold" sx={{ color: '#fff' }}>{m.val}</Typography>
                                    <Typography variant="caption" sx={{ color: m.color, display:'block', fontWeight:'bold', textTransform:'uppercase', fontSize:'0.65rem' }}>{m.title}</Typography>
                                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize:'0.6rem' }}>{m.sub}</Typography>
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
                            <Typography variant="caption" color="error">GLOBAL COST PER WEAR</Typography>
                            <Typography variant="h4" fontWeight="bold" color="#fff">{forensics.realizedCPW.toFixed(2)} €</Typography>
                            <Typography variant="caption" color="text.secondary">Investition pro Nutzung</Typography>
                        </Paper>
                    </Grid>
                    
                    <Grid item xs={12} sm={8} component={motion.div} variants={MOTION.listItem}>
                        <Paper sx={{ p: 2, height: 350, ...DESIGN_TOKENS.glassCard }}>
                            <Typography variant="subtitle2" gutterBottom align="center">Verlust-Ursachen</Typography>
                            {forensics.reasonsData.length > 0 ? (
                                <Box sx={{height: 300}}>
                                <NivoPie
                                    data={forensics.reasonsData}
                                    theme={{
                                        textColor: '#fff',
                                        fontSize: 12,
                                        tooltip: { container: { background: '#333', color: '#fff' } }
                                    }}
                                    margin={{ top: 20, right: 80, bottom: 40, left: 80 }}
                                    innerRadius={0.6} padAngle={0.7} cornerRadius={3}
                                    activeOuterRadiusOffset={8}
                                    colors={{ datum: 'data.color' }}
                                    borderWidth={1} borderColor={{ from: 'color', modifiers: [ [ 'darker', 0.2 ] ] }}
                                    arcLinkLabelsSkipAngle={10}
                                    arcLinkLabelsTextColor="#e0e0e0"
                                    arcLinkLabelsThickness={2}
                                    arcLinkLabelsColor={{ from: 'color' }}
                                    arcLabelsSkipAngle={10}
                                    arcLabelsTextColor={{ from: 'color', modifiers: [ [ 'darker', 2 ] ] }}
                                />
                                </Box>
                            ) : (
                                <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Typography color="text.secondary">Keine Daten verfügbar</Typography>
                                </Box>
                            )}
                        </Paper>
                    </Grid>
                </Grid>
            </motion.div>

            {/* DETAIL DIALOG MIT CHART */}
            <Dialog open={!!selectedMetric} onClose={() => setSelectedMetric(null)} fullWidth maxWidth="sm" PaperProps={DESIGN_TOKENS.dialog.paper}>
                <DialogTitle sx={DESIGN_TOKENS.dialog.title.sx}>
                    <Box><Typography variant="h6">{selectedMetric?.title} Trend (30 Tage)</Typography></Box>
                    <IconButton onClick={() => setSelectedMetric(null)} sx={{ color: 'white' }}><Icons.Close /></IconButton>
                </DialogTitle>
                <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
                    {['enclosure', 'nocturnal', 'exposure', 'resistance', 'cpnh', 'ladder'].includes(selectedMetric?.id) ? (
                        <>
                        <Box sx={{ height: 300, mt: 2 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData}>
                                    <defs>
                                        <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={PALETTE.accents.pink} stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor={PALETTE.accents.pink} stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid.line.stroke} />
                                    <XAxis dataKey="name" stroke={CHART_THEME.textColor} tick={{fontSize: 10}} interval={4} />
                                    <YAxis stroke={CHART_THEME.textColor} tick={{fontSize: 10}} unit={getUnit(selectedMetric?.id)} width={35} />
                                    <RechartsTooltip 
                                        contentStyle={CHART_THEME.tooltip.container} 
                                        formatter={(value) => [value + getUnit(selectedMetric?.id), "Wert"]}
                                        labelFormatter={(label) => `Tag: ${label}`}
                                    />
                                    <Area type="monotone" dataKey="value" stroke={PALETTE.accents.pink} fillOpacity={1} fill="url(#colorVal)" animationDuration={1000} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </Box>
                        <Typography variant="caption" color="text.secondary" align="center" display="block" sx={{mt:2}}>
                            Gleitender Durchschnitt (5 Tage) • Letzte 30 Tage
                        </Typography>
                        </>
                    ) : (
                        <Box sx={{ py: 4, textAlign: 'center' }}>
                            <Typography color="text.secondary">Für diese statische Metrik ist kein Zeitverlauf verfügbar.</Typography>
                        </Box>
                    )}
                </DialogContent>
            </Dialog>
            </Container>
        </Box>
    );
}
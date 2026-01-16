import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useKPIs } from '../hooks/useKPIs'; // Single Source of Truth
import { 
    Box, Typography, Grid, Paper, Card, CardContent, CircularProgress, 
    Container, Dialog, DialogTitle, DialogContent, IconButton, Chip, Divider 
} from '@mui/material';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
    ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { motion } from 'framer-motion';

import { DESIGN_TOKENS, PALETTE, MOTION, CHART_THEME } from '../theme/obsidianDesign';
import { Icons } from '../theme/appIcons';

// Icons
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SpeedIcon from '@mui/icons-material/Speed';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PsychologyIcon from '@mui/icons-material/Psychology';
import TimerIcon from '@mui/icons-material/Timer';
import SecurityIcon from '@mui/icons-material/Security';

export default function Statistics() {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [selectedMetric, setSelectedMetric] = useState(null); 
    const [trendData, setTrendData] = useState([]); 

    // --- 1. DATA LOADING ---
    useEffect(() => {
        if (!currentUser) return;
        const loadData = async () => {
            setLoading(true);
            try {
                // Items laden
                const iSnap = await getDocs(collection(db, `users/${currentUser.uid}/items`));
                const loadedItems = iSnap.docs.map(d => ({ 
                    id: d.id, ...d.data(), 
                    purchaseDate: d.data().purchaseDate?.toDate ? d.data().purchaseDate.toDate() : new Date(d.data().purchaseDate || Date.now()) 
                }));
                setItems(loadedItems);

                // History laden (für Stats zwingend notwendig)
                const sSnap = await getDocs(query(collection(db, `users/${currentUser.uid}/sessions`), orderBy('startTime', 'asc')));
                const loadedSessions = sSnap.docs.map(d => ({ 
                    id: d.id, ...d.data(), 
                    startTime: d.data().startTime?.toDate ? d.data().startTime.toDate() : new Date(d.data().startTime),
                    endTime: d.data().endTime?.toDate ? d.data().endTime.toDate() : (d.data().endTime ? new Date(d.data().endTime) : null)
                }));
                setSessions(loadedSessions);

            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        loadData();
    }, [currentUser]);

    // --- 2. KPI CALCULATION (Via Hook) ---
    // Wir übergeben 'sessions' als drittes Argument (history)
    const { coreMetrics, basics } = useKPIs(items, [], sessions);

    // --- 3. CHART LOGIK (Bleibt hier, da UI-spezifisch) ---
    const calculateTrend = (metricId) => {
        const displayDays = 30;
        const windowSize = 5;
        const totalDaysNeeded = displayDays + windowSize - 1;

        const rawData = [];
        const today = new Date();
        
        for (let i = 0; i < totalDaysNeeded; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() - (totalDaysNeeded - 1 - i));
            const dateStr = d.toISOString().split('T')[0];

            const daySessions = sessions.filter(s => {
                if (!s.startTime) return false;
                const sDate = s.startTime.toISOString().split('T')[0];
                return sDate === dateStr;
            });

            let val = 0;
            
            if (metricId === 'exposure') {
                const mins = daySessions.reduce((acc, s) => {
                    const end = s.endTime || new Date();
                    return acc + (end - s.startTime) / 60000;
                }, 0);
                val = mins / 60; 
            } 
            else if (metricId === 'nocturnal') {
                const total = daySessions.length;
                if (total > 0) {
                    const night = daySessions.filter(s => s.period && s.period.includes('night')).length;
                    val = (night / total) * 100;
                }
            }
            else if (metricId === 'resistance') {
                val = daySessions.filter(s => s.type === 'punishment').length;
            }
            else if (metricId === 'compliance') {
                const relevant = daySessions.filter(s => typeof s.complianceLagMinutes === 'number');
                if (relevant.length > 0) {
                    const sum = relevant.reduce((acc, s) => acc + s.complianceLagMinutes, 0);
                    val = sum / relevant.length;
                }
            }
            else {
                val = daySessions.length;
            }
            
            rawData.push({ date: dateStr, val });
        }

        const smoothedData = [];
        for (let i = windowSize - 1; i < rawData.length; i++) {
            const windowSlice = rawData.slice(i - windowSize + 1, i + 1);
            const sum = windowSlice.reduce((acc, curr) => acc + curr.val, 0);
            const avg = sum / windowSize;
            const currentDay = rawData[i];
            
            smoothedData.push({
                name: currentDay.date.split('-').slice(2).join('.'),
                fullDate: currentDay.date,
                value: parseFloat(avg.toFixed(2))
            });
        }
        setTrendData(smoothedData);
    };

    const handleCardClick = (metricId, title) => { 
        if (['exposure', 'nocturnal', 'resistance', 'enclosure', 'compliance'].includes(metricId)) {
            calculateTrend(metricId);
            setSelectedMetric({id: metricId, title}); 
        } else {
            setSelectedMetric(null);
        }
    };

    // Forensik Helper
    const forensics = {
        archivedCount: basics?.archived || 0,
        realizedCPW: 0, // Könnte man auch in useKPIs schieben, aber hier ok
        reasonsData: []
    };
    
    // Einfache Berechnung für Pie Chart (bleibt hier für Performance/Rendering Logic)
    if (items.length > 0) {
        const archived = items.filter(i => i.status === 'archived');
        let totalCost = 0; let totalWears = 0;
        items.forEach(i => { totalCost += (parseFloat(i.cost)||0); totalWears += (i.wearCount||0); });
        forensics.realizedCPW = totalWears > 0 ? (totalCost / totalWears) : 0;
        
        const reasonCounts = {};
        archived.forEach(i => { const r = i.archiveReason || 'Unbekannt'; reasonCounts[r] = (reasonCounts[r]||0) + 1; });
        forensics.reasonsData = Object.keys(reasonCounts).map((key, idx) => ({
            name: key, value: reasonCounts[key], color: CHART_THEME.colors[idx % CHART_THEME.colors.length]
        }));
    }

    const getUnit = (metricId) => {
        if (metricId === 'exposure') return ' h';
        if (metricId === 'nocturnal') return ' %';
        if (metricId === 'compliance') return ' m';
        return '';
    };

    if (loading) return <Box sx={{display:'flex', justifyContent:'center', mt:10}}><CircularProgress/></Box>;

    const metrics = [
        { id: 'enclosure', title: 'Enclosure', val: `${coreMetrics.enclosure}%`, sub: 'Nylon-Quote', icon: Icons.Layers, color: PALETTE.accents.pink },
        { id: 'nocturnal', title: 'Nocturnal', val: `${coreMetrics.nocturnal}%`, sub: 'Nacht-Quote', icon: Icons.Night, color: PALETTE.accents.purple },
        { id: 'cpnh', title: 'CPNH', val: `${coreMetrics.cpnh}€`, sub: 'Cost/Hour', icon: TrendingUpIcon, color: PALETTE.accents.green },
        { id: 'compliance', title: 'Compliance Lag', val: `${coreMetrics.complianceLag}m`, sub: 'Ø Verzögerung', icon: TimerIcon, color: PALETTE.accents.red },
        { id: 'exposure', title: 'Exposure', val: `${coreMetrics.exposure}%`, sub: 'Tragezeit-Ratio', icon: AccessTimeIcon, color: PALETTE.primary.main },
        { id: 'resistance', title: 'Resistance', val: `${coreMetrics.resistance}%`, sub: 'Straf-Quote', icon: SecurityIcon, color: PALETTE.accents.gold },
        { id: 'vibe', title: 'Vibe', val: coreMetrics.vibe, sub: 'Dominanz', icon: PsychologyIcon, color: PALETTE.accents.blue },
        { id: 'velocity', title: 'Sessions', val: coreMetrics.sessionCount, sub: 'Total', icon: SpeedIcon, color: PALETTE.text.secondary },
    ];

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
                                    cursor: ['exposure', 'nocturnal', 'resistance', 'compliance', 'enclosure'].includes(m.id) ? 'pointer' : 'default',
                                    transition: 'transform 0.2s',
                                    '&:hover': { transform: 'translateY(-2px)', borderColor: m.color }
                                }}
                            >
                                <CardContent sx={{ p: 2, textAlign: 'center' }}>
                                    <m.icon sx={{ color: m.color, fontSize: 28, mb: 1 }} />
                                    <Typography variant="h5" fontWeight="bold" sx={{ color: PALETTE.text.primary }}>{m.val}</Typography>
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
                            <Typography variant="caption" color="error">GLOBAL CPW</Typography>
                            <Typography variant="h4" fontWeight="bold" color={PALETTE.text.primary}>{forensics.realizedCPW.toFixed(2)} €</Typography>
                            <Typography variant="caption" color="text.secondary">Investition pro Nutzung</Typography>
                        </Paper>
                    </Grid>
                    
                    <Grid item xs={12} sm={8} component={motion.div} variants={MOTION.listItem}>
                        <Paper sx={{ p: 2, height: 350, ...DESIGN_TOKENS.glassCard }}>
                            <Typography variant="subtitle2" gutterBottom align="center">Verlust-Ursachen</Typography>
                            {forensics.reasonsData.length > 0 ? (
                                <Box sx={{height: 300, width: '100%'}}>
                                    <ResponsiveContainer>
                                        <PieChart>
                                            <Pie
                                                data={forensics.reasonsData}
                                                cx="50%" cy="50%"
                                                innerRadius={60} outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {forensics.reasonsData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip contentStyle={{ backgroundColor: '#000', borderRadius: '8px', border: 'none' }} />
                                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                        </PieChart>
                                    </ResponsiveContainer>
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

            {/* TREND DIALOG */}
            <Dialog open={!!selectedMetric} onClose={() => setSelectedMetric(null)} fullWidth maxWidth="sm" PaperProps={DESIGN_TOKENS.dialog.paper}>
                <DialogTitle sx={DESIGN_TOKENS.dialog.title.sx}>
                    <Box><Typography variant="h6">{selectedMetric?.title} Trend</Typography></Box>
                    <IconButton onClick={() => setSelectedMetric(null)} sx={{ color: 'white' }}><Icons.Close /></IconButton>
                </DialogTitle>
                <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
                    <Box sx={{ height: 300, mt: 2 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={PALETTE.accents.pink} stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor={PALETTE.accents.pink} stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid.line.stroke} vertical={false} />
                                <XAxis 
                                    dataKey="name" 
                                    stroke={CHART_THEME.textColor} 
                                    tick={{fontSize: 10}} 
                                    interval={4} 
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis 
                                    stroke={CHART_THEME.textColor} 
                                    tick={{fontSize: 10}} 
                                    unit={getUnit(selectedMetric?.id)} 
                                    width={35} 
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <RechartsTooltip 
                                    contentStyle={CHART_THEME.tooltip.container} 
                                    formatter={(value) => [value + getUnit(selectedMetric?.id), "Ø 5 Tage"]}
                                    labelFormatter={(label) => `Tag: ${label}`}
                                    cursor={{ stroke: PALETTE.primary.main, strokeWidth: 1 }}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke={PALETTE.accents.pink} 
                                    fillOpacity={1} 
                                    fill="url(#colorVal)" 
                                    animationDuration={1000} 
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </Box>
                    <Typography variant="caption" color="text.secondary" align="center" display="block" sx={{mt:2}}>
                        Gleitender Durchschnitt (5 Tage) • Letzte 30 Tage
                    </Typography>
                </DialogContent>
            </Dialog>
            </Container>
        </Box>
    );
}
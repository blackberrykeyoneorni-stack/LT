import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import useKPIs from '../hooks/useKPIs'; 
import { 
    Box, Typography, Grid, Paper, Card, CardContent, CircularProgress, 
    Container, Dialog, DialogTitle, DialogContent, IconButton, Chip, Divider 
} from '@mui/material';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
    ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar 
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
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'; 
import ShieldIcon from '@mui/icons-material/Shield'; 

const safeDate = (val) => {
    if (!val) return null;
    if (typeof val.toDate === 'function') {
        return val.toDate();
    }
    if (val instanceof Date) {
        return val;
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
};

const calculateDailyNylonWearMinutes = (targetDate, sessions, items) => {
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const relevantSessions = sessions.filter(s => {
        const sStart = safeDate(s.startTime);
        const sEnd = safeDate(s.endTime); 
        if (!sStart) return false;
        if (sStart > endOfDay) return false;
        if (sEnd && sEnd < startOfDay) return false;
        
        const sItemIds = s.itemIds || (s.itemId ? [s.itemId] : []);
        return sItemIds.some(id => {
            const item = items.find(i => i.id === id);
            if (!item) return false;
            const cat = (item.mainCategory || '').toLowerCase();
            const sub = (item.subCategory || '').toLowerCase();
            return cat.includes('nylon') || sub.includes('strumpfhose') || sub.includes('stockings');
        });
    });

    const intervals = relevantSessions.map(s => {
        const sStart = safeDate(s.startTime);
        const sEnd = safeDate(s.endTime) || new Date(); 
        const start = Math.max(sStart.getTime(), startOfDay.getTime());
        const end = Math.min(sEnd.getTime(), endOfDay.getTime());
        return { start, end };
    }).filter(i => i.end > i.start);

    if (intervals.length === 0) return 0;

    intervals.sort((a, b) => a.start - b.start);
    const merged = [];
    let current = intervals[0];
    for (let i = 1; i < intervals.length; i++) {
        if (intervals[i].start < current.end) {
            current.end = Math.max(current.end, intervals[i].end);
        } else {
            merged.push(current);
            current = intervals[i];
        }
    }
    merged.push(current);

    const totalMs = merged.reduce((acc, i) => acc + (i.end - i.start), 0);
    return Math.floor(totalMs / 60000);
};

const calculateDailyActiveMinutes = (targetDate, sessions) => {
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const relevantSessions = sessions.filter(s => {
        const sStart = safeDate(s.startTime);
        if (!sStart) return false;
        if (sStart > endOfDay) return false;
        const sEnd = safeDate(s.endTime);
        if (sEnd && sEnd < startOfDay) return false;
        return true;
    });

    const intervals = relevantSessions.map(s => {
        const sStart = safeDate(s.startTime);
        const sEnd = safeDate(s.endTime) || new Date(); 
        const start = Math.max(sStart.getTime(), startOfDay.getTime());
        const end = Math.min(sEnd.getTime(), endOfDay.getTime());
        return { start, end };
    }).filter(i => i.end > i.start);

    if (intervals.length === 0) return 0;

    intervals.sort((a, b) => a.start - b.start);
    const merged = [];
    let current = intervals[0];
    for (let i = 1; i < intervals.length; i++) {
        if (intervals[i].start < current.end) {
            current.end = Math.max(current.end, intervals[i].end);
        } else {
            merged.push(current);
            current = intervals[i];
        }
    }
    merged.push(current);

    const totalMs = merged.reduce((acc, i) => acc + (i.end - i.start), 0);
    return Math.floor(totalMs / 60000);
};

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
                const loadedItems = iSnap.docs.map(d => ({ 
                    id: d.id, ...d.data(), 
                    purchaseDate: safeDate(d.data().purchaseDate) || new Date()
                }));
                setItems(loadedItems);

                const sSnap = await getDocs(query(collection(db, `users/${currentUser.uid}/sessions`), orderBy('startTime', 'asc')));
                const loadedSessions = sSnap.docs.map(d => ({ 
                    id: d.id, ...d.data(), 
                    startTime: safeDate(d.data().startTime) || new Date(),
                    endTime: safeDate(d.data().endTime)
                }));
                setSessions(loadedSessions);

            } catch (e) { console.error("Stats Load Error:", e); } 
            finally { setLoading(false); }
        };
        loadData();
    }, [currentUser]);

    const { coreMetrics, basics } = useKPIs(items, [], sessions);

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
            
            if (metricId === 'coverage') {
                const activeMins = calculateDailyActiveMinutes(d, sessions);
                val = (activeMins / 1440) * 100;
            } 
            else if (metricId === 'nocturnal') {
                const checkTime = new Date(d);
                checkTime.setHours(2, 0, 0, 0); 
                const checkTs = checkTime.getTime();
                const isWorn = sessions.some(s => {
                     const start = s.startTime; 
                     const end = s.endTime; 
                     if (!start) return false;
                     if (checkTs >= start.getTime() && (!end || checkTs <= end.getTime())) {
                         const sItemIds = s.itemIds || (s.itemId ? [s.itemId] : []);
                         return sItemIds.some(id => {
                             const item = items.find(i => i.id === id);
                             if (!item) return false;
                             const sub = (item.subCategory || '').toLowerCase();
                             return sub.includes('strumpfhose');
                         });
                     }
                     return false;
                });
                val = isWorn ? 100 : 0;
            }
            else if (metricId === 'nylonGap') { 
                const wornMins = calculateDailyNylonWearMinutes(d, sessions, items);
                const gapMins = 1440 - wornMins;
                val = Math.max(0, gapMins) / 60;
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
            else if (metricId === 'voluntarism') {
                let totalMs = 0;
                let volMs = 0;
                daySessions.forEach(s => {
                    const end = s.endTime || new Date();
                    totalMs += (end - s.startTime);
                    if(s.type === 'voluntary') volMs += (end - s.startTime);
                });
                val = totalMs > 0 ? (volMs / totalMs) * 100 : 0;
            }
            else if (metricId === 'endurance') {
                let dMins = 0;
                let dCount = 0;
                daySessions.forEach(s => {
                    const end = s.endTime || new Date();
                    dMins += (end - s.startTime) / 60000;
                    dCount++;
                });
                val = dCount > 0 ? (dMins / dCount / 60) : 0;
            }
            else if (metricId === 'nylonEnclosure') {
                 let globalMs = 0;
                 let nylonMs = 0;
                 daySessions.forEach(s => {
                     const end = s.endTime || new Date();
                     const dur = end - s.startTime;
                     globalMs += dur;
                     const sItemIds = s.itemIds || (s.itemId ? [s.itemId] : []);
                     const hasNylon = sItemIds.some(id => {
                        const item = items.find(i => i.id === id);
                        if (!item) return false;
                        const cat = (item.mainCategory || '').toLowerCase();
                        const sub = (item.subCategory || '').toLowerCase();
                        return cat.includes('nylon') || sub.includes('strumpfhose') || sub.includes('stockings');
                     });
                     if(hasNylon) nylonMs += dur;
                 });
                 val = globalMs > 0 ? (nylonMs / globalMs) * 100 : 0;
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
        if (['coverage', 'nocturnal', 'nylonGap', 'resistance', 'nylonEnclosure', 'compliance', 'voluntarism', 'endurance'].includes(metricId)) {
            calculateTrend(metricId);
            setSelectedMetric({id: metricId, title}); 
        } else {
            setSelectedMetric(null);
        }
    };

    // Forensik Helper
    const forensics = {
        archivedCount: basics?.archived || 0,
        realizedCPW: 0,
        reasonsData: [],
        lossValueData: []
    };
    
    if (items.length > 0) {
        const archived = items.filter(i => i.status === 'archived');
        let totalCost = 0; let totalWears = 0;
        const reasonCounts = {};
        const reasonValues = {};

        archived.forEach(i => { 
            const cost = parseFloat(i.cost)||0;
            totalCost += cost; 
            totalWears += (i.wearCount||0); 
            const r = i.archiveReason || 'Unbekannt'; 
            reasonCounts[r] = (reasonCounts[r]||0) + 1;
            reasonValues[r] = (reasonValues[r]||0) + cost;
        });
        
        forensics.realizedCPW = totalWears > 0 ? (totalCost / totalWears) : 0;
        
        forensics.reasonsData = Object.keys(reasonCounts).map((key, idx) => ({
            name: key, value: reasonCounts[key], color: CHART_THEME.colors[idx % CHART_THEME.colors.length]
        }));

        forensics.lossValueData = Object.keys(reasonValues).map((key, idx) => ({
            name: key, value: reasonValues[key], color: CHART_THEME.colors[idx % CHART_THEME.colors.length]
        })).sort((a,b) => b.value - a.value); // Sortiert nach Verlusthöhe
    }

    const getUnit = (metricId) => {
        if (metricId === 'coverage') return ' %'; 
        if (metricId === 'endurance') return ' h';
        if (metricId === 'nylonGap') return ' h'; 
        if (metricId === 'nocturnal') return ' %';
        if (metricId === 'nylonEnclosure') return ' %';
        if (metricId === 'voluntarism') return ' %';
        if (metricId === 'compliance') return ' m';
        return '';
    };

    if (loading) return <Box sx={{display:'flex', justifyContent:'center', mt:10}}><CircularProgress/></Box>;

    const metrics = [
        { id: 'nylonEnclosure', title: 'Nylon Enclosure', val: `${coreMetrics.nylonEnclosure}%`, sub: 'Tragezeit-Anteil', icon: Icons.Layers, color: PALETTE.accents.pink },
        { id: 'nocturnal', title: 'Nocturnal', val: `${coreMetrics.nocturnal}%`, sub: 'Nacht-Quote', icon: Icons.Night, color: PALETTE.accents.purple },
        { id: 'nylonGap', title: 'Nylon Gap', val: coreMetrics.nylonGap, sub: 'Ø Lücke/Tag', icon: HourglassEmptyIcon, color: '#00e5ff' },
        { id: 'cpnh', title: 'CPNH', val: `${coreMetrics.cpnh}€`, sub: 'Cost/Hour', icon: TrendingUpIcon, color: PALETTE.accents.green },
        { id: 'compliance', title: 'Compliance Lag', val: coreMetrics.complianceLag, sub: 'Ø Verzögerung', icon: TimerIcon, color: PALETTE.accents.red },
        { id: 'coverage', title: 'Coverage', val: `${coreMetrics.coverage}%`, sub: 'Abdeckung (7d)', icon: ShieldIcon, color: PALETTE.primary.main },
        { id: 'resistance', title: 'Resistance', val: `${coreMetrics.resistance}%`, sub: 'Straf-Quote', icon: SecurityIcon, color: PALETTE.accents.gold },
        { id: 'voluntarism', title: 'Voluntarism', val: coreMetrics.voluntarism, sub: 'Zeit-Verhältnis', icon: PsychologyIcon, color: PALETTE.accents.blue },
        { id: 'endurance', title: 'Endurance', val: coreMetrics.endurance, sub: `Nyl: ${coreMetrics.enduranceNylon} • Des: ${coreMetrics.enduranceDessous}`, icon: SpeedIcon, color: PALETTE.text.secondary },
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
                        <Grid item xs={6} sm={3} key={m.id}>
                            <motion.div variants={MOTION.listItem} style={{ height: '100%' }}>
                                <Card 
                                    onClick={() => handleCardClick(m.id, m.title)}
                                    sx={{ 
                                        height: '100%', 
                                        ...DESIGN_TOKENS.glassCard,
                                        borderColor: `1px solid ${m.color}40`,
                                        cursor: m.id !== 'cpnh' ? 'pointer' : 'default',
                                        transition: 'transform 0.2s',
                                        '&:hover': { transform: m.id !== 'cpnh' ? 'translateY(-2px)' : 'none', borderColor: m.color }
                                    }}
                                >
                                    <CardContent sx={{ p: 2, textAlign: 'center' }}>
                                        <m.icon sx={{ color: m.color, fontSize: 28, mb: 1 }} />
                                        <Typography variant="h5" fontWeight="bold" sx={{ color: PALETTE.text.primary, fontSize: '1.1rem' }}>{m.val}</Typography>
                                        <Typography variant="caption" sx={{ color: m.color, display:'block', fontWeight:'bold', textTransform:'uppercase', fontSize:'0.65rem' }}>{m.title}</Typography>
                                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize:'0.6rem' }}>{m.sub}</Typography>
                                    </CardContent>
                                </Card>
                            </motion.div>
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
                    {/* GLOBAL CPW CARD */}
                    <Grid item xs={12} sm={4}>
                         <motion.div variants={MOTION.listItem} style={{ height: '100%' }}>
                            <Paper sx={{ p: 2, height: '100%', border: `1px solid ${PALETTE.accents.crimson}`, bgcolor: `${PALETTE.accents.crimson}10`, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRadius: '12px' }}>
                                <Typography variant="caption" color="error">GLOBAL CPW</Typography>
                                <Typography variant="h4" fontWeight="bold" color={PALETTE.text.primary}>{forensics.realizedCPW.toFixed(2)} €</Typography>
                                <Typography variant="caption" color="text.secondary">Investition pro Nutzung</Typography>
                            </Paper>
                        </motion.div>
                    </Grid>
                    
                    {/* CHARTS: PIE & BAR */}
                    <Grid item xs={12} sm={8}>
                        <motion.div variants={MOTION.listItem} style={{ height: '100%' }}>
                            <Paper sx={{ p: 2, ...DESIGN_TOKENS.glassCard }}>
                                <Grid container spacing={2}>
                                    {/* Pie Chart: Anzahl */}
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
                                    
                                    {/* Bar Chart: Wertverlust */}
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
            </motion.div>

            {/* TREND DIALOG (unverändert) */}
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
                                        <stop offset="5%" stopColor={selectedMetric?.id === 'nylonGap' ? '#00e5ff' : PALETTE.accents.pink} stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor={selectedMetric?.id === 'nylonGap' ? '#00e5ff' : PALETTE.accents.pink} stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid.line.stroke} vertical={false} />
                                <XAxis dataKey="name" stroke={CHART_THEME.textColor} tick={{fontSize: 10}} interval={4} axisLine={false} tickLine={false} />
                                <YAxis stroke={CHART_THEME.textColor} tick={{fontSize: 10}} unit={getUnit(selectedMetric?.id)} width={35} axisLine={false} tickLine={false} />
                                <RechartsTooltip contentStyle={CHART_THEME.tooltip.container} formatter={(value) => [value + getUnit(selectedMetric?.id), "Ø 5 Tage"]} labelFormatter={(label) => `Tag: ${label}`} cursor={{ stroke: PALETTE.primary.main, strokeWidth: 1 }} />
                                <Area type="monotone" dataKey="value" stroke={selectedMetric?.id === 'nylonGap' ? '#00e5ff' : PALETTE.accents.pink} fillOpacity={1} fill="url(#colorVal)" animationDuration={1000} strokeWidth={2} />
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
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
    ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
    ResponsiveContainer, PieChart, Pie, Cell, BarChart 
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
import WarningIcon from '@mui/icons-material/Warning';
import NightlightRoundIcon from '@mui/icons-material/NightlightRound';
import Battery0BarIcon from '@mui/icons-material/Battery0Bar';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

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

    const { coreMetrics, basics, deepAnalytics } = useKPIs(items, [], sessions);

    const calculateTrend = (metricId) => {
        const rawData = [];
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        for (let i = 5; i >= 0; i--) {
            let m = currentMonth - i;
            let y = currentYear;
            if (m < 0) {
                m += 12;
                y -= 1;
            }
            
            const startOfMonth = new Date(y, m, 1);
            const endOfMonth = new Date(y, m + 1, 0);
            const actualEnd = endOfMonth > today ? today : endOfMonth;
            const daysInMonth = actualEnd.getDate();
            
            let monthlySum = 0;
            
            if (metricId === 'cpnh') {
                const validItems = items.filter(it => {
                    const pd = safeDate(it.purchaseDate) || new Date(0);
                    const cat = (it.mainCategory || '').toLowerCase();
                    const sub = (it.subCategory || '').toLowerCase();
                    const isNylon = cat.includes('nylon') || sub.includes('strumpfhose') || sub.includes('stockings');
                    return isNylon && pd <= actualEnd && it.status !== 'archived';
                });
                
                let totalCost = validItems.reduce((sum, it) => sum + (Number(it.cost) || 0), 0);
                
                let totalNylonMs = 0;
                sessions.forEach(s => {
                    const sStart = safeDate(s.startTime);
                    const sEnd = safeDate(s.endTime) || new Date();
                    if (sStart && sStart <= actualEnd) {
                        const sItemIds = s.itemIds || (s.itemId ? [s.itemId] : []);
                        const hasNylon = sItemIds.some(id => validItems.find(vi => vi.id === id));
                        if (hasNylon) {
                            const clampEnd = sEnd > actualEnd ? actualEnd : sEnd;
                            totalNylonMs += Math.max(0, clampEnd - sStart);
                        }
                    }
                });
                
                const totalHours = totalNylonMs / 3600000;
                let val = totalHours > 0 ? totalCost / totalHours : 0;
                
                const monthName = startOfMonth.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
                rawData.push({ name: monthName, value: val });
                continue;
            }

            for (let d = 1; d <= daysInMonth; d++) {
                const currentDate = new Date(y, m, d);
                const startOfDay = new Date(currentDate); startOfDay.setHours(0,0,0,0);
                const endOfDay = new Date(currentDate); endOfDay.setHours(23,59,59,999);
                
                const daySessions = sessions.filter(s => {
                    const sStart = safeDate(s.startTime);
                    const sEnd = safeDate(s.endTime) || new Date();
                    if (!sStart) return false;
                    return (sStart <= endOfDay && sEnd >= startOfDay);
                });

                let val = 0;
                if (metricId === 'coverage') {
                    const activeMins = calculateDailyActiveMinutes(currentDate, sessions);
                    val = (activeMins / 1440) * 100;
                } 
                else if (metricId === 'nocturnal') {
                    const checkTime = new Date(currentDate);
                    checkTime.setHours(2, 0, 0, 0); 
                    const checkTs = checkTime.getTime();
                    const isWorn = sessions.some(s => {
                         const start = safeDate(s.startTime); 
                         const end = safeDate(s.endTime) || new Date(); 
                         if (!start) return false;
                         if (checkTs >= start.getTime() && checkTs <= end.getTime()) {
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
                    const wornMins = calculateDailyNylonWearMinutes(currentDate, sessions, items);
                    val = Math.max(0, 1440 - wornMins) / 60;
                }
                else if (metricId === 'resistance') {
                    val = daySessions.length > 0 ? (daySessions.filter(s => s.type === 'punishment').length / daySessions.length) * 100 : 0;
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
                        const start = safeDate(s.startTime) < startOfDay ? startOfDay : safeDate(s.startTime);
                        const end = (safeDate(s.endTime) || new Date()) > endOfDay ? endOfDay : (safeDate(s.endTime) || new Date());
                        const dur = Math.max(0, end - start);
                        totalMs += dur;
                        if(s.type === 'voluntary') volMs += dur;
                    });
                    val = totalMs > 0 ? (volMs / totalMs) * 100 : 0;
                }
                else if (metricId === 'endurance') {
                    let dMins = 0;
                    let dCount = 0;
                    daySessions.forEach(s => {
                        const start = safeDate(s.startTime) < startOfDay ? startOfDay : safeDate(s.startTime);
                        const end = (safeDate(s.endTime) || new Date()) > endOfDay ? endOfDay : (safeDate(s.endTime) || new Date());
                        dMins += Math.max(0, end - start) / 60000;
                        dCount++;
                    });
                    val = dCount > 0 ? (dMins / dCount / 60) : 0;
                }
                else if (metricId === 'nylonEnclosure') {
                     const wornMins = calculateDailyNylonWearMinutes(currentDate, sessions, items);
                     val = (wornMins / 1440) * 100;
                }
                else {
                    val = daySessions.length;
                }
                monthlySum += val;
            }
            
            const monthlyAvg = daysInMonth > 0 ? monthlySum / daysInMonth : 0;
            const monthName = startOfMonth.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
            rawData.push({ name: monthName, value: monthlyAvg });
        }

        const n = rawData.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        rawData.forEach((d, idx) => {
            sumX += idx;
            sumY += d.value;
            sumXY += (idx * d.value);
            sumX2 += (idx * idx);
        });
        
        const denominator = (n * sumX2 - sumX * sumX);
        const m_slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
        const b_intercept = denominator === 0 ? sumY / n : (sumY - m_slope * sumX) / n;

        const finalData = rawData.map((d, idx) => ({
            name: d.name,
            value: parseFloat(d.value.toFixed(2)),
            trend: Math.max(0, parseFloat((m_slope * idx + b_intercept).toFixed(2)))
        }));

        setTrendData(finalData);
    };

    const handleCardClick = (metricId, title) => { 
        if (['coverage', 'nocturnal', 'nylonGap', 'resistance', 'nylonEnclosure', 'compliance', 'voluntarism', 'endurance', 'cpnh'].includes(metricId)) {
            calculateTrend(metricId);
            setSelectedMetric({id: metricId, title}); 
        } else {
            setSelectedMetric(null);
        }
    };

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
        })).sort((a,b) => b.value - a.value); 
    }

    const getUnit = (metricId) => {
        if (metricId === 'coverage') return ' %'; 
        if (metricId === 'endurance') return ' h';
        if (metricId === 'nylonGap') return ' h'; 
        if (metricId === 'nocturnal') return ' %';
        if (metricId === 'nylonEnclosure') return ' %';
        if (metricId === 'voluntarism') return ' %';
        if (metricId === 'compliance') return ' m';
        if (metricId === 'cpnh') return ' €';
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
                                        cursor: 'pointer',
                                        transition: 'transform 0.2s',
                                        '&:hover': { transform: 'translateY(-2px)', borderColor: m.color }
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

                {/* NEU: DEEP ANALYTICS SEKTION */}
                {deepAnalytics && (
                    <motion.div variants={MOTION.listItem}>
                        <Divider sx={{ my: 4, borderColor: PALETTE.background.glassBorder }} />
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: PALETTE.accents.purple, mb: 2 }}>
                            <PsychologyIcon /> Deep Analytics (Psycho-Profil)
                        </Typography>
                        <Grid container spacing={2}>
                            {/* Krisen-Prädiktion */}
                            <Grid item xs={6} sm={3}>
                                <Paper sx={{ p: 2, ...DESIGN_TOKENS.glassCard, textAlign: 'center', height: '100%' }}>
                                    <WarningIcon sx={{ color: PALETTE.accents.red, mb: 1 }}/>
                                    <Typography variant="h6" color="text.primary">{deepAnalytics.krisenPraediktion.day}</Typography>
                                    <Typography variant="caption" color="error" display="block" sx={{ fontWeight: 'bold' }}>Risiko: {deepAnalytics.krisenPraediktion.level}</Typography>
                                    <Typography variant="caption" color="text.secondary">Krisen-Prädiktion</Typography>
                                </Paper>
                            </Grid>
                            
                            {/* Unterbewusste Adaption */}
                            <Grid item xs={6} sm={3}>
                                <Paper sx={{ p: 2, ...DESIGN_TOKENS.glassCard, textAlign: 'center', height: '100%' }}>
                                    <NightlightRoundIcon sx={{ color: PALETTE.accents.blue, mb: 1 }}/>
                                    <Typography variant="h6" color="text.primary">{deepAnalytics.unterbewussteAdaption.toFixed(1)}%</Typography>
                                    <Typography variant="caption" sx={{ color: PALETTE.accents.blue, fontWeight: 'bold' }} display="block">Physische Assimilation</Typography>
                                    <Typography variant="caption" color="text.secondary">Unterbewusste Adaption</Typography>
                                </Paper>
                            </Grid>
                            
                            {/* Willenskraft-Erschöpfungs-Matrix */}
                            <Grid item xs={6} sm={3}>
                                <Paper sx={{ p: 2, ...DESIGN_TOKENS.glassCard, textAlign: 'center', height: '100%' }}>
                                    <Battery0BarIcon sx={{ color: PALETTE.accents.gold, mb: 1 }}/>
                                    <Typography variant="h6" color="text.primary">{deepAnalytics.egoDepletionHours > 0 ? deepAnalytics.egoDepletionHours.toFixed(1) : '-'} h</Typography>
                                    <Typography variant="caption" sx={{ color: PALETTE.accents.gold, fontWeight: 'bold' }} display="block">Kritischer Brechpunkt</Typography>
                                    <Typography variant="caption" color="text.secondary">Ego-Depletion</Typography>
                                </Paper>
                            </Grid>

                            {/* Infiltrations-Eskalationsmatrix */}
                            <Grid item xs={6} sm={3}>
                                <Paper sx={{ p: 2, ...DESIGN_TOKENS.glassCard, textAlign: 'center', height: '100%' }}>
                                    <VisibilityOffIcon sx={{ color: PALETTE.accents.pink, mb: 1 }}/>
                                    <Typography variant="h6" color="text.primary">{deepAnalytics.infiltrationEskalation.toFixed(1)}%</Typography>
                                    <Typography variant="caption" sx={{ color: PALETTE.accents.pink, fontWeight: 'bold' }} display="block">Komplexe Tages-Dessous</Typography>
                                    <Typography variant="caption" color="text.secondary">Infiltrations-Eskalation</Typography>
                                </Paper>
                            </Grid>
                        </Grid>
                    </motion.div>
                )}

                <motion.div variants={MOTION.listItem}>
                    <Divider sx={{ my: 4, borderColor: PALETTE.background.glassBorder }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: PALETTE.accents.red }}><Icons.Science /> Forensik</Typography>
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
            </motion.div>

            <Dialog open={!!selectedMetric} onClose={() => setSelectedMetric(null)} fullWidth maxWidth="sm" PaperProps={DESIGN_TOKENS.dialog.paper}>
                <DialogTitle sx={DESIGN_TOKENS.dialog.title.sx}>
                    <Box><Typography variant="h6">{selectedMetric?.title} Trend</Typography></Box>
                    <IconButton onClick={() => setSelectedMetric(null)} sx={{ color: 'white' }}><Icons.Close /></IconButton>
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
            </Container>
        </Box>
    );
}
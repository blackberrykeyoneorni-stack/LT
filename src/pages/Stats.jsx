import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
    Box, Typography, Grid, Paper, Card, CardContent, CircularProgress, 
    Container, Dialog, DialogTitle, DialogContent, IconButton, Chip, Divider, Alert 
} from '@mui/material';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
    BarChart, Bar 
} from 'recharts';

// NIVO CHART IMPORT
import { ResponsivePie } from '@nivo/pie';

// FRAMER MOTION
import { motion } from 'framer-motion';

// --- NEW SYSTEM IMPORTS ---
import { DESIGN_TOKENS, PALETTE } from '../theme/obsidianDesign';
import { Icons } from '../theme/appIcons';

// --- MOTION VARIANTS ---
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
};
  
const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 100 }
    }
};

export default function Statistics() {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    
    const [items, setItems] = useState([]);
    const [sessions, setSessions] = useState([]);

    const [selectedMetric, setSelectedMetric] = useState(null); 
    const [trendData, setTrendData] = useState([]); 

    // DATEN LADEN
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
                    purchaseDate: d.data().purchaseDate?.toDate ? d.data().purchaseDate.toDate() : new Date(d.data().purchaseDate || Date.now()),
                    archivedAt: d.data().archivedAt?.toDate ? d.data().archivedAt.toDate() : null 
                }));
                setItems(loadedItems);

                // 2. Sessions laden
                const sSnap = await getDocs(query(collection(db, `users/${currentUser.uid}/sessions`), orderBy('startTime', 'asc')));
                const loadedSessions = sSnap.docs.map(d => ({ 
                    id: d.id, 
                    ...d.data(), 
                    startTime: d.data().startTime?.toDate ? d.data().startTime.toDate() : new Date(), 
                    endTime: d.data().endTime?.toDate ? d.data().endTime.toDate() : null
                }));
                setSessions(loadedSessions);

            } catch (e) { 
                console.error("Ladefehler Stats:", e); 
            } finally { 
                setLoading(false); 
            }
        };
        loadData();
    }, [currentUser]);

    // --- KPI LOGIK ---
    const kpi = useMemo(() => {
        const defaults = {
            ladderVelocity: 0, burnRate: 0, cpnh: 0, latency: 0,
            enclosure: 0, nocturnal: 0, exposure: 0,
            vibe: 'N/A', resistance: 0, complianceLag: 0,
            activeItems: 0
        };

        if (!items || items.length === 0) return defaults;

        const now = new Date();
        const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(now.getDate() - 30);

        const getNylonSessions = (sessList) => sessList.filter(s => {
            const item = items.find(i => i.id === s.itemId);
            return item && item.mainCategory === 'Nylons';
        });

        const nylonSessions = getNylonSessions(sessions);
        const totalNylonMinutes = nylonSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
        
        const archivedNylons = items.filter(i => 
            i.status === 'archived' && 
            i.mainCategory === 'Nylons' &&
            (i.totalMinutes > 0 || i.wearCount > 0)
        );
        
        const avgLifeMinutes = archivedNylons.length ? archivedNylons.reduce((acc, i) => acc + (i.totalMinutes || 0), 0) / archivedNylons.length : 0;

        const recentCosts = items.filter(i => i.purchaseDate && i.purchaseDate >= thirtyDaysAgo).reduce((acc, i) => acc + (parseFloat(i.cost) || 0), 0);

        const totalCost = items.reduce((acc, i) => acc + (parseFloat(i.cost) || 0), 0);
        const cpnh = totalNylonMinutes > 0 ? totalCost / (totalNylonMinutes / 60) : 0;

        // Kauf-Frequenz
        const purchaseDates = items.map(i => i.purchaseDate).filter(d => d).sort((a,b) => a - b);
        let totalDiffDays = 0; let diffCount = 0;
        for(let i=1; i<purchaseDates.length; i++) { 
            totalDiffDays += (purchaseDates[i] - purchaseDates[i-1]) / (1000*60*60*24); 
            diffCount++; 
        }
        const latency = diffCount > 0 ? totalDiffDays / diffCount : 0;

        // Enclosure & Nocturnal
        const tightsSessions = nylonSessions.filter(s => { 
            const item = items.find(i => i.id === s.itemId);
            return item && (item.subCategory === 'Strumpfhose' || item.subCategory === 'Strumpfhosen'); 
        });
        const enclosureIndex = totalNylonMinutes > 0 ? (tightsSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0) / totalNylonMinutes) * 100 : 0;

        let nightsWithNylon = 0;
        for(let i=0; i<30; i++) {
            const d = new Date(); d.setDate(now.getDate() - i); d.setHours(2,0,0,0);
            if(nylonSessions.some(s => s.startTime <= d && (s.endTime >= d || !s.endTime))) nightsWithNylon++;
        }
        const nocturnalRate = (nightsWithNylon / 30) * 100;

        // Exposure Gap
        const firstSessionStart = sessions.length > 0 ? sessions[0].startTime : now;
        const daysSinceStart = Math.max(1, (now - firstSessionStart) / (1000*60*60*24));
        const avgDailyNylonMins = totalNylonMinutes / daysSinceStart;
        const exposureGap = 24 - (avgDailyNylonMins / 60);

        // Vibe Analysis
        const tagCounts = {};
        nylonSessions.forEach(s => { if (s.feelings) s.feelings.forEach(f => tagCounts[f] = (tagCounts[f] || 0) + 1); });
        const topVibeEntry = Object.entries(tagCounts).sort((a,b) => b[1] - a[1])[0];
        const topVibe = topVibeEntry ? topVibeEntry[0] : 'N/A';

        // Resistance & Compliance
        const instructions = sessions.filter(s => s.type === 'instruction').length;
        const punishments = sessions.filter(s => s.type === 'punishment').length;
        const resistance = instructions > 0 ? (punishments / instructions) * 100 : 0;

        // COMPLIANCE LAG - Robustere Berechnung gegen NaN
        const recentLagSessions = sessions.filter(s => {
            const val = s.complianceLagMinutes;
            return s.startTime >= thirtyDaysAgo && typeof val === 'number' && !isNaN(val);
        });
        const avgLag = recentLagSessions.length > 0 ? recentLagSessions.reduce((acc, s) => acc + (s.complianceLagMinutes || 0), 0) / recentLagSessions.length : 0;

        return {
            ladderVelocity: avgLifeMinutes, burnRate: recentCosts, cpnh: cpnh, latency: latency,
            enclosure: enclosureIndex, nocturnal: nocturnalRate, exposure: exposureGap,
            vibe: topVibe, resistance: resistance,
            complianceLag: avgLag,
            activeItems: items.filter(i => i.status === 'active').length
        };
    }, [items, sessions]);

    // --- FORENSIK LOGIK ---
    const forensics = useMemo(() => {
        if (!items) return { archivedCount: 0, realizedCPW: 0, reasonsData: [], locationData: [], causeData: [], brandData: [], totalLoss: 0 };

        const archived = items.filter(i => i.status === 'archived');
        
        const wornArchived = archived.filter(i => (i.finalWearCount || i.wearCount || 0) > 0);
        const totalWears = wornArchived.reduce((acc, i) => acc + (i.finalWearCount || i.wearCount || 0), 0);
        const totalCostWorn = wornArchived.reduce((acc, i) => acc + (parseFloat(i.cost) || 0), 0);
        const realizedCPW = totalWears > 0 ? totalCostWorn / totalWears : 0;

        const totalLoss = archived.reduce((acc, i) => acc + (parseFloat(i.cost) || 0), 0);

        const reasonsMap = {};
        archived.forEach(i => {
            let label = i.archiveReason || 'Unbekannt';
            if (label === 'run') label = 'Laufmasche'; if (label === 'worn_out') label = 'Verschlissen';
            if (label === 'fit_issue') label = 'Passform'; if (label === 'vibe_mismatch') label = 'Vibe Shift';
            reasonsMap[label] = (reasonsMap[label] || 0) + 1;
        });
        
        // NIVO DATA FORMAT: { id, label, value, color }
        const reasonsData = Object.keys(reasonsMap).map((k, i) => ({
            id: k,
            label: k,
            value: reasonsMap[k],
            color: DESIGN_TOKENS.chartColors[i % DESIGN_TOKENS.chartColors.length]
        }));

        const runItems = archived.filter(i => i.archiveReason === 'run');
        const locMap = {}; const causeMap = {};
        runItems.forEach(i => {
            if (i.archiveRunLocation) locMap[i.archiveRunLocation] = (locMap[i.archiveRunLocation] || 0) + 1;
            if (i.archiveRunCause) causeMap[i.archiveRunCause] = (causeMap[i.archiveRunCause] || 0) + 1;
        });
        
        const brandStats = {};
        archived.forEach(i => {
            if (!brandStats[i.brand]) brandStats[i.brand] = { totalWears: 0, count: 0 };
            brandStats[i.brand].totalWears += (i.finalWearCount || i.wearCount || 0);
            brandStats[i.brand].count++;
        });
        const brandData = Object.keys(brandStats).map(b => ({ name: b, avgWears: Math.round(brandStats[b].totalWears / brandStats[b].count) })).sort((a,b) => b.avgWears - a.avgWears).slice(0, 8);

        return {
            archivedCount: archived.length, realizedCPW, reasonsData,
            locationData: Object.keys(locMap).map(k => ({ name: k, count: locMap[k] })),
            causeData: Object.keys(causeMap).map(k => ({ name: k, count: causeMap[k] })),
            brandData, totalLoss
        };
    }, [items]);

    // --- TREND LOGIK ---
    const calculateTrend = (metricId) => {
        const rawValues = [];
        const today = new Date();
        
        for (let i = 34; i >= 0; i--) {
            const date = new Date(); date.setDate(today.getDate() - i);
            const startOfDay = new Date(date); startOfDay.setHours(0,0,0,0);
            const endOfDay = new Date(date); endOfDay.setHours(23,59,59,999);
            
            let val = 0;
            if (metricId === 'ladder') {
                const historicArchived = items.filter(item => 
                    item.status === 'archived' && item.archivedAt && item.archivedAt <= endOfDay && 
                    item.mainCategory === 'Nylons' && 
                    (item.totalMinutes > 0 || item.wearCount > 0)
                );
                if (historicArchived.length > 0) {
                    val = (historicArchived.reduce((acc, it) => acc + (it.totalMinutes || 0), 0) / historicArchived.length) / 60;
                }
            }
            else if (metricId === 'compliance') {
                const daily = sessions.filter(s => {
                    const v = s.complianceLagMinutes;
                    return s.startTime >= startOfDay && s.startTime <= endOfDay && typeof v === 'number' && !isNaN(v);
                });
                if (daily.length > 0) val = daily.reduce((acc, s) => acc + (s.complianceLagMinutes || 0), 0) / daily.length;
            }
            else if (metricId === 'enclosure') {
                const daily = sessions.filter(s => s.startTime <= endOfDay && (s.endTime >= startOfDay || !s.endTime));
                let tMins = 0; let nMins = 0;
                daily.forEach(s => {
                    const item = items.find(i => i.id === s.itemId);
                    if (item && item.mainCategory === 'Nylons') {
                        const overlap = Math.min(s.endTime || new Date(), endOfDay) - Math.max(s.startTime, startOfDay);
                        if (overlap > 0) { nMins += overlap; if (item.subCategory === 'Strumpfhose' || item.subCategory === 'Strumpfhosen') tMins += overlap; }
                    }
                });
                val = nMins > 0 ? (tMins / nMins) * 100 : 0;
            } else if (metricId === 'nocturnal') {
                const nightTime = new Date(date); nightTime.setHours(2,0,0,0);
                const active = sessions.some(s => {
                    const item = items.find(i => i.id === s.itemId);
                    return item && item.mainCategory === 'Nylons' && s.startTime <= nightTime && (s.endTime >= nightTime || !s.endTime);
                });
                val = active ? 100 : 0;
            } else if (metricId === 'exposure') {
                 let activeMins = 0;
                 sessions.forEach(s => {
                    const item = items.find(i => i.id === s.itemId);
                    if (item && item.mainCategory === 'Nylons') {
                        const overlap = Math.min(s.endTime || new Date(), endOfDay) - Math.max(s.startTime, startOfDay);
                        if (overlap > 0) activeMins += overlap / 60000;
                    }
                 });
                 val = 24 - (activeMins / 60);
            }
            rawValues.push({ dateStr: `${date.getDate()}.${date.getMonth()+1}.`, val });
        }

        const smoothedData = [];
        for (let i = 4; i < rawValues.length; i++) {
            const window = rawValues.slice(i-4, i+1);
            const avg = window.reduce((sum, entry) => sum + entry.val, 0) / window.length;
            smoothedData.push({ name: rawValues[i].dateStr, value: parseFloat(avg.toFixed(1)) });
        }
        setTrendData(smoothedData);
    };

    const handleCardClick = (metricId, title) => {
        if(['enclosure', 'nocturnal', 'exposure', 'ladder', 'compliance'].includes(metricId)) {
            calculateTrend(metricId);
            setSelectedMetric({ id: metricId, title });
        }
    };

    if (loading) return <Box sx={{display:'flex', justifyContent:'center', mt:10}}><CircularProgress /></Box>;

    const metrics = [
        { id: 'enclosure', title: 'Enclosure Index', val: `${kpi.enclosure.toFixed(0)}%`, sub: 'Strumpfhosen-Anteil (Trend)', icon: Icons.Layers, color: PALETTE.accents.pink },
        { id: 'nocturnal', title: 'Nocturnal Quote', val: `${kpi.nocturnal.toFixed(0)}%`, sub: 'Nächte in Nylon (Trend)', icon: Icons.Night, color: PALETTE.accents.purple },
        { id: 'exposure', title: 'Exposure Gap', val: `${kpi.exposure.toFixed(1)}h`, sub: 'Std ohne Nylon (Trend)', icon: Icons.NoEye, color: PALETTE.accents.red },
        { id: 'ladder', title: 'Ladder Velocity', val: `${(kpi.ladderVelocity / 60).toFixed(1)}h`, sub: 'Ø Lebensdauer (Trend)', icon: Icons.Speed, color: PALETTE.accents.blue },
        { id: 'compliance', title: 'Compliance Lag', val: `${kpi.complianceLag.toFixed(1)}m`, sub: 'Reaktionszeit (Trend)', icon: Icons.Timer, color: PALETTE.accents.gold }, 
        
        { id: 'cpnh', title: 'Cost / Hour', val: `${kpi.cpnh.toFixed(2)}€`, sub: 'Laufende Kosten', icon: Icons.Money, color: PALETTE.accents.green },
        { id: 'burn', title: 'Burn Rate (30d)', val: `${kpi.burnRate.toFixed(0)}€`, sub: 'Investiert', icon: Icons.Fire, color: PALETTE.accents.red },
        { id: 'latency', title: 'Restock Speed', val: `${kpi.latency.toFixed(1)}d`, sub: 'Kauf-Frequenz', icon: Icons.Update, color: PALETTE.accents.blue },
        { id: 'resistance', title: 'Resistance Rate', val: `${kpi.resistance.toFixed(1)}%`, sub: 'Verweigerung', icon: Icons.Gavel, color: PALETTE.accents.red },
        { id: 'vibe', title: 'Top Vibe', val: kpi.vibe, sub: 'Gefühlslage', icon: Icons.Brain, color: PALETTE.accents.purple },
    ];

    return (
        <Box sx={DESIGN_TOKENS.bottomNavSpacer}>
            <Container maxWidth="md">
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                <motion.div variants={itemVariants}>
                    <Typography variant="h4" gutterBottom sx={DESIGN_TOKENS.textGradient}>Statistik</Typography>
                    <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}><Icons.Flame color="secondary"/> Live & Trends</Typography>
                </motion.div>

                <Grid container spacing={2} sx={{ mb: 4 }}>
                    {metrics.map((m) => (
                        <Grid item xs={6} sm={3} key={m.id} component={motion.div} variants={itemVariants}>
                            <Card 
                                onClick={() => handleCardClick(m.id, m.title)}
                                sx={{ 
                                    height: '100%', 
                                    cursor: ['enclosure','nocturnal','exposure', 'ladder', 'compliance'].includes(m.id) ? 'pointer' : 'default', 
                                    transition: 'transform 0.2s', 
                                    ...DESIGN_TOKENS.glassCard,
                                    '&:hover': { transform: ['enclosure','nocturnal','exposure', 'ladder', 'compliance'].includes(m.id) ? 'scale(1.02)' : 'none' },
                                    borderColor: `1px solid ${m.color}40`,
                                    background: `linear-gradient(135deg, rgba(18,18,18,0.4) 0%, ${m.color}10 100%)`
                                }}
                            >
                                <CardContent sx={{ p: 2, textAlign: 'center' }}>
                                    <m.icon sx={{ color: m.color, fontSize: 30, mb: 1 }} />
                                    <Typography variant="h5" fontWeight="bold" sx={{ color: '#fff' }}>{m.val}</Typography>
                                    <Typography variant="caption" sx={{ color: m.color, display:'block', fontWeight:'bold' }}>{m.title}</Typography>
                                    <Typography variant="caption" color="text.secondary">{m.sub}</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>

                <motion.div variants={itemVariants}>
                    <Divider sx={{ my: 4, borderColor: PALETTE.background.glassBorder }} />
                </motion.div>

                <motion.div variants={itemVariants}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: PALETTE.accents.red }}><Icons.Science /> Forensik Labor</Typography>
                        <Chip label={`${forensics.archivedCount} Archiviert`} size="small" color="error" variant="outlined" />
                    </Box>
                </motion.div>

                <Grid container spacing={3}>
                    <Grid item xs={12} sm={4} component={motion.div} variants={itemVariants}>
                        <Paper sx={{ p: 2, height: '100%', border: `1px solid ${PALETTE.accents.crimson}`, bgcolor: `${PALETTE.accents.crimson}10`, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRadius: '12px' }}>
                            <Typography variant="caption" color="error">REALIZED COST PER WEAR</Typography>
                            <Typography variant="h4" fontWeight="bold" color="#fff">{forensics.realizedCPW.toFixed(2)} €</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>Echte Kosten entsorgter Items</Typography>
                            <Typography variant="caption" color="text.secondary">Totaler Verlust: {forensics.totalLoss.toFixed(0)} €</Typography>
                        </Paper>
                    </Grid>
                    
                    {/* NIVO PIE CHART */}
                    <Grid item xs={12} sm={8} component={motion.div} variants={itemVariants}>
                        <Paper sx={{ p: 2, height: 350, ...DESIGN_TOKENS.glassCard }}>
                            <Typography variant="subtitle2" gutterBottom align="center">Todesursachen (Nivo)</Typography>
                            {forensics.reasonsData.length > 0 ? (
                                <ResponsivePie
                                    data={forensics.reasonsData}
                                    margin={{ top: 20, right: 80, bottom: 40, left: 80 }}
                                    innerRadius={0.6}
                                    padAngle={0.7}
                                    cornerRadius={3}
                                    activeOuterRadiusOffset={8}
                                    colors={{ datum: 'data.color' }}
                                    borderWidth={1}
                                    borderColor={{ from: 'color', modifiers: [ [ 'darker', 0.2 ] ] }}
                                    enableArcLinkLabels={true}
                                    arcLinkLabelsSkipAngle={10}
                                    arcLinkLabelsTextColor="#e0e0e0"
                                    arcLinkLabelsThickness={2}
                                    arcLinkLabelsColor={{ from: 'color' }}
                                    arcLabelsSkipAngle={10}
                                    arcLabelsTextColor={{ from: 'color', modifiers: [ [ 'darker', 2 ] ] }}
                                    theme={{
                                        tooltip: {
                                            container: {
                                                background: '#121212',
                                                color: '#fff',
                                                fontSize: '12px',
                                                borderRadius: '4px',
                                                boxShadow: '0 3px 6px rgba(0,0,0,0.5)',
                                                border: '1px solid #333'
                                            }
                                        }
                                    }}
                                />
                            ) : (<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Typography color="text.secondary">Keine Daten</Typography></Box>)}
                        </Paper>
                    </Grid>
                    
                    {(forensics.locationData.length > 0 || forensics.causeData.length > 0) && (
                        <Grid item xs={12} component={motion.div} variants={itemVariants}>
                            <Alert severity="warning" icon={<Icons.Broken />} sx={{ mb: 2, bgcolor: `${PALETTE.accents.gold}20`, color: PALETTE.accents.gold, border: `1px solid ${PALETTE.accents.gold}` }}>Nylon CSI: Unfallanalyse</Alert>
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <Paper sx={{ p: 2, height: 250, ...DESIGN_TOKENS.glassCard }}>
                                        <Typography variant="caption" color="text.secondary">SCHADENS-ORT</Typography>
                                        <ResponsiveContainer width="100%" height="90%"><BarChart data={forensics.locationData}><XAxis dataKey="name" stroke="#666" tick={{fontSize: 10}} /><RechartsTooltip contentStyle={{ backgroundColor: '#1e1e1e' }} /><Bar dataKey="count" fill={PALETTE.accents.red} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
                                    </Paper>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Paper sx={{ p: 2, height: 250, ...DESIGN_TOKENS.glassCard }}>
                                        <Typography variant="caption" color="text.secondary">URSACHE</Typography>
                                        <ResponsiveContainer width="100%" height="90%"><BarChart data={forensics.causeData}><XAxis dataKey="name" stroke="#666" tick={{fontSize: 10}} /><RechartsTooltip contentStyle={{ backgroundColor: '#1e1e1e' }} /><Bar dataKey="count" fill={PALETTE.accents.purple} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
                                    </Paper>
                                </Grid>
                            </Grid>
                        </Grid>
                    )}
                </Grid>
            </motion.div>

            {/* Dialog für Trends bleibt erst mal auf Recharts */}
            <Dialog open={!!selectedMetric} onClose={() => setSelectedMetric(null)} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: '#1e1e1e', border: '1px solid #333' } }}>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box><Typography variant="h6" fontWeight="bold">{selectedMetric?.title}</Typography><Typography variant="caption" color="text.secondary">Gleitender Durchschnitt (5 Tage)</Typography></Box>
                    <IconButton onClick={() => setSelectedMetric(null)} sx={{ color: 'white' }}><Icons.Close /></IconButton>
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ height: 300, mt: 2 }}>
                        {trendData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData}>
                                    <defs><linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={PALETTE.accents.pink} stopOpacity={0.8}/><stop offset="95%" stopColor={PALETTE.accents.pink} stopOpacity={0}/></linearGradient></defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                    <XAxis dataKey="name" stroke="#666" style={{ fontSize: '0.7rem' }} />
                                    <YAxis stroke="#666" />
                                    <RechartsTooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }} />
                                    <Area type="monotone" dataKey="value" stroke={PALETTE.accents.pink} fillOpacity={1} fill="url(#colorVal)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                <Typography color="text.secondary">Nicht genügend Daten für Trends.</Typography>
                            </Box>
                        )}
                    </Box>
                </DialogContent>
            </Dialog>

            </Container>
        </Box>
    );
}

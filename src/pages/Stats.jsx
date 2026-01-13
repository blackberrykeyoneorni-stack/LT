import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
    Box, Typography, Grid, Paper, Card, CardContent, CircularProgress, 
    Container, Dialog, DialogTitle, DialogContent, IconButton, Chip, Divider 
} from '@mui/material';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
    ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { motion } from 'framer-motion';

// --- DESIGN ---
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

    // --- KPI BERECHNUNG (Orientiert an useKPIs.js) ---
    const kpi = useMemo(() => {
        if (!items.length) return { enclosure: 0, nocturnal: 0, cpnh: 0, ladderVelocity: 0, exposure: 0, resistance: 0, vibe: 'N/A' };
        
        // Helper
        const activeItems = items.filter(i => i.status === 'active' || i.status === 'washing');
        
        // 1. ENCLOSURE (Nylons vs Gesamt)
        const nylons = activeItems.filter(i => i.mainCategory === 'Nylons');
        const enclosure = activeItems.length > 0 ? Math.round((nylons.length / activeItems.length) * 100) : 0;

        // 2. NOCTURNAL (Nacht-Quote aus Sessions)
        // Nur Instruction-Sessions zählen
        const instructionSessions = sessions.filter(s => s.type === 'instruction');
        const nightSessions = instructionSessions.filter(s => s.period && s.period.includes('night'));
        const nocturnal = instructionSessions.length > 0 ? Math.round((nightSessions.length / instructionSessions.length) * 100) : 0;

        // 3. CPNH (Cost Per Nylon Hour)
        const totalCost = items.reduce((acc, i) => acc + (parseFloat(i.cost) || 0), 0);
        // Wir nehmen die totalMinutes direkt aus den Items, da diese beim Session-Stop aktualisiert werden
        const totalMinutes = items.reduce((acc, i) => acc + (i.totalMinutes || 0), 0);
        const totalHours = totalMinutes / 60;
        const cpnh = totalHours > 0 ? (totalCost / totalHours).toFixed(2) : "0.00";

        // 4. LADDER VELOCITY (Archivierte Items pro Monat - vereinfacht Total)
        const archivedCount = items.filter(i => i.status === 'archived').length;
        const ladderVelocity = archivedCount; 

        // 5. EXPOSURE (Verhältnis Tragezeit zu Gesamtzeit seit erstem Tag)
        let firstSessionDate = new Date();
        let totalSessionDuration = 0;
        if (sessions.length > 0) {
            firstSessionDate = sessions[0].startTime;
            sessions.forEach(s => {
                if(s.endTime) {
                    totalSessionDuration += (s.endTime - s.startTime);
                }
            });
        }
        const totalTimeSinceStart = Date.now() - firstSessionDate.getTime();
        const exposure = totalTimeSinceStart > 0 ? Math.round((totalSessionDuration / totalTimeSinceStart) * 100) : 0;

        // 6. RESISTANCE (Anteil Bestrafungen an Gesamtsessions)
        const punishmentCount = sessions.filter(s => s.type === 'punishment').length;
        const totalSessionsCount = sessions.length;
        const resistance = totalSessionsCount > 0 ? Math.round((punishmentCount / totalSessionsCount) * 100) : 0;

        // 7. VIBE (Häufigster Tag)
        const tags = {};
        items.forEach(i => {
            if(Array.isArray(i.vibeTags)) i.vibeTags.forEach(t => tags[t] = (tags[t] || 0) + 1);
        });
        const topVibe = Object.keys(tags).sort((a,b) => tags[b] - tags[a])[0] || "Neutral";

        return { enclosure, nocturnal, cpnh, ladderVelocity, exposure, resistance, vibe: topVibe };
    }, [items, sessions]);

    // --- CHART LOGIK: 5-TAGE GLEITENDER DURCHSCHNITT ---
    const calculateTrend = (metricId) => {
        const displayDays = 30; // Wir wollen 30 Punkte im Chart
        const windowSize = 5;   // Glättung über 5 Tage
        const totalDaysNeeded = displayDays + windowSize - 1; // Puffer für den Anfang

        // 1. Rohdaten generieren (Täglich)
        const rawData = [];
        const today = new Date();
        
        for (let i = 0; i < totalDaysNeeded; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() - (totalDaysNeeded - 1 - i));
            const dateStr = d.toISOString().split('T')[0];

            // Sessions dieses Tages filtern
            const daySessions = sessions.filter(s => {
                if (!s.startTime) return false;
                const sDate = s.startTime.toISOString().split('T')[0];
                return sDate === dateStr;
            });

            let val = 0;
            
            if (metricId === 'exposure') {
                // Tragezeit in Stunden für diesen Tag
                const mins = daySessions.reduce((acc, s) => {
                    const end = s.endTime || new Date();
                    return acc + (end - s.startTime) / 60000;
                }, 0);
                val = mins / 60; 
            } 
            else if (metricId === 'nocturnal') {
                // Quote Nacht-Sessions (%)
                const total = daySessions.length;
                if (total === 0) val = 0; // Kein Wert
                else {
                    const night = daySessions.filter(s => s.period && s.period.includes('night')).length;
                    val = (night / total) * 100;
                }
            }
            else if (metricId === 'resistance') {
                // Anzahl Strafen (oder Quote, hier Anzahl für bessere Lesbarkeit)
                val = daySessions.filter(s => s.type === 'punishment').length;
            }
            else {
                // Default: Anzahl Sessions
                val = daySessions.length;
            }
            
            rawData.push({ date: dateStr, val });
        }

        // 2. Gleitenden Durchschnitt berechnen
        const smoothedData = [];
        for (let i = windowSize - 1; i < rawData.length; i++) {
            // Fenster ausschneiden (z.B. Index 0 bis 4)
            const windowSlice = rawData.slice(i - windowSize + 1, i + 1);
            
            // Durchschnitt berechnen
            const sum = windowSlice.reduce((acc, curr) => acc + curr.val, 0);
            const avg = sum / windowSize;
            
            const currentDay = rawData[i];
            
            smoothedData.push({
                name: currentDay.date.split('-').slice(2).join('.'), // Nur Tag (DD)
                fullDate: currentDay.date,
                value: parseFloat(avg.toFixed(2)) // 2 Nachkommastellen
            });
        }

        setTrendData(smoothedData);
    };

    const handleCardClick = (metricId, title) => { 
        if (['exposure', 'nocturnal', 'resistance', 'enclosure'].includes(metricId)) {
            calculateTrend(metricId);
            setSelectedMetric({id: metricId, title}); 
        } else {
            // Keine Charts für statische Werte wie CPNH
            setSelectedMetric(null);
        }
    };

    // --- Forensik Daten (Pie Chart) ---
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
        
        // Format für Recharts Pie
        const reasonsData = Object.keys(reasonCounts).map((key, idx) => ({
            name: key, 
            value: reasonCounts[key], 
            color: CHART_THEME.colors[idx % CHART_THEME.colors.length]
        }));

        return { archivedCount: archived.length, realizedCPW, reasonsData };
    }, [items]);

    // Helper für Einheiten im Chart
    const getUnit = (metricId) => {
        if (metricId === 'exposure') return ' h';
        if (metricId === 'nocturnal') return ' %';
        return '';
    };

    if (loading) return <Box sx={{display:'flex', justifyContent:'center', mt:10}}><CircularProgress/></Box>;

    const metrics = [
        { id: 'enclosure', title: 'Enclosure', val: `${kpi.enclosure}%`, sub: 'Nylon-Quote', icon: Icons.Layers, color: PALETTE.accents.pink },
        { id: 'nocturnal', title: 'Nocturnal', val: `${kpi.nocturnal}%`, sub: 'Nacht-Quote', icon: Icons.Night, color: PALETTE.accents.purple },
        { id: 'cpnh', title: 'CPNH', val: `${kpi.cpnh}€`, sub: 'Cost/Hour', icon: TrendingUpIcon, color: PALETTE.accents.green },
        { id: 'ladder', title: 'Attrition', val: kpi.ladderVelocity, sub: 'Verlust Total', icon: BrokenImageIcon, color: PALETTE.accents.red },
        { id: 'exposure', title: 'Exposure', val: `${kpi.exposure}%`, sub: 'Tragezeit-Ratio', icon: AccessTimeIcon, color: PALETTE.primary.main },
        { id: 'resistance', title: 'Resistance', val: `${kpi.resistance}%`, sub: 'Straf-Quote', icon: SecurityIcon, color: PALETTE.accents.gold },
        { id: 'vibe', title: 'Vibe', val: kpi.vibe, sub: 'Dominanz', icon: PsychologyIcon, color: PALETTE.accents.blue },
        { id: 'velocity', title: 'Sessions', val: sessions.length, sub: 'Total', icon: SpeedIcon, color: PALETTE.text.secondary },
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
                                    // background: `linear-gradient(135deg, rgba(18,18,18,0.4) 0%, ${m.color}10 100%)`, // Entfernt für M3 Look
                                    cursor: ['exposure', 'nocturnal', 'resistance'].includes(m.id) ? 'pointer' : 'default',
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
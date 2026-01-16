import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, query, getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useItems } from '../contexts/ItemContext';

// UI & THEME
import { 
    Box, Container, Typography, IconButton, Paper, 
    ToggleButton, ToggleButtonGroup, Chip,
    Stack, useTheme
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { DESIGN_TOKENS, PALETTE } from '../theme/obsidianDesign';

// ICONS
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CalendarViewMonthIcon from '@mui/icons-material/CalendarViewMonth';
import ViewListIcon from '@mui/icons-material/ViewList'; // Besser passend für die neue Ansicht
import AccessTimeIcon from '@mui/icons-material/AccessTime';

// --- HILFSFUNKTIONEN ---

const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Montag als Wochenstart
    return new Date(d.setDate(diff));
};

const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

const isSameDay = (d1, d2) => {
    return d1.getDate() === d2.getDate() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getFullYear() === d2.getFullYear();
};

const formatDuration = (totalMinutes) => {
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    return `${h}h ${m < 10 ? '0'+m : m}m`;
};

// --- DATA HOOK ---
const useCalendarData = (currentUser, items) => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) return;

        const fetchSessions = async () => {
            setLoading(true);
            try {
                const q = query(collection(db, `users/${currentUser.uid}/sessions`));
                const snap = await getDocs(q);
                
                const loadedSessions = snap.docs.map(doc => {
                    const data = doc.data();
                    const sessionItems = (data.itemIds || [data.itemId]).map(id => items.find(i => i.id === id)).filter(Boolean);
                    
                    let hasNylon = false;
                    let hasLingerie = false;
                    
                    sessionItems.forEach(item => {
                        const cat = (item.mainCategory || '').toLowerCase();
                        const sub = (item.subCategory || '').toLowerCase();
                        if (cat.includes('nylon') || sub.includes('strumpfhose') || sub.includes('stockings')) hasNylon = true;
                        else if (cat.includes('wäsche') || cat.includes('dessous') || sub.includes('body') || sub.includes('corsage')) hasLingerie = true;
                    });

                    return {
                        id: doc.id,
                        date: data.startTime ? data.startTime.toDate() : new Date(),
                        duration: data.durationMinutes || 0,
                        type: data.type,
                        hasNylon,
                        hasLingerie
                    };
                });
                
                setSessions(loadedSessions);
            } catch (e) {
                console.error("Calendar Fetch Error", e);
            } finally {
                setLoading(false);
            }
        };

        if (items.length > 0) fetchSessions();
    }, [currentUser, items]);

    return { sessions, loading };
};

// --- COMPONENTS ---

// 1. NEUE WOCHEN-ZEILE (Transponiert)
const WeekDayRow = ({ date, sessions, isToday }) => {
    const daySessions = sessions.filter(s => isSameDay(s.date, date));
    
    // Aggregation der Zeiten
    // Hinweis: Wenn eine Session beides hat, zählt sie für beides.
    const nylonMinutes = daySessions.filter(s => s.hasNylon).reduce((acc, s) => acc + s.duration, 0);
    const lingerieMinutes = daySessions.filter(s => s.hasLingerie).reduce((acc, s) => acc + s.duration, 0);
    
    const dayName = date.toLocaleDateString('de-DE', { weekday: 'short' }).toUpperCase();
    const dayNumber = date.getDate();
    const isFuture = date > new Date();

    return (
        <Paper sx={{ 
            mb: 1, p: 1.5, 
            display: 'flex', alignItems: 'center', gap: 2,
            ...DESIGN_TOKENS.glassCard,
            borderLeft: isToday ? `4px solid ${PALETTE.primary.main}` : '1px solid rgba(255,255,255,0.1)',
            opacity: isFuture ? 0.5 : 1
        }}>
            {/* Datums-Block */}
            <Box sx={{ 
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                minWidth: 50, borderRight: '1px solid rgba(255,255,255,0.1)', pr: 2
            }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>{dayName}</Typography>
                <Typography variant="h5" sx={{ fontWeight: 600, color: isToday ? PALETTE.primary.main : 'text.primary' }}>{dayNumber}</Typography>
            </Box>

            {/* Statistik-Balken */}
            <Box sx={{ flex: 1 }}>
                {(nylonMinutes === 0 && lingerieMinutes === 0) ? (
                    <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                        Keine Aktivität
                    </Typography>
                ) : (
                    <Stack spacing={1}>
                        {/* NYLON BAR */}
                        {nylonMinutes > 0 && (
                            <Box sx={{ 
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                bgcolor: `${PALETTE.accents.purple}15`, 
                                borderRadius: 1, px: 1.5, py: 0.5,
                                border: `1px solid ${PALETTE.accents.purple}44`
                            }}>
                                <Typography variant="caption" sx={{ color: PALETTE.accents.purple, fontWeight: 'bold' }}>NYLON</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <AccessTimeIcon sx={{ fontSize: 14, color: PALETTE.accents.purple }} />
                                    <Typography variant="body2" sx={{ color: PALETTE.text.primary, fontWeight: 600 }}>
                                        {formatDuration(nylonMinutes)}
                                    </Typography>
                                </Box>
                            </Box>
                        )}

                        {/* DESSUS BAR */}
                        {lingerieMinutes > 0 && (
                            <Box sx={{ 
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                bgcolor: `${PALETTE.accents.red}15`, 
                                borderRadius: 1, px: 1.5, py: 0.5,
                                border: `1px solid ${PALETTE.accents.red}44`
                            }}>
                                <Typography variant="caption" sx={{ color: PALETTE.accents.red, fontWeight: 'bold' }}>DESSOUS</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <AccessTimeIcon sx={{ fontSize: 14, color: PALETTE.accents.red }} />
                                    <Typography variant="body2" sx={{ color: PALETTE.text.primary, fontWeight: 600 }}>
                                        {formatDuration(lingerieMinutes)}
                                    </Typography>
                                </Box>
                            </Box>
                        )}
                    </Stack>
                )}
            </Box>
        </Paper>
    );
};

// 2. Monats-Zelle (Bleibt kompakt für Übersicht)
const MonthDayCell = ({ date, sessions, isToday }) => {
    const daySessions = sessions.filter(s => isSameDay(s.date, date));
    const nylonMinutes = daySessions.filter(s => s.hasNylon).reduce((acc, s) => acc + s.duration, 0);
    const lingerieMinutes = daySessions.filter(s => s.hasLingerie).reduce((acc, s) => acc + s.duration, 0);
    
    const hasActivity = nylonMinutes > 0 || lingerieMinutes > 0;

    return (
        <Paper 
            sx={{ 
                height: 80, p: 0.5, 
                display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
                bgcolor: isToday ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                border: isToday ? `1px solid ${PALETTE.primary.main}` : '1px solid rgba(255,255,255,0.05)',
                borderRadius: 1
            }}
        >
            <Typography variant="caption" sx={{ color: isToday ? PALETTE.primary.main : 'text.secondary', fontWeight: 'bold', alignSelf: 'center' }}>
                {date.getDate()}
            </Typography>

            {hasActivity && (
                <Stack spacing={0.5} mt={1} sx={{ width: '100%', alignItems: 'center' }}>
                    {nylonMinutes > 0 && (
                        <Box sx={{ width: '80%', height: 4, borderRadius: 2, bgcolor: PALETTE.accents.purple }} />
                    )}
                    {lingerieMinutes > 0 && (
                        <Box sx={{ width: '80%', height: 4, borderRadius: 2, bgcolor: PALETTE.accents.red }} />
                    )}
                </Stack>
            )}
        </Paper>
    );
};

export default function Calendar() {
  const { currentUser } = useAuth();
  const { items } = useItems();
  
  const [view, setView] = useState('week'); 
  const [currentDate, setCurrentDate] = useState(new Date());
  const [direction, setDirection] = useState(0);

  const { sessions } = useCalendarData(currentUser, items);

  const handleNext = () => {
      setDirection(1);
      if (view === 'week') setCurrentDate(addDays(currentDate, 7));
      else setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handlePrev = () => {
      setDirection(-1);
      if (view === 'week') setCurrentDate(addDays(currentDate, -7));
      else setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleReset = () => {
      setDirection(0);
      setCurrentDate(new Date());
  };

  const today = new Date();
  
  // Berechne Tage für die Ansicht
  const daysToRender = useMemo(() => {
      const days = [];
      if (view === 'week') {
          const start = getStartOfWeek(currentDate);
          for (let i = 0; i < 7; i++) days.push(addDays(start, i));
      } else {
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth();
          const firstDay = new Date(year, month, 1);
          const lastDay = new Date(year, month + 1, 0);
          
          let startPadding = firstDay.getDay() - 1; 
          if (startPadding < 0) startPadding = 6;
          
          for (let i = 0; i < startPadding; i++) days.push(null);
          for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
      }
      return days;
  }, [currentDate, view]);

  const monthLabel = currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  const variants = {
      enter: (dir) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
      center: { x: 0, opacity: 1 },
      exit: (dir) => ({ x: dir > 0 ? -300 : 300, opacity: 0 })
  };

  return (
    <Box sx={DESIGN_TOKENS.bottomNavSpacer}>
        <Container maxWidth="md" sx={{ pt: 2, pb: 4, minHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            
            {/* HEADER */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                    <Typography variant="h4" sx={{ ...DESIGN_TOKENS.textGradient, fontWeight: 'bold' }}>
                        Kalender
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Zeit-Tracking Übersicht
                    </Typography>
                </Box>
                
                <ToggleButtonGroup 
                    value={view} 
                    exclusive 
                    onChange={(e, v) => v && setView(v)}
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}
                >
                    <ToggleButton value="week" sx={{ color: 'text.secondary', '&.Mui-selected': { color: PALETTE.primary.main } }}>
                        <ViewListIcon />
                    </ToggleButton>
                    <ToggleButton value="month" sx={{ color: 'text.secondary', '&.Mui-selected': { color: PALETTE.primary.main } }}>
                        <CalendarViewMonthIcon />
                    </ToggleButton>
                </ToggleButtonGroup>
            </Box>

            {/* NAVIGATION */}
            <Paper sx={{ 
                p: 1, mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                ...DESIGN_TOKENS.glassCard
            }}>
                <IconButton onClick={handlePrev}><ChevronLeftIcon /></IconButton>
                <Typography variant="h6" fontWeight="bold" onClick={handleReset} sx={{ cursor: 'pointer' }}>
                    {monthLabel} {view === 'week' && `(KW ${getKw(currentDate)})`}
                </Typography>
                <IconButton onClick={handleNext}><ChevronRightIcon /></IconButton>
            </Paper>

            {/* CONTENT AREA */}
            <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <AnimatePresence initial={false} custom={direction} mode="wait">
                    <motion.div
                        key={`${view}-${currentDate.toISOString()}`}
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        style={{ width: '100%' }}
                    >
                        {view === 'week' ? (
                            // NEUE WOCHEN ANSICHT (Transponiert)
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                                {daysToRender.map((date, idx) => (
                                    <WeekDayRow 
                                        key={idx} 
                                        date={date} 
                                        sessions={sessions} 
                                        isToday={isSameDay(date, today)} 
                                    />
                                ))}
                            </Box>
                        ) : (
                            // MONATS ANSICHT (Grid)
                            <Box sx={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(7, 1fr)', 
                                gap: 1,
                                alignContent: 'start'
                            }}>
                                {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => (
                                    <Typography key={d} variant="caption" color="text.secondary" align="center" sx={{ mb: 1 }}>
                                        {d}
                                    </Typography>
                                ))}
                                {daysToRender.map((date, idx) => (
                                    date ? (
                                        <MonthDayCell 
                                            key={idx} 
                                            date={date} 
                                            sessions={sessions} 
                                            isToday={isSameDay(date, today)} 
                                        />
                                    ) : <Box key={idx} />
                                ))}
                            </Box>
                        )}
                    </motion.div>
                </AnimatePresence>
            </Box>

        </Container>
    </Box>
  );
}

// Hilfsfunktion für Kalenderwoche
function getKw(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}
import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, query, getDocs, addDoc, Timestamp, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useItems } from '../contexts/ItemContext';
import { getAllSuspensions } from '../services/SuspensionService'; // NEU: Import

// UI & THEME
import { 
    Box, Container, Typography, IconButton, Paper, 
    ToggleButton, ToggleButtonGroup, Chip,
    Stack, Dialog, DialogTitle, DialogContent, DialogActions,
    Button, List, ListItem, ListItemText, Divider,
    TextField, FormControl, InputLabel, Select, MenuItem,
    useTheme
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { DESIGN_TOKENS, PALETTE } from '../theme/obsidianDesign';

// ICONS
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CalendarViewMonthIcon from '@mui/icons-material/CalendarViewMonth';
import ViewListIcon from '@mui/icons-material/ViewList';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EventIcon from '@mui/icons-material/Event';
import InfoIcon from '@mui/icons-material/Info';
import BlockIcon from '@mui/icons-material/Block'; // NEU: Icon für Ausfall

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

// NEU: Helper um zu prüfen, ob ein Datum in einer Suspension liegt
const getSuspensionForDate = (date, suspensions) => {
    if (!suspensions || suspensions.length === 0) return null;
    // Zeitanteile für Vergleich nullen
    const checkDate = new Date(date);
    checkDate.setHours(12, 0, 0, 0); // Mittag um Zeitzonenprobleme zu minimieren

    return suspensions.find(s => {
        const start = new Date(s.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(s.endDate);
        end.setHours(23, 59, 59, 999);
        return checkDate >= start && checkDate <= end;
    });
};

// --- LOGIK: ZEITEN VERSCHMELZEN ---
const calculateEffectiveMinutes = (sessions) => {
    if (!sessions || sessions.length === 0) return 0;
    const intervals = sessions.map(s => {
        const start = s.date.getTime();
        const durationMs = (s.duration || 0) * 60000;
        return { start, end: start + durationMs };
    }).filter(i => i.end > i.start);

    if (intervals.length === 0) return 0;
    intervals.sort((a, b) => a.start - b.start);

    const merged = [];
    let current = intervals[0];

    for (let i = 1; i < intervals.length; i++) {
        const next = intervals[i];
        if (next.start < current.end) {
            current.end = Math.max(current.end, next.end);
        } else {
            merged.push(current);
            current = next;
        }
    }
    merged.push(current);
    const totalMs = merged.reduce((sum, interval) => sum + (interval.end - interval.start), 0);
    return Math.floor(totalMs / 60000);
};

// --- DATA HOOK (ERWEITERT) ---
const useCalendarData = (currentUser, items) => {
    const [sessions, setSessions] = useState([]);
    const [suspensions, setSuspensions] = useState([]); // NEU: State für Ausfallzeiten
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Sessions laden
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
                    hasLingerie,
                    items: sessionItems 
                };
            });
            loadedSessions.sort((a, b) => a.date - b.date);
            setSessions(loadedSessions);

            // 2. Suspensions laden (NEU)
            const loadedSuspensions = await getAllSuspensions(currentUser.uid);
            setSuspensions(loadedSuspensions);

        } catch (e) {
            console.error("Calendar Fetch Error", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentUser && items.length > 0) fetchData();
    }, [currentUser, items]);

    return { sessions, suspensions, loading, refreshSessions: fetchData };
};

// --- SUB-KOMPONENTEN ---

// 1. Planungs-Dialog
const PlanSessionDialog = ({ open, onClose, date, items, onSave }) => {
    const [selectedItemId, setSelectedItemId] = useState('');
    const [time, setTime] = useState('20:00');
    const [duration, setDuration] = useState(60);

    const handleSave = () => {
        if (!selectedItemId) return;
        const [hours, minutes] = time.split(':');
        const startDateTime = new Date(date);
        startDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        onSave({
            itemId: selectedItemId,
            startTime: startDateTime,
            durationMinutes: parseInt(duration),
            type: 'planned'
        });
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" PaperProps={DESIGN_TOKENS.dialog.paper}>
            <DialogTitle sx={DESIGN_TOKENS.dialog.title.sx}>Planung: {date?.toLocaleDateString()}</DialogTitle>
            <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
                <Stack spacing={3} sx={{ mt: 1 }}>
                    <FormControl fullWidth>
                        <InputLabel sx={{ color: 'text.secondary' }}>Item auswählen</InputLabel>
                        <Select 
                            value={selectedItemId} 
                            label="Item auswählen" 
                            onChange={(e) => setSelectedItemId(e.target.value)}
                            sx={{ 
                                color: 'text.primary',
                                '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' }
                            }}
                            MenuProps={{ PaperProps: { sx: { bgcolor: '#1a1a1a' } } }}
                        >
                            {items.filter(i => i.status === 'active').map(item => (
                                <MenuItem key={item.id} value={item.id}>
                                    {item.name || item.brand} <Typography component="span" variant="caption" color="text.secondary" sx={{ml: 1}}>(ID: {item.id})</Typography>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <TextField
                        label="Startzeit"
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        fullWidth
                        InputLabelProps={{ shrink: true, sx: { color: 'text.secondary' } }}
                        sx={DESIGN_TOKENS.inputField}
                    />

                    <TextField
                        label="Geplante Dauer (Minuten)"
                        type="number"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        fullWidth
                        sx={DESIGN_TOKENS.inputField}
                    />
                </Stack>
            </DialogContent>
            <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
                <Button onClick={onClose} color="inherit">Abbrechen</Button>
                <Button onClick={handleSave} variant="contained" sx={DESIGN_TOKENS.buttonGradient}>Speichern</Button>
            </DialogActions>
        </Dialog>
    );
};

// 2. Detail-Dialog (ERWEITERT um Suspension Info)
const DayDetailDialog = ({ open, onClose, date, sessions, suspensions, onOpenPlan }) => {
    if (!date) return null;

    const daySessions = sessions.filter(s => isSameDay(s.date, date));
    daySessions.sort((a, b) => a.date - b.date);
    
    // Prüfen auf Suspension
    const activeSuspension = getSuspensionForDate(date, suspensions);

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={DESIGN_TOKENS.dialog.paper}>
            <DialogTitle sx={{ ...DESIGN_TOKENS.dialog.title.sx, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h6">{date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</Typography>
                    <Typography variant="caption" color="text.secondary">Tagesprotokoll</Typography>
                </Box>
                {/* Plus-Button nur anzeigen, wenn KEINE Suspension aktiv ist */}
                {!activeSuspension && (
                    <IconButton onClick={onOpenPlan} sx={{ color: PALETTE.primary.main }}>
                        <AddCircleOutlineIcon />
                    </IconButton>
                )}
            </DialogTitle>
            
            <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
                {/* NEU: Suspension Hinweis */}
                {activeSuspension && (
                    <Paper sx={{ 
                        p: 2, mb: 3, 
                        bgcolor: `${PALETTE.accents.gold}15`, 
                        border: `1px solid ${PALETTE.accents.gold}44`,
                        display: 'flex', alignItems: 'center', gap: 2
                    }}>
                        <BlockIcon sx={{ color: PALETTE.accents.gold, fontSize: 30 }} />
                        <Box>
                            <Typography variant="subtitle1" fontWeight="bold" sx={{ color: PALETTE.accents.gold }}>
                                AUSFALLZEIT AKTIV
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Grund: {activeSuspension.reason}
                            </Typography>
                            <Chip size="small" label={activeSuspension.status} sx={{ mt: 1, bgcolor: 'rgba(0,0,0,0.3)', color: '#fff' }} />
                        </Box>
                    </Paper>
                )}

                {daySessions.length === 0 ? (
                    !activeSuspension && (
                        <Box sx={{ py: 4, textAlign: 'center', opacity: 0.5 }}>
                            <EventIcon sx={{ fontSize: 40, mb: 1 }} />
                            <Typography>Keine Einträge für diesen Tag.</Typography>
                        </Box>
                    )
                ) : (
                    <List>
                        {daySessions.map((session, index) => (
                            <React.Fragment key={session.id}>
                                {index > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />}
                                <ListItem alignItems="flex-start" sx={{ px: 0, py: 2 }}>
                                    <Box sx={{ mr: 2, mt: 0.5, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60 }}>
                                        <Typography variant="caption" color="text.secondary">
                                            {session.date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                        </Typography>
                                        <Box sx={{ height: 20, width: 2, bgcolor: 'rgba(255,255,255,0.1)', my: 0.5 }} />
                                        <Typography variant="caption" color="text.secondary">
                                            {new Date(session.date.getTime() + session.duration * 60000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                        </Typography>
                                    </Box>
                                    
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="body1" fontWeight="bold" color="text.primary">
                                                    {formatDuration(session.duration)}
                                                </Typography>
                                                {session.type === 'planned' && <Chip label="Geplant" size="small" variant="outlined" color="info" />}
                                            </Box>
                                        }
                                        secondary={
                                            <Stack spacing={1} sx={{ mt: 1 }}>
                                                {session.items.map(item => (
                                                    <Box key={item.id} sx={{ bgcolor: 'rgba(255,255,255,0.05)', p: 1, borderRadius: 1 }}>
                                                        <Typography variant="body2" color="text.primary">{item.name || item.brand}</Typography>
                                                        <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                                                            <Typography variant="caption" color="text.secondary">
                                                                ID: {item.id}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                Sub: {item.subCategory || '-'}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                ))}
                                            </Stack>
                                        }
                                    />
                                </ListItem>
                            </React.Fragment>
                        ))}
                    </List>
                )}
            </DialogContent>
            <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
                <Button onClick={onClose} fullWidth color="inherit">Schließen</Button>
            </DialogActions>
        </Dialog>
    );
};

// 3. Wochen-Zeile (ERWEITERT um Suspension Anzeige)
const WeekDayRow = ({ date, sessions, suspensions, isToday, onClick }) => {
    const daySessions = sessions.filter(s => isSameDay(s.date, date));
    const nylonMinutes = calculateEffectiveMinutes(daySessions.filter(s => s.hasNylon));
    const lingerieMinutes = calculateEffectiveMinutes(daySessions.filter(s => s.hasLingerie));
    
    // Check auf Suspension
    const activeSuspension = getSuspensionForDate(date, suspensions);

    const dayName = date.toLocaleDateString('de-DE', { weekday: 'short' }).toUpperCase();
    const dayNumber = date.getDate();
    const isFuture = date > new Date();

    return (
        <Paper 
            onClick={() => onClick(date)}
            sx={{ 
                mb: 1, p: 1.5, 
                display: 'flex', alignItems: 'center', gap: 2,
                ...DESIGN_TOKENS.glassCard,
                borderLeft: isToday ? `4px solid ${PALETTE.primary.main}` : (activeSuspension ? `4px solid ${PALETTE.accents.gold}` : '1px solid rgba(255,255,255,0.1)'),
                // Wenn Suspension, leicht einfärben
                bgcolor: activeSuspension ? 'rgba(255, 215, 0, 0.03)' : undefined,
                opacity: isFuture && !activeSuspension ? 0.6 : 1,
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' }
            }}
        >
            <Box sx={{ 
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                minWidth: 50, borderRight: '1px solid rgba(255,255,255,0.1)', pr: 2
            }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>{dayName}</Typography>
                <Typography variant="h5" sx={{ fontWeight: 600, color: isToday ? PALETTE.primary.main : (activeSuspension ? PALETTE.accents.gold : 'text.primary') }}>{dayNumber}</Typography>
            </Box>

            <Box sx={{ flex: 1 }}>
                {activeSuspension ? (
                    // NEU: Anzeige für Ausfallzeit
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BlockIcon sx={{ fontSize: 18, color: PALETTE.accents.gold }} />
                        <Typography variant="body2" sx={{ color: PALETTE.accents.gold, fontWeight: 'bold', letterSpacing: 1 }}>
                            AUSFALLZEIT
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                            {activeSuspension.reason}
                        </Typography>
                    </Box>
                ) : (
                    // Standard Anzeige (Nylon / Lingerie / Leer)
                    <>
                        {(nylonMinutes === 0 && lingerieMinutes === 0) ? (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                                    {isFuture ? "Planen..." : "Keine Aktivität"}
                                </Typography>
                                {isFuture && <AddCircleOutlineIcon sx={{ color: 'text.disabled', fontSize: 20 }} />}
                            </Box>
                        ) : (
                            <Stack spacing={1}>
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
                    </>
                )}
            </Box>
        </Paper>
    );
};

// 4. Monats-Zelle (ERWEITERT um Suspension Dot)
const MonthDayCell = ({ date, sessions, suspensions, isToday, onClick }) => {
    const daySessions = sessions.filter(s => isSameDay(s.date, date));
    const hasNylon = daySessions.some(s => s.hasNylon);
    const hasLingerie = daySessions.some(s => s.hasLingerie);
    
    // Check auf Suspension
    const activeSuspension = getSuspensionForDate(date, suspensions);

    return (
        <Paper 
            onClick={() => onClick(date)}
            sx={{ 
                height: 80, p: 0.5, 
                display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
                position: 'relative', // Für absolute Positionierung des Dots
                bgcolor: isToday ? 'rgba(255,255,255,0.08)' : (activeSuspension ? 'rgba(255, 215, 0, 0.05)' : 'rgba(255,255,255,0.02)'),
                border: isToday ? `1px solid ${PALETTE.primary.main}` : (activeSuspension ? `1px solid ${PALETTE.accents.gold}44` : '1px solid rgba(255,255,255,0.05)'),
                borderRadius: 1,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
            }}
        >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', px: 0.5 }}>
                <Typography variant="caption" sx={{ color: isToday ? PALETTE.primary.main : 'text.secondary', fontWeight: 'bold' }}>
                    {date.getDate()}
                </Typography>
                {/* NEU: Goldener Punkt für Suspension */}
                {activeSuspension && (
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: PALETTE.accents.gold }} />
                )}
            </Box>

            {(hasNylon || hasLingerie) && (
                <Stack spacing={0.5} mt={1} sx={{ width: '100%', alignItems: 'center' }}>
                    {hasNylon && <Box sx={{ width: '80%', height: 4, borderRadius: 2, bgcolor: PALETTE.accents.purple }} />}
                    {hasLingerie && <Box sx={{ width: '80%', height: 4, borderRadius: 2, bgcolor: PALETTE.accents.red }} />}
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
  
  // Dialog States
  const [detailOpen, setDetailOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  // Hook lädt nun auch suspensions
  const { sessions, suspensions, refreshSessions } = useCalendarData(currentUser, items);

  const handleDayClick = (date) => {
      setSelectedDay(date);
      setDetailOpen(true);
  };

  const handlePlanSession = async (sessionData) => {
      try {
          await addDoc(collection(db, `users/${currentUser.uid}/sessions`), {
              ...sessionData,
              startTime: Timestamp.fromDate(sessionData.startTime),
              createdAt: serverTimestamp() 
          });
          refreshSessions();
      } catch (e) {
          console.error("Fehler beim Planen:", e);
      }
  };

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
                        Zeit-Tracking & Planung
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
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                                {daysToRender.map((date, idx) => (
                                    <WeekDayRow 
                                        key={idx} 
                                        date={date} 
                                        sessions={sessions} 
                                        suspensions={suspensions} // Pass down suspensions
                                        isToday={isSameDay(date, today)} 
                                        onClick={handleDayClick}
                                    />
                                ))}
                            </Box>
                        ) : (
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
                                            suspensions={suspensions} // Pass down suspensions
                                            isToday={isSameDay(date, today)} 
                                            onClick={handleDayClick}
                                        />
                                    ) : <Box key={idx} />
                                ))}
                            </Box>
                        )}
                    </motion.div>
                </AnimatePresence>
            </Box>

            {/* DIALOGS */}
            <DayDetailDialog 
                open={detailOpen} 
                onClose={() => setDetailOpen(false)} 
                date={selectedDay} 
                sessions={sessions}
                suspensions={suspensions} // Pass down suspensions
                onOpenPlan={() => { setDetailOpen(false); setPlanOpen(true); }}
            />

            <PlanSessionDialog 
                open={planOpen} 
                onClose={() => setPlanOpen(false)} 
                date={selectedDay} 
                items={items}
                onSave={handlePlanSession}
            />

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
import React, { useState, useEffect, useMemo } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { 
  collection, query, onSnapshot, doc, setDoc, deleteDoc, 
  getDocs, orderBy 
} from 'firebase/firestore'; 
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useItems } from '../contexts/ItemContext';
import { 
  Box, Container, Typography, Paper, 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, List, ListItem, ListItemText, ListItemAvatar, 
  Avatar, Divider, CircularProgress, Chip 
} from '@mui/material';
import { DESIGN_TOKENS, PALETTE, ANIMATIONS } from '../theme/obsidianDesign';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle'; 
import HistoryIcon from '@mui/icons-material/History'; 
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { motion, AnimatePresence } from 'framer-motion';

// --- DATE-FNS IMPORTS ---
import { format, isBefore, startOfDay, differenceInMinutes, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

// Hilfsfunktion für Formatierung (Minuten -> Std Min)
const formatDurationDisplay = (mins) => {
    if (!mins || isNaN(mins)) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
};

// --- OBSIDIAN CALENDAR STYLES ---
// FIX: Sicherer Zugriff auf PALETTE.text.secondary mit Fallback
const safeSecondaryText = PALETTE?.text?.secondary || 'rgba(255, 255, 255, 0.6)';

const calendarStyles = {
    '.react-calendar': {
        width: '100%',
        backgroundColor: 'transparent',
        border: 'none',
        fontFamily: 'Montserrat, sans-serif',
    },
    '.react-calendar__navigation': {
        height: 'auto',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
    },
    '.react-calendar__navigation button': {
        color: PALETTE.primary.main,
        minWidth: '44px',
        background: 'none',
        fontSize: '1.2rem',
        fontFamily: 'Playfair Display, serif',
        fontWeight: 600,
        textTransform: 'capitalize',
    },
    '.react-calendar__navigation button:disabled': {
        backgroundColor: 'transparent',
        color: safeSecondaryText,
    },
    '.react-calendar__navigation button:enabled:hover, .react-calendar__navigation button:enabled:focus': {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 8,
    },
    '.react-calendar__month-view__weekdays': {
        textAlign: 'center',
        textTransform: 'uppercase',
        fontWeight: 'bold',
        fontSize: '0.75rem',
        color: safeSecondaryText,
        marginBottom: '0.5rem',
        textDecoration: 'none',
    },
    '.react-calendar__month-view__weekdays__weekday': {
        padding: '0.5rem',
        abbr: {
            textDecoration: 'none',
        }
    },
    '.react-calendar__tile': {
        padding: '1rem 0.5rem',
        background: 'none',
        textAlign: 'center',
        lineHeight: '16px',
        color: '#fff',
        fontSize: '0.9rem',
        position: 'relative',
        overflow: 'visible', 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        height: '80px', 
    },
    '.react-calendar__tile:enabled:hover, .react-calendar__tile:enabled:focus': {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '10px',
    },
    '.react-calendar__tile--now': {
        background: 'transparent',
        border: `1px solid ${PALETTE.accents.gold}`,
        borderRadius: '10px',
        color: PALETTE.accents.gold,
    },
    '.react-calendar__tile--active': {
        background: `${PALETTE.primary.main} !important`,
        color: '#000 !important',
        borderRadius: '10px',
        fontWeight: 'bold',
    },
    '.react-calendar__tile--active:enabled:hover, .react-calendar__tile--active:enabled:focus': {
        background: `${PALETTE.primary.dark} !important`,
    },
};

export default function CalendarPage() {
  const { currentUser } = useAuth();
  const { items } = useItems();
  
  // States
  const [date, setDate] = useState(new Date());
  const [plans, setPlans] = useState({});
  const [history, setHistory] = useState({});
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  // Dialogs
  const [openPlanDialog, setOpenPlanDialog] = useState(false);
  const [openHistoryDialog, setOpenHistoryDialog] = useState(false);
  
  const [selectedDateStr, setSelectedDateStr] = useState('');
  const [selectedPlanItems, setSelectedPlanItems] = useState([]); 
  
  // Loading Items for Selection (Planung)
  const activeItems = useMemo(() => items.filter(i => i.status === 'active'), [items]);

  // --- 1. DATEN LADEN ---
  useEffect(() => {
    if (!currentUser) return;

    // A) PLANUNG LADEN
    const qPlan = query(collection(db, `users/${currentUser.uid}/planning`));
    const unsubPlan = onSnapshot(qPlan, (snapshot) => {
      const planData = {};
      snapshot.docs.forEach(doc => {
        planData[doc.id] = doc.data().itemIds || [];
      });
      setPlans(planData);
    });

    // B) HISTORIE LADEN
    const fetchHistory = async () => {
        try {
            const qHist = query(
                collection(db, `users/${currentUser.uid}/sessions`),
                orderBy('startTime', 'desc')
            );
            
            const snapshot = await getDocs(qHist);
            const histData = {};
    
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (!data.startTime || !data.startTime.toDate) return;
                if (!data.endTime || !data.endTime.toDate) return;
    
                const start = data.startTime.toDate();
                const end = data.endTime.toDate();
                
                const dateKey = format(start, 'yyyy-MM-dd');
                const durationMins = differenceInMinutes(end, start);
    
                if (!histData[dateKey]) {
                    histData[dateKey] = {
                        sessions: [],
                        nylonsDuration: 0,
                        dessousDuration: 0,
                        hasNylons: false,
                        hasDessous: false
                    };
                }
    
                // --- FIX: SAUBERE ZUORDNUNG ---
                // Wir schauen uns NUR das primäre Item dieser Session an.
                // Das verhindert, dass eine Session mit 2 Items doppelt in die Summe eingeht.
                const primaryItemId = data.itemId;
                const primaryItem = items.find(i => i.id === primaryItemId);
                
                let isNylonSession = false;
                let isDessousSession = false;
    
                if (primaryItem && primaryItem.mainCategory) {
                    const cat = primaryItem.mainCategory.toLowerCase();
                    if (cat.includes('nylon')) isNylonSession = true;
                    // Fängt Dessous, Lingerie und Wäsche ab
                    if (cat.includes('dessous') || cat.includes('lingerie') || cat.includes('wäsche')) isDessousSession = true;
                }
    
                // Summe wird jetzt korrekt pro Kategorie addiert
                if (isNylonSession) {
                    histData[dateKey].nylonsDuration += durationMins;
                    histData[dateKey].hasNylons = true;
                }
                if (isDessousSession) {
                    histData[dateKey].dessousDuration += durationMins;
                    histData[dateKey].hasDessous = true;
                }
    
                // Session wird nur hinzugefügt, wenn sie relevant ist
                if (isNylonSession || isDessousSession) {
                    histData[dateKey].sessions.push({
                        start,
                        end,
                        duration: durationMins,
                        isNylon: isNylonSession,
                        isDessous: isDessousSession,
                        // Optional: Item Name für Debugging oder Anzeige
                        itemName: primaryItem ? (primaryItem.name || primaryItem.brand) : 'Item'
                    });
                }
            });
            
            setHistory(histData);
        } catch (error) {
            console.error("Fehler beim Laden der Historie:", error);
        } finally {
            setLoadingHistory(false);
        }
    };

    fetchHistory();

    return () => unsubPlan();
  }, [currentUser, items]);

  // --- LOGIC: DATE HANDLING ---
  
  const handleDayClick = (value) => {
    try {
        const dateStr = format(value, 'yyyy-MM-dd');
        setSelectedDateStr(dateStr);
        setDate(value);
    
        const isPast = isBefore(value, startOfDay(new Date()));
    
        if (isPast) {
            setOpenHistoryDialog(true);
        } else {
            const existingPlan = plans[dateStr] || [];
            setSelectedPlanItems(existingPlan);
            setOpenPlanDialog(true);
        }
    } catch (e) {
        console.error("Calendar Click Error:", e);
    }
  };

  const savePlan = async () => {
      if (!selectedDateStr) return;
      const ref = doc(db, `users/${currentUser.uid}/planning`, selectedDateStr);
      if (selectedPlanItems.length > 0) {
          await setDoc(ref, { date: selectedDateStr, itemIds: selectedPlanItems });
      } else {
          await deleteDoc(ref);
      }
      setOpenPlanDialog(false);
  };

  const togglePlanItem = (id) => {
      setSelectedPlanItems(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // --- RENDER TILE CONTENT ---
  const renderTileContent = ({ date, view }) => {
      if (view !== 'month') return null;
      
      try {
          const dateStr = format(date, 'yyyy-MM-dd');
          const isPast = isBefore(date, startOfDay(new Date()));
    
          // A) VERGANGENHEIT
          if (isPast) {
              const dayData = history[dateStr];
              if (!dayData) return null;
    
              return (
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                      {dayData.hasNylons && (
                          <motion.div 
                            initial={{ scale: 0 }} 
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          >
                            <Box sx={{ 
                                width: 6, height: 6, borderRadius: '50%', 
                                bgcolor: PALETTE.primary.main, 
                                boxShadow: `0 0 5px ${PALETTE.primary.main}` 
                            }} />
                          </motion.div>
                      )}
                      {dayData.hasDessous && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
                          >
                            <Box sx={{ 
                                width: 6, height: 6, borderRadius: '50%', 
                                bgcolor: PALETTE.accents.pink,
                                boxShadow: `0 0 5px ${PALETTE.accents.pink}`
                            }} />
                          </motion.div>
                      )}
                  </Box>
              );
          } 
          
          // B) ZUKUNFT
          else {
              const planIds = plans[dateStr];
              if (planIds && planIds.length > 0) {
                  return (
                      <motion.div 
                        sx={{ mt: 1 }}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                      >
                          <CheckCircleIcon sx={{ fontSize: 14, color: PALETTE.accents.green }} />
                      </motion.div>
                  );
              }
          }
      } catch (e) {
          return null;
      }
      return null;
  };

  return (
    <motion.div 
        variants={ANIMATIONS.pageTransition} 
        initial="initial" 
        animate="animate" 
        exit="exit"
    >
        <Box sx={DESIGN_TOKENS.bottomNavSpacer}>
        <Container maxWidth="md">
            <Typography variant="h4" gutterBottom sx={DESIGN_TOKENS.textGradient}>
                Kalender
            </Typography>

            <Paper sx={{ p: 2, ...DESIGN_TOKENS.glassCard, ...calendarStyles }}>
            {loadingHistory ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress color="primary" />
                </Box>
            ) : (
                <Calendar 
                    onChange={setDate} 
                    value={date}
                    tileContent={renderTileContent}
                    onClickDay={handleDayClick}
                    prevLabel={<ChevronLeftIcon />}
                    nextLabel={<ChevronRightIcon />}
                    locale="de-DE"
                />
            )}
            </Paper>

            <Box sx={{ mt: 3, display: 'flex', gap: 3, justifyContent: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: PALETTE.primary.main, boxShadow: `0 0 5px ${PALETTE.primary.main}` }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>Nylons</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: PALETTE.accents.pink, boxShadow: `0 0 5px ${PALETTE.accents.pink}` }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>Dessous</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircleIcon sx={{ fontSize: 14, color: PALETTE.accents.green }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>Geplant</Typography>
                </Box>
            </Box>

            {/* --- DIALOG: VERGANGENHEIT (History) --- */}
            <Dialog open={openHistoryDialog} onClose={() => setOpenHistoryDialog(false)} fullWidth maxWidth="xs" PaperProps={DESIGN_TOKENS.glassCard}>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: PALETTE.primary.main }}>
                    <HistoryIcon color="inherit" />
                    {selectedDateStr ? format(parseISO(selectedDateStr), 'EEEE, d. MMMM yyyy', { locale: de }) : ''}
                </DialogTitle>
                <DialogContent>
                    {(() => {
                        const data = history[selectedDateStr];
                        if (!data || (!data.hasNylons && !data.hasDessous)) {
                            return <Typography color="text.secondary" align="center" sx={{ py: 3 }}>Keine Einträge für diesen Tag.</Typography>;
                        }

                        // Sortiere Sessions chronologisch aufsteigend für den Tagesverlauf
                        const dailySessions = [...data.sessions].sort((a, b) => a.start - b.start);

                        return (
                            <Box>
                                {/* ZUSAMMENFASSUNG */}
                                <Box sx={{ display: 'flex', justifyContent: 'space-around', mb: 3, p: 1, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2 }}>
                                    {data.hasNylons && (
                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                                            <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="caption" color="text.secondary" display="block">Nylons</Typography>
                                                <Typography variant="h6" sx={{ color: PALETTE.primary.main }}>
                                                    {formatDurationDisplay(data.nylonsDuration)}
                                                </Typography>
                                            </Box>
                                        </motion.div>
                                    )}
                                    {data.hasDessous && (
                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                                            <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="caption" color="text.secondary" display="block">Dessous</Typography>
                                                <Typography variant="h6" sx={{ color: PALETTE.accents.pink }}>
                                                    {formatDurationDisplay(data.dessousDuration)}
                                                </Typography>
                                            </Box>
                                        </motion.div>
                                    )}
                                </Box>

                                <Typography variant="subtitle1" sx={{ mb: 1, color: 'text.secondary', ml: 1 }}>Tagesverlauf</Typography>
                                <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.1)' }} />
                                
                                {/* UNIFIZIERTE LISTE mit Animation */}
                                <List component={motion.ul} variants={ANIMATIONS.staggerContainer} initial="hidden" animate="show" sx={{ p: 0 }}>
                                    <AnimatePresence>
                                        {dailySessions.map((s, idx) => (
                                            <motion.li key={idx} variants={ANIMATIONS.listItem} style={{ listStyle: 'none' }}>
                                                <Paper sx={{ p: 2, mb: 1.5, bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                        <AccessTimeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                                        <Typography variant="body1">
                                                            {format(s.start, 'HH:mm')} - {format(s.end, 'HH:mm')}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ ml: 'auto', bgcolor: 'rgba(255,255,255,0.1)', px: 1, py: 0.5, borderRadius: 1 }}>
                                                            {formatDurationDisplay(s.duration)}
                                                        </Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                                        {s.isNylon && (
                                                            <Chip 
                                                                label="Nylons" 
                                                                size="small" 
                                                                sx={{ 
                                                                    bgcolor: `${PALETTE.primary.main}22`, 
                                                                    color: PALETTE.primary.main, 
                                                                    border: `1px solid ${PALETTE.primary.main}44`,
                                                                    height: 24
                                                                }} 
                                                            />
                                                        )}
                                                        {s.isDessous && (
                                                            <Chip 
                                                                label="Dessous" 
                                                                size="small" 
                                                                sx={{ 
                                                                    bgcolor: `${PALETTE.accents.pink}22`, 
                                                                    color: PALETTE.accents.pink, 
                                                                    border: `1px solid ${PALETTE.accents.pink}44`,
                                                                    height: 24
                                                                }} 
                                                            />
                                                        )}
                                                    </Box>
                                                </Paper>
                                            </motion.li>
                                        ))}
                                    </AnimatePresence>
                                </List>
                            </Box>
                        );
                    })()}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenHistoryDialog(false)} sx={{ color: 'text.secondary' }}>Schließen</Button>
                </DialogActions>
            </Dialog>

            {/* --- DIALOG: ZUKUNFT (Planung) --- */}
            <Dialog open={openPlanDialog} onClose={() => setOpenPlanDialog(false)} fullWidth maxWidth="sm" PaperProps={DESIGN_TOKENS.glassCard}>
                <DialogTitle sx={{ fontFamily: 'Playfair Display, serif' }}>
                    Planung: {selectedDateStr ? format(parseISO(selectedDateStr), 'd.MM.yyyy') : ''}
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
                        Wähle Items, die an diesem Tag getragen werden müssen.
                    </Typography>
                    
                    {/* ANIMIERTE AUSWAHL-LISTE */}
                    <List 
                        component={motion.ul} 
                        variants={ANIMATIONS.staggerContainer} 
                        initial="hidden" 
                        animate="show"
                        sx={{ maxHeight: '40vh', overflow: 'auto', bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2, p: 0 }}
                    >
                        {activeItems.map(item => (
                            <motion.li key={item.id} variants={ANIMATIONS.listItem} style={{ listStyle: 'none' }}>
                                <ListItem 
                                    button 
                                    onClick={() => togglePlanItem(item.id)}
                                    sx={{ 
                                        bgcolor: selectedPlanItems.includes(item.id) ? 'rgba(230, 194, 191, 0.1)' : 'transparent',
                                        mb: 0.5, 
                                        borderLeft: selectedPlanItems.includes(item.id) ? `4px solid ${PALETTE.primary.main}` : '4px solid transparent',
                                        transition: 'all 0.2s', // Standard CSS Transition für Hover/Bg
                                    }}
                                >
                                    <ListItemAvatar>
                                        <Avatar src={item.imageUrl || item.images?.[0]} variant="rounded" sx={{ borderRadius: 2 }} />
                                    </ListItemAvatar>
                                    <ListItemText 
                                        primary={item.name} 
                                        secondary={`${item.brand} • ${item.subCategory}`}
                                        primaryTypographyProps={{ style: { fontWeight: selectedPlanItems.includes(item.id) ? 600 : 400 } }}
                                    />
                                    
                                    <AnimatePresence mode='wait'>
                                        {selectedPlanItems.includes(item.id) ? 
                                            <motion.div 
                                                key="checked"
                                                variants={ANIMATIONS.pop}
                                                initial="initial"
                                                animate="animate"
                                                exit="exit"
                                            >
                                                <CheckCircleIcon sx={{ color: PALETTE.primary.main }} />
                                            </motion.div>
                                            : 
                                            <motion.div 
                                                key="unchecked"
                                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            >
                                                <AddCircleOutlineIcon color="action" />
                                            </motion.div>
                                        }
                                    </AnimatePresence>
                                </ListItem>
                            </motion.li>
                        ))}
                    </List>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setOpenPlanDialog(false)} color="inherit">Abbrechen</Button>
                    <Button onClick={savePlan} variant="contained" color="primary">Speichern</Button>
                </DialogActions>
            </Dialog>

        </Container>
        </Box>
    </motion.div>
  );
}

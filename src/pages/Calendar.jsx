import React, { useState, useEffect, useMemo } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, getDocs, orderBy } from 'firebase/firestore'; 
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useItems } from '../contexts/ItemContext';
import { 
  Box, Container, Typography, Paper, 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, List, ListItem, ListItemText, ListItemAvatar, 
  Avatar, Divider, CircularProgress, Chip 
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';

// ICONS
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle'; 
import HistoryIcon from '@mui/icons-material/History'; 
import AccessTimeIcon from '@mui/icons-material/AccessTime';

// --- ZENTRALES DESIGN ---
import { DESIGN_TOKENS, PALETTE, MOTION } from '../theme/obsidianDesign';

// UTILS
import { format, isBefore, startOfDay, differenceInMinutes, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

const formatDurationDisplay = (mins) => {
    if (!mins || isNaN(mins)) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
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
  
  const activeItems = useMemo(() => items.filter(i => i.status === 'active'), [items]);

  // --- DATEN LADEN (Unverändert) ---
  useEffect(() => {
    if (!currentUser) return;
    const qPlan = query(collection(db, `users/${currentUser.uid}/planning`));
    const unsubPlan = onSnapshot(qPlan, (snapshot) => {
      const planData = {};
      snapshot.docs.forEach(doc => planData[doc.id] = doc.data().itemIds || []);
      setPlans(planData);
    });

    const fetchHistory = async () => {
        try {
            const qHist = query(collection(db, `users/${currentUser.uid}/sessions`), orderBy('startTime', 'desc'));
            const snapshot = await getDocs(qHist);
            const histData = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (!data.startTime?.toDate || !data.endTime?.toDate) return;
                const start = data.startTime.toDate();
                const end = data.endTime.toDate();
                const dateKey = format(start, 'yyyy-MM-dd');
                const durationMins = differenceInMinutes(end, start);
                
                if (!histData[dateKey]) histData[dateKey] = { sessions: [], nylonsDuration: 0, dessousDuration: 0, hasNylons: false, hasDessous: false };
                
                const primaryItem = items.find(i => i.id === data.itemId);
                let isNylon = false, isDessous = false;
                if (primaryItem?.mainCategory) {
                    const cat = primaryItem.mainCategory.toLowerCase();
                    if (cat.includes('nylon')) isNylon = true;
                    if (cat.includes('dessous') || cat.includes('lingerie') || cat.includes('wäsche')) isDessous = true;
                }
                if (isNylon) { histData[dateKey].nylonsDuration += durationMins; histData[dateKey].hasNylons = true; }
                if (isDessous) { histData[dateKey].dessousDuration += durationMins; histData[dateKey].hasDessous = true; }
                
                if (isNylon || isDessous) histData[dateKey].sessions.push({ start, end, duration: durationMins, isNylon, isDessous });
            });
            setHistory(histData);
        } catch (error) { console.error("Fehler History:", error); } finally { setLoadingHistory(false); }
    };
    fetchHistory();
    return () => unsubPlan();
  }, [currentUser, items]);

  // --- HANDLER ---
  const handleDayClick = (value) => {
    try {
        const dateStr = format(value, 'yyyy-MM-dd');
        setSelectedDateStr(dateStr);
        setDate(value);
        if (isBefore(value, startOfDay(new Date()))) setOpenHistoryDialog(true);
        else {
            setSelectedPlanItems(plans[dateStr] || []);
            setOpenPlanDialog(true);
        }
    } catch (e) { console.error(e); }
  };

  const savePlan = async () => {
      if (!selectedDateStr) return;
      const ref = doc(db, `users/${currentUser.uid}/planning`, selectedDateStr);
      if (selectedPlanItems.length > 0) await setDoc(ref, { date: selectedDateStr, itemIds: selectedPlanItems });
      else await deleteDoc(ref);
      setOpenPlanDialog(false);
  };

  const togglePlanItem = (id) => {
      setSelectedPlanItems(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // --- RENDER TILE ---
  const renderTileContent = ({ date, view }) => {
      if (view !== 'month') return null;
      try {
          const dateStr = format(date, 'yyyy-MM-dd');
          const isPast = isBefore(date, startOfDay(new Date()));
          
          if (isPast) {
              const dayData = history[dateStr];
              if (!dayData) return null;
              return (
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                      {dayData.hasNylons && <motion.div variants={MOTION.pop} initial="initial" animate="animate"><Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: PALETTE.primary.main, boxShadow: `0 0 5px ${PALETTE.primary.main}` }} /></motion.div>}
                      {dayData.hasDessous && <motion.div variants={MOTION.pop} initial="initial" animate="animate" transition={{delay: 0.1}}><Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: PALETTE.accents.pink, boxShadow: `0 0 5px ${PALETTE.accents.pink}` }} /></motion.div>}
                  </Box>
              );
          } else {
              const planIds = plans[dateStr];
              if (planIds?.length > 0) return <motion.div sx={{ mt: 1 }} variants={MOTION.pop} initial="initial" animate="animate"><CheckCircleIcon sx={{ fontSize: 14, color: PALETTE.accents.green }} /></motion.div>;
          }
      } catch (e) { return null; }
      return null;
  };

  return (
    <motion.div variants={MOTION.page} initial="initial" animate="animate" exit="exit">
        <Box sx={DESIGN_TOKENS.bottomNavSpacer}>
        <Container maxWidth="md">
            <Typography variant="h4" gutterBottom sx={DESIGN_TOKENS.textGradient}>Kalender</Typography>

            {/* ZENTRALISIERTE CALENDAR STYLES WERDEN HIER ANGEWENDET */}
            <Paper sx={{ p: 2, ...DESIGN_TOKENS.glassCard, ...DESIGN_TOKENS.calendar }}>
            {loadingHistory ? <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress color="primary" /></Box> : (
                <Calendar onChange={setDate} value={date} tileContent={renderTileContent} onClickDay={handleDayClick} prevLabel={<ChevronLeftIcon />} nextLabel={<ChevronRightIcon />} locale="de-DE" />
            )}
            </Paper>

            <Box sx={{ mt: 3, display: 'flex', gap: 3, justifyContent: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: PALETTE.primary.main }} /><Typography variant="caption" sx={{ color: 'text.secondary' }}>Nylons</Typography></Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: PALETTE.accents.pink }} /><Typography variant="caption" sx={{ color: 'text.secondary' }}>Dessous</Typography></Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><CheckCircleIcon sx={{ fontSize: 14, color: PALETTE.accents.green }} /><Typography variant="caption" sx={{ color: 'text.secondary' }}>Geplant</Typography></Box>
            </Box>

            {/* --- DIALOGS (Zentralisiert) --- */}
            <Dialog open={openHistoryDialog} onClose={() => setOpenHistoryDialog(false)} fullWidth maxWidth="xs" PaperProps={DESIGN_TOKENS.dialog.paper}>
                <DialogTitle sx={{ ...DESIGN_TOKENS.dialog.title.sx, color: PALETTE.primary.main }}>
                    <HistoryIcon color="inherit" />
                    {selectedDateStr ? format(parseISO(selectedDateStr), 'EEEE, d. MMMM', { locale: de }) : ''}
                </DialogTitle>
                <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
                    {(() => {
                        const data = history[selectedDateStr];
                        if (!data || (!data.hasNylons && !data.hasDessous)) return <Typography color="text.secondary" align="center" sx={{ py: 3 }}>Keine Einträge.</Typography>;
                        return (
                            <Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-around', mb: 3, p: 1, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2 }}>
                                    {data.hasNylons && <Box sx={{ textAlign: 'center' }}><Typography variant="caption" display="block">Nylons</Typography><Typography variant="h6" sx={{ color: PALETTE.primary.main }}>{formatDurationDisplay(data.nylonsDuration)}</Typography></Box>}
                                    {data.hasDessous && <Box sx={{ textAlign: 'center' }}><Typography variant="caption" display="block">Dessous</Typography><Typography variant="h6" sx={{ color: PALETTE.accents.pink }}>{formatDurationDisplay(data.dessousDuration)}</Typography></Box>}
                                </Box>
                                <List component={motion.ul} variants={MOTION.listContainer} initial="hidden" animate="show" sx={{ p: 0 }}>
                                    <AnimatePresence>
                                        {data.sessions.sort((a,b)=>a.start-b.start).map((s, idx) => (
                                            <motion.li key={idx} variants={MOTION.listItem} style={{ listStyle: 'none' }}>
                                                <Paper sx={{ p: 2, mb: 1.5, bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                        <AccessTimeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                                        <Typography variant="body1">{format(s.start, 'HH:mm')} - {format(s.end, 'HH:mm')}</Typography>
                                                        <Typography variant="caption" sx={{ ml: 'auto', bgcolor: 'rgba(255,255,255,0.1)', px: 1, py: 0.5, borderRadius: 1 }}>{formatDurationDisplay(s.duration)}</Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                                        {s.isNylon && <Chip label="Nylons" size="small" sx={{ ...DESIGN_TOKENS.chip.active, height: 24 }} />}
                                                        {s.isDessous && <Chip label="Dessous" size="small" sx={{ ...DESIGN_TOKENS.chip.active, borderColor: PALETTE.accents.pink, color: PALETTE.accents.pink, bgcolor: `${PALETTE.accents.pink}22`, height: 24 }} />}
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
                <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}><Button onClick={() => setOpenHistoryDialog(false)} color="inherit">Schließen</Button></DialogActions>
            </Dialog>

            <Dialog open={openPlanDialog} onClose={() => setOpenPlanDialog(false)} fullWidth maxWidth="sm" PaperProps={DESIGN_TOKENS.dialog.paper}>
                <DialogTitle sx={DESIGN_TOKENS.dialog.title.sx}>Planung</DialogTitle>
                <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
                    <List component={motion.ul} variants={MOTION.listContainer} initial="hidden" animate="show" sx={{ maxHeight: '40vh', overflow: 'auto', bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2 }}>
                        {activeItems.map(item => (
                            <motion.li key={item.id} variants={MOTION.listItem} style={{ listStyle: 'none' }}>
                                <ListItem button onClick={() => togglePlanItem(item.id)} sx={{ 
                                    bgcolor: selectedPlanItems.includes(item.id) ? 'rgba(255,255,255,0.05)' : 'transparent', mb: 0.5, 
                                    borderLeft: selectedPlanItems.includes(item.id) ? `4px solid ${PALETTE.primary.main}` : '4px solid transparent' 
                                }}>
                                    <ListItemAvatar><Avatar src={item.imageUrl} variant="rounded" /></ListItemAvatar>
                                    <ListItemText primary={item.name} secondary={`${item.brand} • ${item.subCategory}`} />
                                    {selectedPlanItems.includes(item.id) ? <CheckCircleIcon sx={{ color: PALETTE.primary.main }} /> : <AddCircleOutlineIcon color="action" />}
                                </ListItem>
                            </motion.li>
                        ))}
                    </List>
                </DialogContent>
                <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
                    <Button onClick={() => setOpenPlanDialog(false)} color="inherit">Abbrechen</Button>
                    <Button onClick={savePlan} variant="contained" sx={DESIGN_TOKENS.buttonGradient}>Speichern</Button>
                </DialogActions>
            </Dialog>
        </Container>
        </Box>
    </motion.div>
  );
}
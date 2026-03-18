import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useItems } from '../contexts/ItemContext';
import { useCalendarData } from '../hooks/useCalendarData';

// UI & THEME
import { Box, Container, Typography, IconButton, Paper, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { DESIGN_TOKENS, PALETTE } from '../theme/obsidianDesign';

// ICONS
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CalendarViewMonthIcon from '@mui/icons-material/CalendarViewMonth';
import ViewListIcon from '@mui/icons-material/ViewList';

// COMPONENTS & UTILS
import PlanSessionDialog from '../components/calendar/PlanSessionDialog';
import DayDetailDialog from '../components/calendar/DayDetailDialog';
import WeekDayRow from '../components/calendar/WeekDayRow';
import MonthDayCell from '../components/calendar/MonthDayCell';
import { getStartOfWeek, addDays, isSameDay, getKw } from '../utils/calendarUtils';
import { addPlannedSession, deletePlannedSession } from '../services/CalendarService';

export default function Calendar() {
  const { currentUser } = useAuth();
  const { items } = useItems();
  
  const [view, setView] = useState('week'); 
  const [currentDate, setCurrentDate] = useState(new Date());
  const [direction, setDirection] = useState(0);
  
  const [detailOpen, setDetailOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  // BUGFIX: Der Hook liegt jetzt sauber abstrahiert in src/hooks/
  const { sessions, suspensions, refreshSessions } = useCalendarData(currentUser, items);

  const handleDayClick = (date) => {
      setSelectedDay(date);
      setDetailOpen(true);
  };

  const handlePlanSession = async (sessionData) => {
      try {
          await addPlannedSession(currentUser.uid, sessionData);
          refreshSessions();
      } catch (e) {
          console.error("Fehler beim Planen:", e);
      }
  };

  const handleDeleteSession = async (sessionId) => {
      if (window.confirm('Möchtest du diese geplante Session wirklich löschen?')) {
          try {
              await deletePlannedSession(currentUser.uid, sessionId);
              refreshSessions();
          } catch (e) {
              console.error("Fehler beim Löschen der Session:", e);
          }
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 2 }}>
                <Typography variant="h4" sx={DESIGN_TOKENS.textGradient}>
                    Kalender
                </Typography>
                
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
                                        suspensions={suspensions} 
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
                                            suspensions={suspensions} 
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
                suspensions={suspensions} 
                onOpenPlan={() => { setDetailOpen(false); setPlanOpen(true); }}
                onDeleteSession={handleDeleteSession}
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
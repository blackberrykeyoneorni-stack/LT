import React, { useState, useEffect } from 'react';
import { 
    Card, CardContent, Typography, Box, Button, IconButton, LinearProgress, Chip 
} from '@mui/material';
import StopIcon from '@mui/icons-material/Stop';
import LockIcon from '@mui/icons-material/Lock';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ReportProblemIcon from '@mui/icons-material/ReportProblem'; // Für Debt Icon
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import { motion, AnimatePresence } from 'framer-motion';

export default function ActiveSessionsList({ activeSessions, items, onStopSession, onNavigateItem, onOpenRelease }) {
  // Eigener Ticker für Live-Updates der Buttons (jede Minute)
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  if (!activeSessions || activeSessions.length === 0) return null;

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" gutterBottom sx={{ px: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
         <AccessTimeIcon color="primary" /> Aktive Protokolle
      </Typography>
      
      <AnimatePresence>
        {activeSessions.map((session) => {
            const item = items.find(i => i.id === session.itemId) || { name: 'Unbekanntes Item', img: null };
            
            // Dauer berechnen
            const startTime = session.startTime?.toDate ? session.startTime.toDate() : new Date(session.startTime);
            const durationMinutes = Math.floor((new Date() - startTime) / 60000);
            
            // --- DEBT LOGIC CHECK ---
            const minDuration = session.minDuration || 0; // Das ist die Schuld, die beim Start gesetzt wurde
            const isDebtLocked = durationMinutes < minDuration;
            const remainingDebt = Math.max(0, minDuration - durationMinutes);

            const isPunishment = session.type === 'punishment';
            const isTZD = session.type === 'tzd' || session.tzdExecuted; 
            
            return (
                <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ duration: 0.3 }}
                >
                    <Card sx={{ 
                        mb: 2, 
                        ...DESIGN_TOKENS.glassCard,
                        borderLeft: `4px solid ${isPunishment ? PALETTE.accents.red : (session.isDebtSession ? PALETTE.accents.red : PALETTE.primary.main)}`
                    }}>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                <Box>
                                    <Typography variant="h6" onClick={() => onNavigateItem(session.itemId)} sx={{ cursor: 'pointer', fontWeight: 'bold' }}>
                                        {item.name}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {session.isDebtSession ? "SCHULDENABBAU" : (isPunishment ? "STRAFARBEIT" : (isTZD ? "ZEITLOSES DIKTAT" : "Laufend"))}
                                    </Typography>
                                </Box>
                                <Chip 
                                    label={`${durationMinutes} min`} 
                                    color={session.isDebtSession ? "error" : "primary"} 
                                    variant={session.isDebtSession ? "filled" : "outlined"}
                                    size="small" 
                                />
                            </Box>

                            {/* DEBT PROGRESS BAR */}
                            {session.isDebtSession && (
                                <Box sx={{ mt: 1, mb: 2 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Typography variant="caption" color="error">Tilgungspflicht</Typography>
                                        <Typography variant="caption" color="text.secondary">{durationMinutes} / {minDuration} min</Typography>
                                    </Box>
                                    <LinearProgress 
                                        variant="determinate" 
                                        value={Math.min(100, (durationMinutes / minDuration) * 100)} 
                                        color="error"
                                        sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,0,0,0.1)' }}
                                    />
                                </Box>
                            )}

                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
                                {(isTZD || isPunishment || session.isDebtSession) ? (
                                    <Button 
                                        variant="outlined" 
                                        color="error" 
                                        size="small"
                                        disabled={isDebtLocked || (isPunishment && durationMinutes < 30)}
                                        onClick={() => onStopSession(session)}
                                        startIcon={isDebtLocked ? <LockIcon /> : <StopIcon />}
                                        sx={{ 
                                            borderColor: isDebtLocked ? 'rgba(255,255,255,0.1)' : PALETTE.accents.red,
                                            color: isDebtLocked ? 'text.disabled' : PALETTE.accents.red
                                        }}
                                    >
                                        {isDebtLocked ? `GESPERRT (${remainingDebt}m)` : "BEENDEN"}
                                    </Button>
                                ) : (
                                    <Button 
                                        variant="contained" 
                                        color="primary" 
                                        size="small"
                                        onClick={() => onStopSession(session)}
                                        startIcon={<StopIcon />}
                                    >
                                        Beenden
                                    </Button>
                                )}
                                
                                {/* Release Option für bestimmte Sessions */}
                                {!isDebtLocked && !isPunishment && (
                                    <Button size="small" color="inherit" onClick={onOpenRelease}>
                                        Release?
                                    </Button>
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                </motion.div>
            );
        })}
      </AnimatePresence>
    </Box>
  );
}
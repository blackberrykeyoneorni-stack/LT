import React, { useState, useEffect } from 'react';
import { 
    Card, CardContent, Typography, Box, Button, Chip, LinearProgress, Avatar 
} from '@mui/material';
import StopIcon from '@mui/icons-material/Stop';
import LockIcon from '@mui/icons-material/Lock';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import { motion, AnimatePresence } from 'framer-motion';

export default function ActiveSessionsList({ activeSessions, items, onStopSession, onNavigateItem, onOpenRelease }) {
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
            // Wir sammeln ALLE Items der Session ein
            const sessionItems = session.itemIds 
                ? session.itemIds.map(id => items.find(i => i.id === id)).filter(Boolean)
                : [items.find(i => i.id === session.itemId)].filter(Boolean);

            const startTime = session.startTime?.toDate ? session.startTime.toDate() : new Date(session.startTime);
            const durationMinutes = Math.floor((new Date() - startTime) / 60000);
            
            // Debt Logic
            const minDuration = session.minDuration || 0;
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
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                <Box>
                                    <Typography variant="caption" color="text.secondary" sx={{textTransform: 'uppercase', letterSpacing: 1}}>
                                        {session.isDebtSession ? "SCHULDENABBAU" : (isPunishment ? "STRAFARBEIT" : (isTZD ? "ZEITLOSES DIKTAT" : "LAUFEND"))}
                                    </Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#fff', mt: 0.5 }}>
                                        {Math.floor(durationMinutes / 60)}:{String(durationMinutes % 60).padStart(2, '0')} h
                                    </Typography>
                                </Box>
                                <Chip 
                                    label={isDebtLocked ? "LOCKED" : "ACTIVE"} 
                                    color={isDebtLocked ? "error" : "success"} 
                                    variant={isDebtLocked ? "filled" : "outlined"}
                                    size="small" 
                                    icon={isDebtLocked ? <LockIcon fontSize="small"/> : null}
                                />
                            </Box>

                            {/* ITEMS LIST (Wiederhergestellt: Alle Items sichtbar) */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                                {sessionItems.map((item, idx) => (
                                    <Box 
                                        key={item.id || idx} 
                                        onClick={() => onNavigateItem(item.id)}
                                        sx={{ 
                                            display: 'flex', alignItems: 'center', gap: 1.5, 
                                            p: 1, borderRadius: 1, 
                                            bgcolor: 'rgba(255,255,255,0.05)',
                                            cursor: 'pointer',
                                            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
                                        }}
                                    >
                                        <Avatar 
                                            src={item.imageUrl || item.image} 
                                            variant="rounded" 
                                            sx={{ width: 40, height: 40, border: `1px solid ${PALETTE.primary.main}` }}
                                        />
                                        <Box>
                                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{item.name}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {item.brand} • {item.subCategory}
                                            </Typography>
                                        </Box>
                                    </Box>
                                ))}
                            </Box>

                            {/* DEBT PROGRESS */}
                            {session.isDebtSession && (
                                <Box sx={{ mt: 1, mb: 2 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Typography variant="caption" color="error">Pflicht-Tilgung</Typography>
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

                            {/* ACTIONS */}
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                                {(isTZD || isPunishment || session.isDebtSession) ? (
                                    <Button 
                                        variant="outlined" 
                                        color="error" 
                                        fullWidth
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
                                        fullWidth
                                        onClick={() => onStopSession(session)}
                                        startIcon={<StopIcon />}
                                    >
                                        Session Beenden
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
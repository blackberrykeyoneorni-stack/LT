import React, { useState, useEffect } from 'react';
import { 
    Card, CardContent, Typography, Box, Button, Chip, LinearProgress, Avatar 
} from '@mui/material';
import StopIcon from '@mui/icons-material/Stop';
import LockIcon from '@mui/icons-material/Lock';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import { motion, AnimatePresence } from 'framer-motion';

export default function ActiveSessionsList({ activeSessions, items, onStopSession, onNavigateItem, onOpenRelease }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  if (!activeSessions || activeSessions.length === 0) return null;

  const formatDuration = (totalMinutes) => {
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      if (h > 0) return `${h} h ${m} min`;
      return `${m} min`;
  };

  return (
    <Box sx={{ mb: 4 }}>
      <AnimatePresence>
        {activeSessions.map((session) => {
            const sessionItems = session.itemIds 
                ? session.itemIds.map(id => items.find(i => i.id === id)).filter(Boolean)
                : [items.find(i => i.id === session.itemId)].filter(Boolean);

            const startTime = session.startTime?.toDate ? session.startTime.toDate() : new Date(session.startTime);
            const durationMinutes = Math.floor((new Date() - startTime) / 60000);
            
            // KORREKTUR: Dynamische minDuration anstelle von fixierten 30 Minuten
            const minDuration = session.minDuration || 0;
            const isPunishment = session.type === 'punishment';
            const isTZD = session.type === 'tzd' || session.tzdExecuted; 
            
            const isDebtLocked = session.isDebtSession && durationMinutes < minDuration;
            const isPunishmentLocked = isPunishment && durationMinutes < minDuration;
            const isLocked = isDebtLocked || isPunishmentLocked;
            const remainingTime = Math.max(0, minDuration - durationMinutes);
            
            let typeLabel = "FREIWILLIG";
            let borderColor = PALETTE.primary.main;
            let chipColor = PALETTE.primary.main; 
            let chipBg = '#000000'; 

            if (session.isDebtSession) {
                typeLabel = "SCHULDENABBAU";
                borderColor = PALETTE.accents.red;
                chipColor = PALETTE.accents.red;
                chipBg = '#FFFFFF'; 
            } else if (isPunishment) {
                typeLabel = "STRAFARBEIT";
                borderColor = PALETTE.accents.red;
                chipColor = PALETTE.accents.red;
                chipBg = '#FFFFFF';
            } else if (isTZD) {
                typeLabel = "ZEITLOSES DIKTAT";
                borderColor = PALETTE.accents.red;
                chipColor = PALETTE.accents.red;
                chipBg = '#FFFFFF';
            } else if (session.type === 'instruction') {
                typeLabel = "INSTRUCTION";
                borderColor = PALETTE.accents.gold;
                chipColor = PALETTE.accents.gold;
                chipBg = '#000000'; 
            }

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
                        borderLeft: `4px solid ${borderColor}` 
                    }}>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Chip 
                                    label={typeLabel} 
                                    sx={{ 
                                        fontWeight: 900, 
                                        fontSize: '0.75rem', 
                                        height: '24px',
                                        color: chipColor,
                                        bgcolor: chipBg,
                                        border: `2px solid ${chipColor}`,
                                        boxShadow: `0 0 10px ${chipColor}40`,
                                        textShadow: chipBg === '#000000' ? `0 0 5px ${chipColor}` : 'none'
                                    }}
                                />
                                {isLocked && (
                                    <Chip 
                                        label="LOCKED" 
                                        size="small" 
                                        icon={<LockIcon fontSize="small"/>} 
                                        color="error" 
                                        variant="outlined"
                                        sx={{ height: '24px' }}
                                    />
                                )}
                            </Box>

                            {/* ITEM LISTE */}
                            {sessionItems.length > 0 && (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                                    {sessionItems.map((item, idx) => (
                                        <Box 
                                            key={item.id || idx} 
                                            onClick={() => onNavigateItem(item.id)}
                                            sx={{ 
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                p: 1, borderRadius: 1, 
                                                bgcolor: 'rgba(255,255,255,0.05)',
                                                cursor: 'pointer',
                                                transition: 'background 0.2s',
                                                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                <Avatar 
                                                    src={item.imageUrl || item.image} 
                                                    variant="rounded" 
                                                    sx={{ width: 40, height: 40, border: `1px solid ${PALETTE.primary.main}` }}
                                                />
                                                <Box>
                                                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                                                        {item.name}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {item.brand}
                                                    </Typography>
                                                </Box>
                                            </Box>

                                            <Chip 
                                                label={formatDuration(durationMinutes)} 
                                                size="small" 
                                                variant="outlined"
                                                sx={{ 
                                                    height: '20px', 
                                                    fontSize: '0.7rem', 
                                                    borderColor: 'rgba(255,255,255,0.2)', 
                                                    color: 'text.secondary' 
                                                }}
                                            />
                                        </Box>
                                    ))}
                                </Box>
                            )}

                            {/* PROGRESS BAR - Nun auch für Strafen visualisiert */}
                            {(session.isDebtSession || isPunishment) && minDuration > 0 && (
                                <Box sx={{ mt: 1, mb: 2 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Typography variant="caption" color="error">
                                            {isPunishment ? "Strafzeit" : "Pflicht-Tilgung"}
                                        </Typography>
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

                            {/* ACTIONS - Korrigierte Button Farbigkeit & Sperrung */}
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                                {(isTZD || isPunishment || session.isDebtSession) ? (
                                    <Button 
                                        variant={isLocked ? "outlined" : "contained"} 
                                        size="small"
                                        fullWidth
                                        disabled={isLocked}
                                        onClick={() => onStopSession(session)}
                                        startIcon={isLocked ? <LockIcon /> : <StopIcon />}
                                        sx={isLocked ? { 
                                            borderColor: 'rgba(255,255,255,0.1)',
                                            color: 'text.disabled'
                                        } : {
                                            bgcolor: PALETTE.primary.main,
                                            color: '#000',
                                            '&:hover': { bgcolor: PALETTE.primary.dark }
                                        }}
                                    >
                                        {isLocked ? `GESPERRT (${remainingTime}m)` : "BEENDEN"}
                                    </Button>
                                ) : (
                                    <Button 
                                        variant="contained" 
                                        color="primary" 
                                        size="small"
                                        fullWidth
                                        onClick={() => onStopSession(session)}
                                        startIcon={<StopIcon />}
                                    >
                                        Beenden
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
import React from 'react';
import { Paper, Box, Typography, Stack, Chip } from '@mui/material';
import BlockIcon from '@mui/icons-material/Block'; 
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EventIcon from '@mui/icons-material/Event';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { isSameDay, calculateEffectiveMinutes, formatDuration, getSuspensionForDate } from '../../utils/calendarUtils';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';

export default function WeekDayRow({ date, sessions, suspensions, isToday, onClick }) {
    const daySessions = sessions.filter(s => isSameDay(s.date, date));
    
    // STRIKTER FILTER: Wir trennen physische Vollzüge von bloßen Planungen
    const actualSessions = daySessions.filter(s => s.type !== 'planned');
    const plannedSessions = daySessions.filter(s => s.type === 'planned');

    const nylonSessions = actualSessions.filter(s => s.hasNylon);
    const lingerieSessions = actualSessions.filter(s => s.hasLingerie);

    // Diese Minuten fließen in die KPI - und zwar NUR noch echte, stattgefundene
    const nylonMinutes = calculateEffectiveMinutes(nylonSessions);
    const lingerieMinutes = calculateEffectiveMinutes(lingerieSessions);
    
    const hasActiveSession = actualSessions.some(s => s.isActive);
    const activeSuspension = getSuspensionForDate(date, suspensions);

    const dayName = date.toLocaleDateString('de-DE', { weekday: 'short' }).toUpperCase();
    const dayNumber = date.getDate();
    const isFuture = date > new Date();

    const isEmpty = nylonMinutes === 0 && lingerieMinutes === 0 && !hasActiveSession && plannedSessions.length === 0;

    return (
        <Paper 
            onClick={() => onClick(date)}
            sx={{ 
                mb: 1, p: 1.5, 
                display: 'flex', alignItems: 'center', gap: 2,
                ...DESIGN_TOKENS.glassCard,
                borderLeft: isToday ? `4px solid ${PALETTE.primary.main}` : (activeSuspension ? `4px solid ${PALETTE.accents.gold}` : '1px solid rgba(255,255,255,0.1)'),
                bgcolor: activeSuspension ? 'rgba(255, 215, 0, 0.03)' : undefined,
                opacity: isFuture && !activeSuspension && plannedSessions.length === 0 ? 0.6 : 1,
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
                    <>
                        {isEmpty ? (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                                    {isFuture ? "Keine Planung" : "Keine Aktivität"}
                                </Typography>
                                {isFuture && <AddCircleOutlineIcon sx={{ color: 'text.disabled', fontSize: 20 }} />}
                            </Box>
                        ) : (
                            <Stack spacing={1}>
                                {hasActiveSession && (
                                    <Chip label="Session läuft" size="small" color="success" variant="outlined" sx={{ alignSelf: 'flex-start' }} />
                                )}
                                
                                {/* Anzeige für ECHTE GETRAGENE Zeiten */}
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
                                        bgcolor: `${PALETTE.accents.blue}15`, 
                                        borderRadius: 1, px: 1.5, py: 0.5,
                                        border: `1px solid ${PALETTE.accents.blue}44`
                                    }}>
                                        <Typography variant="caption" sx={{ color: PALETTE.accents.blue, fontWeight: 'bold' }}>DESSOUS</Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <AccessTimeIcon sx={{ fontSize: 14, color: PALETTE.accents.blue }} />
                                            <Typography variant="body2" sx={{ color: PALETTE.text.primary, fontWeight: 600 }}>
                                                {formatDuration(lingerieMinutes)}
                                            </Typography>
                                        </Box>
                                    </Box>
                                )}

                                {/* VISUELLE ABGRENZUNG: Anzeige für geplante (noch nicht erfüllte) Sessions */}
                                {plannedSessions.length > 0 && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: (nylonMinutes > 0 || lingerieMinutes > 0) ? 0.5 : 0 }}>
                                        <EventIcon sx={{ fontSize: 14, color: PALETTE.text.secondary }} />
                                        <Typography variant="body2" sx={{ color: PALETTE.text.secondary, fontStyle: 'italic' }}>
                                            {plannedSessions.length} Session(s) geplant
                                        </Typography>
                                    </Box>
                                )}
                            </Stack>
                        )}
                    </>
                )}
            </Box>
        </Paper>
    );
}
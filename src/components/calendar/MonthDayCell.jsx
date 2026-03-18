import React from 'react';
import { Paper, Box, Typography, Stack } from '@mui/material';
import { isSameDay, getSuspensionForDate } from '../../utils/calendarUtils';
import { PALETTE } from '../../theme/obsidianDesign';

export default function MonthDayCell({ date, sessions, suspensions, isToday, onClick }) {
    const daySessions = sessions.filter(s => isSameDay(s.date, date));
    
    const actualSessions = daySessions.filter(s => s.type !== 'planned');
    const plannedSessions = daySessions.filter(s => s.type === 'planned');

    const hasNylon = actualSessions.some(s => s.hasNylon);
    const hasLingerie = actualSessions.some(s => s.hasLingerie);
    const hasActive = actualSessions.some(s => s.isActive);
    const hasPlanned = plannedSessions.length > 0;
    
    const activeSuspension = getSuspensionForDate(date, suspensions);

    return (
        <Paper 
            onClick={() => onClick(date)}
            sx={{ 
                height: 80, p: 0.5, 
                display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
                position: 'relative', 
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
                {activeSuspension && (
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: PALETTE.accents.gold }} />
                )}
                {hasActive && !activeSuspension && (
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: PALETTE.accents.green }} />
                )}
            </Box>

            {(hasNylon || hasLingerie || hasPlanned) && (
                <Stack spacing={0.5} mt={1} sx={{ width: '100%', alignItems: 'center' }}>
                    {hasNylon && <Box sx={{ width: '80%', height: 4, borderRadius: 2, bgcolor: PALETTE.accents.purple }} />}
                    {hasLingerie && <Box sx={{ width: '80%', height: 4, borderRadius: 2, bgcolor: PALETTE.accents.blue }} />}
                    {hasPlanned && !hasNylon && !hasLingerie && (
                        <Box sx={{ width: '80%', height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.2)' }} />
                    )}
                </Stack>
            )}
        </Paper>
    );
}
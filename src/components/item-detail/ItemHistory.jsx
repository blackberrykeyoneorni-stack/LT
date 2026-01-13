import React from 'react';
import { Box, Typography, Stack, Paper, Chip } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import LocalLaundryServiceIcon from '@mui/icons-material/LocalLaundryService';
import DeleteIcon from '@mui/icons-material/Delete';
import { formatDuration } from '../../utils/formatters';
import { PALETTE } from '../../theme/obsidianDesign';

export default function ItemHistory({ historyEvents }) {
    if (!historyEvents || historyEvents.length === 0) return null;

    return (
        <Box sx={{ mb: 10 }}>
            <Typography variant="h6" gutterBottom sx={{ borderBottom: `1px solid ${PALETTE.background.glassBorder}`, pb: 1 }}>Historie</Typography>
            <Stack spacing={1}>
                {historyEvents.map((event, idx) => {
                    let label = '';
                    let sub = '';
                    let color = 'default';
                    let icon = null;
                    let durationLabel = '';

                    if (event.type === 'session') {
                        const s = event.data;
                        const typeLabel = s.type === 'instruction' ? 'Anweisung' : (s.type === 'voluntary' ? 'Freiwillig' : 'Session');
                        label = `${typeLabel}${s.subtype ? ` (${s.subtype})` : ''}`;
                        color = s.type === 'instruction' ? 'secondary' : 'default';
                        icon = <AccessTimeIcon style={{ fontSize: 16 }} />;
                        
                        const endTime = s.endTime ? s.endTime.toDate ? s.endTime.toDate() : new Date(s.endTime) : null;
                        if (endTime) {
                            sub = `${event.date.toLocaleDateString()}, ${event.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                            durationLabel = formatDuration(s.durationMinutes || 0);
                        } else {
                            sub = `${event.date.toLocaleDateString()} - Laufend`;
                            durationLabel = 'Laufend';
                        }
                    } else if (event.type === 'release') {
                        const r = event.data;
                        label = "Release Protocol";
                        sub = `${event.date.toLocaleDateString()} • Intensität ${r.intensity || '?'}`;
                        color = "info";
                        icon = <WaterDropIcon style={{ fontSize: 16 }} />;
                        durationLabel = r.outcome === 'maintained' ? 'Maintained' : 'Removed';
                    } else if (event.type === 'wash') {
                        label = "Reinigung";
                        sub = `${event.date.toLocaleDateString()} • Gewaschen`;
                        color = "success";
                        icon = <LocalLaundryServiceIcon style={{ fontSize: 16 }} />;
                        durationLabel = 'Sauber';
                    } else if (event.type === 'archived') {
                        label = "Archiviert";
                        sub = `${event.date.toLocaleDateString()} • ${event.data.reason || 'Kein Grund'}`;
                        color = "error";
                        icon = <DeleteIcon style={{ fontSize: 16 }} />;
                        durationLabel = 'End of Life';
                    }

                    return (
                        <Paper key={idx} sx={{ p: 2, bgcolor: PALETTE.background.lightGlass, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>{icon} {label}</Typography>
                                <Typography variant="caption" color="text.secondary">{sub}</Typography>
                            </Box>
                            <Chip label={durationLabel} color={color} size="small" variant="outlined" />
                        </Paper>
                    );
                })}
            </Stack>
        </Box>
    );
}
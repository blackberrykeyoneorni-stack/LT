import React from 'react';
import { Box, Typography, Stack, Paper, Chip } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import LocalLaundryServiceIcon from '@mui/icons-material/LocalLaundryService';
import DeleteIcon from '@mui/icons-material/Delete';
import GavelIcon from '@mui/icons-material/Gavel'; 
import InfoIcon from '@mui/icons-material/Info'; 
import { formatDuration } from '../../utils/formatters';
import { PALETTE, DESIGN_TOKENS } from '../../theme/obsidianDesign';

export default function ItemHistory({ historyEvents }) {
    if (!historyEvents || historyEvents.length === 0) return null;

    return (
        <Box sx={{ mb: 10 }}>
            <Typography variant="h6" gutterBottom sx={{ borderBottom: `1px solid ${PALETTE.background.glassBorder}`, pb: 1, color: PALETTE.primary.main, textTransform: 'uppercase', fontWeight: 800 }}>Historie</Typography>
            <Stack spacing={1}>
                {historyEvents.map((event, idx) => {
                    let label = '';
                    let sub = '';
                    let color = 'default';
                    let icon = null;
                    let durationLabel = '';

                    // KORREKTUR: Robuste Timestamp-Decodierung für IndexedDB Cache-Objekte
                    const parseFirebaseDate = (val) => {
                        if (!val) return null;
                        if (val instanceof Date && !isNaN(val)) return val;
                        if (typeof val.toDate === 'function') {
                            const d = val.toDate();
                            return isNaN(d) ? null : d;
                        }
                        if (val.seconds) return new Date(val.seconds * 1000);
                        const parsed = new Date(val);
                        return isNaN(parsed) ? null : parsed;
                    };

                    const safeEventDate = parseFirebaseDate(event.date);
                    const dateStr = safeEventDate ? safeEventDate.toLocaleDateString() : 'Unbekannt';

                    if (event.type === 'session') {
                        const s = event.data;
                        
                        // KORREKTUR: Präzise Aufschlüsselung der Session-Kategorien (Tag/Nacht, TZD Subtypen)
                        let typeLabel = 'Session';
                        if (s.type === 'instruction') {
                            typeLabel = s.periodId === 'night' ? 'Anweisung (Nacht)' : 'Anweisung (Tag)';
                        }
                        else if (s.type === 'voluntary') typeLabel = 'Freiwillig';
                        else if (s.type === 'punishment') typeLabel = 'Strafarbeit';
                        else if (s.type === 'tzd') {
                            typeLabel = 'Zeitloses Diktat';
                            if (s.subtype) {
                                typeLabel += ` (${s.subtype.charAt(0).toUpperCase() + s.subtype.slice(1)})`;
                            }
                        }
                        else if (s.isDebtSession || s.type === 'debt') typeLabel = 'Schuldenabbau';

                        label = typeLabel;
                        color = s.type === 'instruction' ? 'secondary' : (s.type === 'punishment' ? 'error' : 'default');
                        icon = <AccessTimeIcon style={{ fontSize: 16 }} />;
                        
                        const startTime = safeEventDate || parseFirebaseDate(s.startTime);
                        const endTime = parseFirebaseDate(s.endTime);

                        if (endTime && startTime) {
                            sub = `${startTime.toLocaleDateString()}, ${startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                            const diffMs = endTime.getTime() - startTime.getTime();
                            const diffMins = Math.floor(diffMs / 60000);
                            durationLabel = formatDuration(diffMins);
                        } else if (startTime) {
                            sub = `${startTime.toLocaleDateString()} - Laufend`;
                            durationLabel = 'Laufend';
                        } else {
                            sub = 'Datum unlesbar';
                            durationLabel = '-';
                        }
                    } else if (event.type === 'release') {
                        const r = event.data;
                        label = "Release Protocol";
                        sub = `${dateStr} • Intensität ${r.intensity || '?'}`;
                        color = "info";
                        icon = <WaterDropIcon style={{ fontSize: 16 }} />;
                        durationLabel = r.outcome === 'maintained' ? 'Maintained' : 'Removed';
                    } else if (event.type === 'wash_pending') {
                        // KORREKTUR: Explizites Erfassen, wann ein Item in den Wäschekorb gelegt wurde
                        label = "Wäschekorb";
                        sub = `${dateStr} • Zur Reinigung hinzugefügt`;
                        color = "warning";
                        icon = <LocalLaundryServiceIcon style={{ fontSize: 16 }} />;
                        durationLabel = 'Wartend';
                    } else if (event.type === 'wash') {
                        label = "Reinigung";
                        sub = `${dateStr} • Gewaschen`;
                        color = "success";
                        icon = <LocalLaundryServiceIcon style={{ fontSize: 16 }} />;
                        durationLabel = 'Sauber';
                    } else if (event.type === 'archived') {
                        label = "Archiviert";
                        sub = `${dateStr} • ${event.data.reason || 'Kein Grund'}`;
                        color = "error";
                        icon = <DeleteIcon style={{ fontSize: 16 }} />;
                        durationLabel = 'End of Life';
                    } 
                    else if (event.type && event.type.startsWith('tzd_')) {
                        label = "Zeitloses Diktat";
                        sub = event.data?.message || `${dateStr} • Systemeingriff`;
                        color = event.data?.isPenalty ? "error" : "warning";
                        icon = <GavelIcon style={{ fontSize: 16 }} />;
                        durationLabel = 'TZD';
                    } 
                    else {
                        label = event.type ? event.type.toUpperCase() : "Protokoll-Ereignis";
                        sub = event.data?.message || `${dateStr} • Status Update`;
                        color = "default";
                        icon = <InfoIcon style={{ fontSize: 16 }} />;
                        durationLabel = 'Info';
                    }

                    // Sissy Color Mapping for Chips
                    const mappedColor = color === 'secondary' ? 'primary' : (color === 'info' ? 'secondary' : color);
                    const iconColor = color === 'success' ? PALETTE.accents.green : (color === 'info' ? PALETTE.accents.blue : (color === 'error' ? PALETTE.accents.red : PALETTE.primary.main));

                    return (
                        <Paper key={idx} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...DESIGN_TOKENS.glassCard }}>
                            <Box>
                                <Typography variant="body2" sx={{ fontWeight: 800, color: '#FFF', display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <span style={{ color: iconColor, display: 'flex', alignItems: 'center' }}>{icon}</span> {label}
                                </Typography>
                                <Typography variant="caption" sx={{ color: PALETTE.text.secondary }}>{sub}</Typography>
                            </Box>
                            <Chip label={durationLabel} color={mappedColor} size="small" sx={{ fontWeight: 'bold', borderRadius: '6px' }} />
                        </Paper>
                    );
                })}
            </Stack>
        </Box>
    );
}
import React, { useMemo } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, IconButton, Paper, 
    Chip, List, ListItem, ListItemText, Divider, Stack, Button 
} from '@mui/material';
import BlockIcon from '@mui/icons-material/Block'; 
import EventIcon from '@mui/icons-material/Event';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { isSameDay, formatDuration, getSuspensionForDate } from '../../utils/calendarUtils';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';

export default function DayDetailDialog({ open, onClose, date, sessions, suspensions, onOpenPlan, onDeleteSession }) {
    if (!date) return null;

    const rawDaySessions = sessions.filter(s => isSameDay(s.date, date));
    rawDaySessions.sort((a, b) => a.date - b.date);
    
    // Grouping Logik
    const groupedSessions = useMemo(() => {
        const groups = [];
        rawDaySessions.forEach(session => {
            const existing = groups.find(g => 
                Math.abs(g.date - session.date) < 60000 && 
                g.type === session.type
            );
            if (existing) {
                session.items.forEach(item => {
                    if (!existing.items.find(i => i.id === item.id)) {
                        existing.items.push(item);
                    }
                });
            } else {
                groups.push({
                    ...session,
                    items: [...session.items] 
                });
            }
        });
        return groups;
    }, [rawDaySessions]);

    const activeSuspension = getSuspensionForDate(date, suspensions);

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={DESIGN_TOKENS.dialog.paper}>
            <DialogTitle sx={{ ...DESIGN_TOKENS.dialog.title.sx, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h6">{date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</Typography>
                    <Typography variant="caption" color="text.secondary">Tagesprotokoll</Typography>
                </Box>
                {!activeSuspension && (
                    <IconButton onClick={onOpenPlan} sx={{ color: PALETTE.primary.main }}>
                        <AddCircleOutlineIcon />
                    </IconButton>
                )}
            </DialogTitle>
            
            <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
                {activeSuspension && (
                    <Paper sx={{ 
                        p: 2, mb: 3, 
                        bgcolor: `${PALETTE.accents.gold}15`, 
                        border: `1px solid ${PALETTE.accents.gold}44`,
                        display: 'flex', alignItems: 'center', gap: 2
                    }}>
                        <BlockIcon sx={{ color: PALETTE.accents.gold, fontSize: 30 }} />
                        <Box>
                            <Typography variant="subtitle1" fontWeight="bold" sx={{ color: PALETTE.accents.gold }}>
                                AUSFALLZEIT AKTIV
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Grund: {activeSuspension.reason}
                            </Typography>
                            <Chip size="small" label={activeSuspension.status} sx={{ mt: 1, bgcolor: 'rgba(0,0,0,0.3)', color: '#fff' }} />
                        </Box>
                    </Paper>
                )}

                {groupedSessions.length === 0 ? (
                    !activeSuspension && (
                        <Box sx={{ py: 4, textAlign: 'center', opacity: 0.5 }}>
                            <EventIcon sx={{ fontSize: 40, mb: 1 }} />
                            <Typography>Keine Einträge für diesen Tag.</Typography>
                        </Box>
                    )
                ) : (
                    <List>
                        {groupedSessions.map((session, index) => (
                            <React.Fragment key={session.id + index}>
                                {index > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />}
                                <ListItem alignItems="flex-start" sx={{ px: 0, py: 2 }}>
                                    <Box sx={{ mr: 2, mt: 0.5, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60 }}>
                                        <Typography variant="caption" color="text.secondary">
                                            {session.date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                        </Typography>
                                        <Box sx={{ height: 20, width: 2, bgcolor: 'rgba(255,255,255,0.1)', my: 0.5 }} />
                                        <Typography variant="caption" color="text.secondary">
                                            {session.isActive 
                                                ? "..." 
                                                : new Date(session.date.getTime() + session.duration * 60000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                                            }
                                        </Typography>
                                    </Box>
                                    
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Typography variant="body1" fontWeight="bold" color={session.type === 'planned' ? 'text.secondary' : 'text.primary'}>
                                                        {formatDuration(session.duration)}
                                                    </Typography>
                                                    <Stack direction="row" spacing={1}>
                                                        {session.isActive && <Chip label="Aktiv" size="small" color="success" variant="outlined" />}
                                                        {session.type === 'planned' && <Chip label="Geplant" size="small" variant="outlined" color="info" />}
                                                    </Stack>
                                                </Box>
                                                {session.type === 'planned' && (
                                                    <IconButton size="small" color="error" onClick={() => onDeleteSession(session.originalId)} sx={{ ml: 1, mt: -0.5 }}>
                                                        <DeleteOutlineIcon fontSize="small" />
                                                    </IconButton>
                                                )}
                                            </Box>
                                        }
                                        secondary={
                                            <Stack spacing={1} sx={{ mt: 1 }}>
                                                {session.items.map(item => (
                                                    <Box key={item.id} sx={{ bgcolor: 'rgba(255,255,255,0.05)', p: 1, borderRadius: 1, opacity: session.type === 'planned' ? 0.6 : 1 }}>
                                                        <Typography variant="body2" color="text.primary">{item.name || item.brand}</Typography>
                                                        <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                                                            <Typography variant="caption" color="text.secondary">
                                                                ID: {item.customId || item.id}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                Sub: {item.subCategory || '-'}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                ))}
                                                {session.items.length === 0 && (
                                                    <Typography variant="caption" color="text.disabled" sx={{fontStyle:'italic'}}>Keine Items getrackt (Session Only)</Typography>
                                                )}
                                            </Stack>
                                        }
                                    />
                                </ListItem>
                            </React.Fragment>
                        ))}
                    </List>
                )}
            </DialogContent>
            <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
                <Button onClick={onClose} fullWidth color="inherit">Schließen</Button>
            </DialogActions>
        </Dialog>
    );
}
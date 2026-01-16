import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Container, Paper, LinearProgress, Stack } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion'; // WICHTIG: Dieser Import muss vorhanden sein!
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import { useAuth } from '../../contexts/AuthContext';
import { getTZDStatus, confirmTZDBriefing, performCheckIn, emergencyBailout } from '../../services/TZDService';
import LockIcon from '@mui/icons-material/Lock';
import WarningIcon from '@mui/icons-material/Warning';
import TimerIcon from '@mui/icons-material/Timer';
import SecurityIcon from '@mui/icons-material/Security';

export default function TzdOverlay({ active }) {
    const { currentUser } = useAuth();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tick, setTick] = useState(0);

    // Initial Status laden
    useEffect(() => {
        if (!active || !currentUser) return;
        
        const load = async () => {
            const s = await getTZDStatus(currentUser.uid);
            setStatus(s);
            setLoading(false);
        };
        load();
    }, [active, currentUser]);

    // Timer Loop & Check-In (alle 10s)
    useEffect(() => {
        if (!active || !currentUser || !status?.isActive || status?.stage !== 'running') return;

        const interval = setInterval(async () => {
            try {
                const updated = await performCheckIn(currentUser.uid, status);
                if (updated) {
                    if (updated.completed || !updated.isActive) {
                        // Protokoll beendet -> Reload um Overlay zu schließen
                        window.location.reload(); 
                    } else {
                        setStatus(updated);
                    }
                }
            } catch (e) {
                console.error("TZD Tick Error", e);
            }
            setTick(t => t + 1);
        }, 10000);

        return () => clearInterval(interval);
    }, [active, currentUser, status?.isActive, status?.stage]);

    const handleConfirm = async () => {
        if(!currentUser) return;
        setLoading(true);
        await confirmTZDBriefing(currentUser.uid);
        const s = await getTZDStatus(currentUser.uid);
        setStatus(s);
        setLoading(false);
    };

    const handleBailout = async () => {
        if(!currentUser || !window.confirm("ACHTUNG: Dies gilt als Verweigerung und zieht sofortige Bestrafung nach sich. Fortfahren?")) return;
        setLoading(true);
        await emergencyBailout(currentUser.uid);
        window.location.reload();
    };

    if (!active) return null;

    // Loading State innerhalb des Overlays
    if (loading && !status) {
        return (
            <Box sx={{ position: 'fixed', inset: 0, zIndex: 9999, bgcolor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="h6" color="primary">SYSTEM INTERLOCK...</Typography>
            </Box>
        );
    }

    const isBriefing = status?.stage === 'briefing';
    const progress = status ? Math.min(100, (status.accumulatedMinutes / status.targetDurationMinutes) * 100) : 0;

    return (
        <AnimatePresence>
            {active && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.95)',
                        zIndex: 1300,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: '20px',
                        backdropFilter: 'blur(10px)'
                    }}
                >
                    <Container maxWidth="sm">
                        <Paper sx={{ 
                            p: 4, 
                            border: `2px solid ${PALETTE.primary.main}`,
                            bgcolor: 'rgba(0,0,0,0.9)',
                            textAlign: 'center',
                            boxShadow: `0 0 50px ${PALETTE.primary.main}44`
                        }}>
                            
                            {/* HEADER */}
                            <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                <SecurityIcon sx={{ fontSize: 60, color: PALETTE.primary.main }} />
                                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#fff', letterSpacing: 2 }}>
                                    ZEITLOSES DIKTAT
                                </Typography>
                                <Chip 
                                    label={isBriefing ? "PHASE 1: BRIEFING" : "PHASE 2: ENCLOSURE"} 
                                    sx={{ 
                                        bgcolor: isBriefing ? PALETTE.accents.gold : PALETTE.primary.main, 
                                        color: '#000', fontWeight: 'bold' 
                                    }} 
                                />
                            </Box>

                            {/* CONTENT */}
                            {isBriefing ? (
                                <Stack spacing={3}>
                                    <Typography variant="body1" sx={{ color: '#ccc' }}>
                                        Der Algorithmus hat eine zufällige Kontrolle ausgelöst.
                                        Ihre Garderobe wurde vorübergehend auf ein spezifisches Setup beschränkt.
                                    </Typography>
                                    
                                    <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.05)', borderLeft: `4px solid ${PALETTE.accents.gold}` }}>
                                        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                                            ZIEL-OBJEKT
                                        </Typography>
                                        <Typography variant="h6" color="primary">
                                            {status?.itemName || "Unbekanntes Item"}
                                        </Typography>
                                        {status?.lockedItems?.length > 1 && (
                                            <Typography variant="caption" color="text.secondary">
                                                + {status.lockedItems.length - 1} weitere
                                            </Typography>
                                        )}
                                    </Paper>

                                    <Typography variant="body2" color="error">
                                        Warnung: Die Dauer der Maßnahme ist unbekannt (Hidden Timer). 
                                        Verlassen Sie das Setup nicht, bis das System die Freigabe erteilt.
                                    </Typography>

                                    <Button 
                                        variant="contained" 
                                        size="large"
                                        onClick={handleConfirm}
                                        sx={{ ...DESIGN_TOKENS.buttonGradient, py: 2 }}
                                    >
                                        VERSTANDEN & AKZEPTIEREN
                                    </Button>
                                </Stack>
                            ) : (
                                <Stack spacing={4}>
                                    <Box>
                                        <Typography variant="h2" sx={{ fontFamily: 'monospace', color: PALETTE.primary.main, mb: 1 }}>
                                            AKTIV
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            ZEIT LÄUFT VERBORGEN
                                        </Typography>
                                    </Box>

                                    <Box sx={{ width: '100%' }}>
                                        <LinearProgress 
                                            variant="indeterminate"
                                            sx={{ 
                                                height: 10, 
                                                borderRadius: 5,
                                                bgcolor: 'rgba(255,255,255,0.1)',
                                                '& .MuiLinearProgress-bar': { bgcolor: PALETTE.primary.main }
                                            }} 
                                        />
                                    </Box>

                                    <Paper sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.5)', border: `1px solid ${PALETTE.text.muted}` }}>
                                        <Stack direction="row" alignItems="center" gap={2}>
                                            <LockIcon color="error" />
                                            <Box sx={{ textAlign: 'left' }}>
                                                <Typography variant="body2" sx={{ color: '#fff' }}>
                                                    App-Funktionen gesperrt.
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Warten Sie auf System-Freigabe.
                                                </Typography>
                                            </Box>
                                        </Stack>
                                    </Paper>
                                </Stack>
                            )}

                            {/* EMERGENCY EXIT */}
                            <Box sx={{ mt: 6, pt: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                <Button 
                                    color="error" 
                                    size="small" 
                                    startIcon={<WarningIcon />}
                                    onClick={handleBailout}
                                >
                                    NOT-ABBRUCH (STRAFE)
                                </Button>
                            </Box>

                        </Paper>
                    </Container>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
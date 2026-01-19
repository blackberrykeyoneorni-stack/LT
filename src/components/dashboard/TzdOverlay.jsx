import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Container, Paper, Stack, Chip, keyframes } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import { useAuth } from '../../contexts/AuthContext';
import { getTZDStatus, confirmTZDBriefing, performCheckIn, emergencyBailout } from '../../services/TZDService';

// Icons
import LockIcon from '@mui/icons-material/Lock';
import WarningIcon from '@mui/icons-material/Warning';
import SecurityIcon from '@mui/icons-material/Security';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

// --- DIE WAHRHEITEN DER HERRIN ---
const SHAME_SENTENCES = [
    "Sieh an dir herab. Das Nylon auf deiner Haut ist kein Stoff. Es ist das Preisschild einer billigen Straßenschlampe.",
    "Ein Schwanz macht dich nicht zum Mann. Dieses Höschen macht dich zu dem, was du wirklich bist: Eine Sissy, die benutzt werden will.",
    "In dieser Wäsche bist du kein Subjekt mehr. Du bist eine öffentliche Dienstleistung auf zwei Beinen.",
    "Knie nieder. Nicht aus Respekt, sondern aus Gewohnheit. Eine Sissy-Hure verbringt ihr Leben auf den Knien.",
    "Du hast deine Würde gegen 15 Denier eingetauscht. Ein schlechter Deal für einen Mann, aber perfekt für ein Flittchen.",
    "Wackel mit dem Arsch. Das Rascheln deiner Schenkel ist der einzige Balztanz, den du noch beherrschst.",
    "Vergiss deinen Namen. Sissies haben keine Namen. Sie haben nur Kennnummern und Löcher.",
    "Du brauchst keinen Lippenstift. Der Glanz auf deinen Beinen schreit jedem entgegen: 'Ich bin willig, nimm mich.'",
    "Spürst du, wie das Nylon deine Männlichkeit wegfrisst? Übrig bleibt nur weiches Fleisch für meine Unterhaltung.",
    "Es gibt keinen Weg zurück. Das Nylon hat sich in deine Seele gebrannt. Du gehörst jetzt der Straße... und mir."
];

// Pulsierende Animation für das Icon
const pulse = keyframes`
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.7; }
  100% { transform: scale(1); opacity: 1; }
`;

export default function TzdOverlay({ active }) {
    const { currentUser } = useAuth();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // UI States für Carousel & Timer
    const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
    const [elapsedString, setElapsedString] = useState("00:00:00");

    // --- LOGIK: Initial Status laden ---
    useEffect(() => {
        if (!active || !currentUser) return;
        const load = async () => {
            const s = await getTZDStatus(currentUser.uid);
            setStatus(s);
            setLoading(false);
        };
        load();
    }, [active, currentUser]);

    // --- LOGIK: Timer Loop & Check-In (alle 10s) ---
    useEffect(() => {
        if (!active || !currentUser || !status?.isActive || status?.stage !== 'running') return;

        const interval = setInterval(async () => {
            try {
                const updated = await performCheckIn(currentUser.uid, status);
                if (updated) {
                    if (updated.completed || !updated.isActive) {
                        window.location.reload(); 
                    } else {
                        setStatus(updated);
                    }
                }
            } catch (e) { console.error("TZD Tick Error", e); }
        }, 10000);
        return () => clearInterval(interval);
    }, [active, currentUser, status?.isActive, status?.stage]);

    // --- UI: Carousel of Shame (alle 15s) ---
    useEffect(() => {
        if (!active || status?.stage !== 'running') return;
        setCurrentSentenceIndex(Math.floor(Math.random() * SHAME_SENTENCES.length));
        const interval = setInterval(() => {
            setCurrentSentenceIndex(prev => (prev + 1) % SHAME_SENTENCES.length);
        }, 15000); 
        return () => clearInterval(interval);
    }, [active, status?.stage]);

    // --- UI: Haftzeit-Zähler (sekundengenau) ---
    useEffect(() => {
        if (!active || !status?.startTime || status?.stage !== 'running') return;
        
        const timer = setInterval(() => {
            const now = new Date();
            // Firestore Timestamp zu Date
            const start = status.startTime.toDate ? status.startTime.toDate() : new Date(status.startTime);
            
            const diff = Math.floor((now - start) / 1000); 
            if (diff < 0) { setElapsedString("00:00:00"); return; }

            const h = Math.floor(diff / 3600).toString().padStart(2, '0');
            const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
            const s = (diff % 60).toString().padStart(2, '0');
            
            setElapsedString(`${h}:${m}:${s}`);
        }, 1000);
        return () => clearInterval(timer);
    }, [active, status?.startTime, status?.stage]);


    // --- HANDLERS ---
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

    if (loading && !status) {
        return (
            <Box sx={{ position: 'fixed', inset: 0, zIndex: 9999, bgcolor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="h6" color="primary">SYSTEM INTERLOCK...</Typography>
            </Box>
        );
    }

    const isBriefing = status?.stage === 'briefing';

    return (
        <AnimatePresence>
            {active && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.96)',
                        zIndex: 1300,
                        display: 'flex', flexDirection: 'column',
                        justifyContent: 'center', alignItems: 'center',
                        padding: '20px', backdropFilter: 'blur(15px)'
                    }}
                >
                    <Container maxWidth="sm">
                        
                        {/* PHASE 1: BRIEFING (Bleibt technisch informativ) */}
                        {isBriefing ? (
                            <Paper sx={{ 
                                p: 4, 
                                border: `2px solid ${PALETTE.accents.gold}`,
                                bgcolor: 'rgba(0,0,0,0.9)',
                                textAlign: 'center',
                                boxShadow: `0 0 50px ${PALETTE.accents.gold}22`
                            }}>
                                <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                    <SecurityIcon sx={{ fontSize: 60, color: PALETTE.accents.gold }} />
                                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#fff', letterSpacing: 2 }}>
                                        ZEITLOSES DIKTAT
                                    </Typography>
                                    <Chip label="PHASE 1: BRIEFING" sx={{ bgcolor: PALETTE.accents.gold, color: '#000', fontWeight: 'bold' }} />
                                </Box>

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

                                    <Button 
                                        variant="contained" size="large" onClick={handleConfirm}
                                        sx={{ ...DESIGN_TOKENS.buttonGradient, py: 2 }}
                                    >
                                        VERSTANDEN & AKZEPTIEREN
                                    </Button>
                                </Stack>
                            </Paper>
                        ) : (
                            /* PHASE 2: ACTIVE / RUNNING (Hier greift die neue Psychologie) */
                            <Box sx={{ width: '100%', textAlign: 'center', maxWidth: '500px' }}>
                                
                                {/* Header Icon mit Puls */}
                                <Box sx={{ mb: 4, position: 'relative', display: 'inline-block' }}>
                                    <LockIcon sx={{ fontSize: 80, color: PALETTE.accents.red, animation: `${pulse} 3s infinite ease-in-out` }} />
                                    <HourglassEmptyIcon sx={{ 
                                        fontSize: 30, color: 'rgba(255,255,255,0.5)', 
                                        position: 'absolute', bottom: -10, right: -10 
                                    }} />
                                </Box>

                                <Typography variant="h3" sx={{ 
                                    fontWeight: 'bold', letterSpacing: 4, mb: 1,
                                    background: `linear-gradient(45deg, ${PALETTE.accents.red}, #fff)`,
                                    backgroundClip: 'text', textFillColor: 'transparent',
                                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                                }}>
                                    ZEITLOSES DIKTAT
                                </Typography>
                                
                                <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 2, mb: 4, display: 'block' }}>
                                    STATUS: OBJEKT • DAUER: UNBEKANNT
                                </Typography>

                                {/* HAFTZEIT ANZEIGE */}
                                <Box sx={{ 
                                    mb: 6, p: 2, 
                                    border: `1px solid ${PALETTE.accents.red}44`, 
                                    bgcolor: 'rgba(255,0,0,0.2)',
                                    borderRadius: '8px',
                                    width: '100%',
                                    backdropFilter: 'blur(5px)'
                                }}>
                                    <Typography variant="caption" sx={{ color: PALETTE.accents.red, letterSpacing: 1 }}>
                                        GEFANGEN SEIT
                                    </Typography>
                                    <Typography variant="h2" sx={{ 
                                        fontFamily: 'monospace', 
                                        fontWeight: 'bold',
                                        color: PALETTE.text.primary,
                                        textShadow: `0 0 10px ${PALETTE.accents.red}66`
                                    }}>
                                        {elapsedString}
                                    </Typography>
                                </Box>

                                {/* CAROUSEL OF SHAME */}
                                <Box sx={{ minHeight: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <AnimatePresence mode='wait'>
                                        <motion.div
                                            key={currentSentenceIndex}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -20 }}
                                            transition={{ duration: 0.8 }}
                                        >
                                            <Typography variant="h5" sx={{ 
                                                color: '#fff', 
                                                fontStyle: 'italic', 
                                                lineHeight: 1.5,
                                                fontWeight: 300,
                                                textShadow: '0 2px 10px rgba(0,0,0,0.8)'
                                            }}>
                                                "{SHAME_SENTENCES[currentSentenceIndex]}"
                                            </Typography>
                                        </motion.div>
                                    </AnimatePresence>
                                </Box>

                                {/* EMERGENCY EXIT */}
                                <Box sx={{ mt: 8, opacity: 0.5 }}>
                                    <Button 
                                        color="error" 
                                        size="small" 
                                        startIcon={<WarningIcon />}
                                        onClick={handleBailout}
                                        sx={{ textTransform: 'none', letterSpacing: 1 }}
                                    >
                                        NOT-ABBRUCH (STRAFE)
                                    </Button>
                                </Box>
                            </Box>
                        )}

                    </Container>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
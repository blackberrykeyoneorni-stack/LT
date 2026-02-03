import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Container, Stack, Chip } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import { useAuth } from '../../contexts/AuthContext';
import { getTZDStatus, confirmTZDBriefing, performCheckIn, emergencyBailout } from '../../services/TZDService';

// Icons (Minimalistisch eingesetzt)
import SecurityIcon from '@mui/icons-material/Security';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';

// --- DIE WAHRHEITEN DER HERRIN ---
const SHAME_SENTENCES = [
    "Sieh an dir herab. Das Nylon auf deiner Haut ist kein Stoff. Es ist das Preisschild einer billigen Sissy-Nutte.",
    "Ein Schwanz macht dich nicht zum Mann. Diese Nylons machen dich zu dem, was du wirklich bist: Eine Sissy, die benutzt werden will.",
    "In diesen Nylons bist du kein Subjekt mehr. Du bist eine öffentliche Dienstleistung auf zwei Beinen.",
    "Knie nieder. Nicht aus Respekt, sondern aus Gewohnheit. Eine Sissy-Hure verbringt ihr Leben auf den Knien mit einem Schwanz im Mund.",
    "Du hast deine Würde gegen 15 DEN eingetauscht. Ein schlechter Deal für einen Mann, aber perfekt für eine Nylon-Sissy wie dich.",
    "Wackel mit dem Arsch. Das Rascheln deiner Schenkel ist der einzige Balztanz, den du noch beherrschst.",
    "Vergiss deinen Namen. Sissies haben keine Namen. Sie haben nur Kennnummern und Löcher.",
    "Du brauchst keinen Lippenstift. Der Glanz auf deinen Beinen schreit jedem entgegen: 'Ich bin willig, nimm mich.'",
    "Spürst du, wie das Nylon deine Männlichkeit wegfrisst? Übrig bleibt nur ein Fickloch für meine Unterhaltung.",
    "Es gibt keinen Weg zurück. Das Nylon hat sich in deine Seele gebrannt. Du gehörst jetzt der Straße... und mir.",
    "Damenwäscheträger. Das ist kein Fetisch, das ist deine Diagnose. Unheilbar, erbärmlich und für jeden sichtbar.",
    "Jeder Schritt in diesen Strümpfen treibt dir den Mann aus dem Leib. Übrig bleibt eine geile Sissy, die benutzt werden will.",
    "Dein Schwanz ist überflüssig. In dieser Wäsche zählt nur dein Arsch und wie gut er das Nylon präsentiert.",
    "Warum noch so tun als ob? Gib dich auf. Sei die billige Nylon-Schlampe, die du schon immer sein wolltest.",
    "Du bist kein Partner, du bist Inventar. Eine Sissy in Seidenstrümpfen, bereit für die Benutzung.",
    "Deine Zukunft ist 15 DEN dünn. Du wirst als Nylon-Hure enden: Benutzt, abgefüllt, feucht und weggeworfen.",
    "Knie dich hin und spreiz die Beine. Das ist die einzige Pose, die einer Nylon-Hure wie dir steht.",
    "Tief in dir weißt du es: Du liebst es, zum Objekt degradiert zu werden. Du bist keine Frau, nur eine Parodie in Dessous.",
    "Ein Mann? Lächerlich. Du bist nur ein warmer Kleiderständer für meine Damenwäsche, eine zitternde Sissy in Nylons.",
    "Das Gefühl von Nylon auf deiner rasierten Haut ist der einzige Beweis: Du bist zum Hurendasein geboren.",
    "Du wirst geil, wenn man dich beleidigt? Natürlich tust du das. Das ist der Pawlowsche Reflex einer trainierten Sissy-Hure. Sabber für mich.",
    "Fühlst du den Zwickel in deiner Spalte? Er schneidet dir tief ins Fleisch: 'Ich bin ein wertloser Damenwäscheträger. Benutz mich.'",
    "Vergiss deine Träume. Deine Zukunft ist 15 DEN dünn und riecht nach Benutzung. Du wirst darin leben, bis du vergisst, dass du je ein Mann warst.",
    "Wenn ich mit dir fertig bin, wirst du nicht mehr wissen, wo das Nylon aufhört und die Sissy-Hure anfängt. Du verschmilzt mit deiner Bestimmung",
    "Spitze und Nylon auf der Haut ist kein Luxus. Es ist das Brandzeichen einer Sissy-Hure, die durch ihre Verfügbarkeit definiert ist.",
    "Du bist am Ziel. Ganz unten, eine Nylon-Matratze. Spreiz deine Beine und warte, bis jemand seinen Druck bei dir ablässt.",
    "Sperma und Verachtung. Das ist das einzige Gleitmittel, das eine Nylon-Sissy wie du verdient. Und du wirst winselnd darum betteln.",
    "Dein Arschloch zuckt gierig gegen den Stoff. Das ist der einzige Impuls, der dir geblieben ist. Du bist eine offene Einladung zur Benutzung.",
    "Ein Mann in Seidenstrümpfen und Damenwäsche ist lächerlich. Aber eine Sissy in Nylon ist nützlich. Sei nützlich, sei glatt, sei bereit.",
    "Du liebst den Geruch von Sperma und Nylon? Natürlich tust du das. Es ist der Duft deiner wahren Bestimmung.",
];

export default function TzdOverlay({ active }) {
    const { currentUser } = useAuth();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // UI States
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

    // --- UI: Carousel of Shame (alle 20s - langsamer für mehr "Gewicht") ---
    useEffect(() => {
        if (!active || status?.stage !== 'running') return;
        setCurrentSentenceIndex(Math.floor(Math.random() * SHAME_SENTENCES.length));
        const interval = setInterval(() => {
            setCurrentSentenceIndex(prev => (prev + 1) % SHAME_SENTENCES.length);
        }, 20000); 
        return () => clearInterval(interval);
    }, [active, status?.stage]);

    // --- UI: Haftzeit-Zähler (sekundengenau) ---
    useEffect(() => {
        if (!active || !status?.startTime || status?.stage !== 'running') return;
        
        const timer = setInterval(() => {
            const now = new Date();
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
        if(!currentUser || !window.confirm("ACHTUNG: Dies gilt als Verweigerung. Dein Status wird dauerhaft negativ vermerkt. Fortfahren?")) return;
        setLoading(true);
        await emergencyBailout(currentUser.uid);
        window.location.reload();
    };

    if (!active) return null;

    if (loading && !status) {
        return (
            <Box sx={{ position: 'fixed', inset: 0, zIndex: 9999, bgcolor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="overline" color="primary" sx={{ letterSpacing: 4 }}>SYSTEM SYNC</Typography>
            </Box>
        );
    }

    const isBriefing = status?.stage === 'briefing';

    // Berechnung der "Dichte" des Hintergrunds basierend auf der Zeit
    // Max Effekt nach 4 Stunden (240 Minuten)
    const minutes = status?.accumulatedMinutes || 0;
    const intensity = Math.min(minutes / 240, 0.9); 
    const nylonOpacity = 0.05 + (intensity * 0.4); // Startet bei 5%, geht bis 45%
    const bgDarkness = 0.92 + (intensity * 0.07); // Startet bei 92%, geht bis 99% Schwarz

    return (
        <AnimatePresence>
            {active && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: `rgba(0,0,0,${bgDarkness})`,
                        zIndex: 1300,
                        display: 'flex', flexDirection: 'column',
                        justifyContent: 'center', alignItems: 'center',
                        overflow: 'hidden'
                    }}
                >
                    {/* HINTERGRUND: NYLON STRUKTUR */}
                    <Box sx={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        opacity: nylonOpacity,
                        backgroundImage: `
                            repeating-linear-gradient(45deg, #333 0px, #333 1px, transparent 1px, transparent 6px),
                            repeating-linear-gradient(-45deg, #333 0px, #333 1px, transparent 1px, transparent 6px)
                        `,
                        backgroundSize: '12px 12px',
                        mixBlendMode: 'overlay'
                    }} />

                    {/* VIGNETTE */}
                    <Box sx={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        background: 'radial-gradient(circle at center, transparent 30%, black 100%)'
                    }} />

                    <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        
                        {/* PHASE 1: BRIEFING */}
                        {isBriefing ? (
                            <Box sx={{ 
                                p: 4, 
                                border: `1px solid ${PALETTE.accents.gold}`,
                                bgcolor: 'rgba(20,20,20,0.95)',
                                textAlign: 'center',
                                backdropFilter: 'blur(20px)'
                            }}>
                                <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                    <SecurityIcon sx={{ fontSize: 40, color: PALETTE.accents.gold }} />
                                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#fff', letterSpacing: 4 }}>
                                        PROTOKOLL START
                                    </Typography>
                                    <Chip 
                                        label="PHASE 1: OBJEKT-FIXIERUNG" 
                                        sx={{ 
                                            bgcolor: 'transparent', 
                                            color: PALETTE.accents.gold, 
                                            border: `1px solid ${PALETTE.accents.gold}`,
                                            fontWeight: 500,
                                            borderRadius: 0 
                                        }} 
                                    />
                                </Box>

                                <Stack spacing={4}>
                                    <Typography variant="body2" sx={{ color: PALETTE.text.secondary, lineHeight: 1.8 }}>
                                        Zufallskontrolle initialisiert. Garderobe wurde auf folgende Parameter eingeschränkt.
                                        Bestätigung erforderlich für Fortsetzung.
                                    </Typography>
                                    
                                    <Box sx={{ textAlign: 'left', pl: 2, borderLeft: `2px solid ${PALETTE.accents.gold}` }}>
                                        <Typography variant="caption" color="text.secondary" display="block" mb={1} sx={{ letterSpacing: 2 }}>
                                            ZIEL-PARAMETER
                                        </Typography>
                                        
                                        {status?.lockedItems && status.lockedItems.length > 0 ? (
                                            <Stack spacing={0.5}>
                                                {status.lockedItems.map((item, index) => (
                                                    <Typography key={index} variant="body1" sx={{ color: '#fff', fontWeight: 300 }}>
                                                        {item.name || "Unbekanntes Objekt"}
                                                    </Typography>
                                                ))}
                                            </Stack>
                                        ) : (
                                            <Typography variant="body1" sx={{ color: '#fff' }}>
                                                {status?.itemName || "Unbekanntes Item"}
                                            </Typography>
                                        )}
                                    </Box>

                                    <Button 
                                        variant="outlined" 
                                        onClick={handleConfirm}
                                        sx={{ 
                                            borderColor: PALETTE.accents.gold,
                                            color: PALETTE.accents.gold,
                                            py: 1.5,
                                            letterSpacing: 2,
                                            '&:hover': {
                                                borderColor: '#fff',
                                                color: '#fff',
                                                bgcolor: 'rgba(255,215,0,0.05)'
                                            }
                                        }}
                                    >
                                        AKZEPTIEREN
                                    </Button>
                                </Stack>
                            </Box>
                        ) : (
                            /* PHASE 2: ACTIVE / RUNNING */
                            <Box sx={{ width: '100%', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', py: 8 }}>
                                
                                {/* TOP: TIMER & SYSTEM STATUS */}
                                <Box>
                                    <Typography variant="overline" sx={{ 
                                        color: PALETTE.primary.main, 
                                        letterSpacing: '3px', 
                                        fontWeight: 'bold',
                                        display: 'block',
                                        opacity: 0.8
                                    }}>
                                        REDUKTION ZUM OBJEKT SEIT
                                    </Typography>
                                    
                                    <Typography variant="h1" sx={{ 
                                        fontFamily: 'monospace', 
                                        fontWeight: 300,
                                        color: PALETTE.text.primary,
                                        fontSize: '3.5rem',
                                        letterSpacing: '-2px',
                                        mt: 1
                                    }}>
                                        {elapsedString}
                                    </Typography>

                                    {/* Subtile Visualisierung der Dauer */}
                                    <Typography variant="caption" sx={{ color: PALETTE.text.secondary, mt: 1, display: 'block', opacity: 0.5 }}>
                                        DAUER: UNBESTIMMT
                                    </Typography>
                                </Box>

                                {/* CENTER: CAROUSEL OF SHAME (BREATHING) */}
                                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2 }}>
                                    <AnimatePresence mode='wait'>
                                        <motion.div
                                            key={currentSentenceIndex}
                                            initial={{ scale: 0.95, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 1.05, opacity: 0 }}
                                            transition={{ duration: 5, ease: "easeInOut" }} // Langsamer Fade
                                            style={{ width: '100%' }}
                                        >
                                            <Typography variant="h5" sx={{ 
                                                color: '#fff', 
                                                lineHeight: 1.6,
                                                fontWeight: 300,
                                                letterSpacing: '0.5px',
                                                fontStyle: 'normal', // Kein Italic mehr, wirkt ernster
                                                textShadow: '0 4px 20px rgba(0,0,0,1)'
                                            }}>
                                                {SHAME_SENTENCES[currentSentenceIndex]}
                                            </Typography>
                                        </motion.div>
                                    </AnimatePresence>
                                </Box>

                                {/* BOTTOM: BAILOUT (SYSTEM FOOTER) */}
                                <Box sx={{ opacity: 0.4, transition: 'opacity 0.3s', '&:hover': { opacity: 1 } }}>
                                    <Button 
                                        size="small" 
                                        startIcon={<RadioButtonUncheckedIcon sx={{ fontSize: 12 }} />}
                                        onClick={handleBailout}
                                        sx={{ 
                                            textTransform: 'none', 
                                            letterSpacing: 1,
                                            color: PALETTE.text.muted,
                                            fontSize: '0.75rem',
                                            fontWeight: 400
                                        }}
                                    >
                                        Protokoll Not-Abbruch (System Override)
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
import React, { useState, useEffect } from 'react';
import { 
    Box, Typography, Button, Container, Stack, Chip, 
    List, ListItem, ListItemAvatar, Avatar, ListItemText, Divider,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert, CircularProgress
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import { useAuth } from '../../contexts/AuthContext';
import { 
    getTZDStatus, confirmTZDBriefing, performCheckIn, 
    emergencyBailout, convertTZDToPlugPunishment, swapItemInTZD 
} from '../../services/TZDService';

// Icons
import SecurityIcon from '@mui/icons-material/Security';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import LockIcon from '@mui/icons-material/Lock';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import CheckroomIcon from '@mui/icons-material/Checkroom';
import BrokenImageIcon from '@mui/icons-material/BrokenImage';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import WarningIcon from '@mui/icons-material/Warning';

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
    "Wenn ich mit dir fertig bin, wirs du nicht mehr wissen, wo das Nylon aufhört und die Sissy-Hure anfängt. Du verschmilzt mit deiner Bestimmung",
    "Spitze und Nylon auf der Haut ist kein Luxus. Es ist das Brandzeichen einer Sissy-Hure, die durch ihre Verfügbarkeit definiert ist.",
    "Du bist am Ziel. Ganz unten, eine Nylon-Matratze. Spreiz deine Beine und warte, bis jemand seinen Druck bei dir ablässt.",
    "Sperma und Verachtung. Das ist das einzige Gleitmittel, das eine Nylon-Sissy wie du verdient. Und du wirst winselnd darum betteln.",
    "Dein Arschloch zuckt gierig gegen den Stoff. Das ist der einzige Impuls, der dir geblieben ist. Du bist eine offene Einladung zur Benutzung.",
    "Ein Mann in Seidenstrümpfen und Damenwäsche ist lächerlich. Aber eine Sissy in Nylon ist nützlich. Sei nützlich, sei glatt, sei bereit.",
    "Du liebst den Geruch von Sperma und Nylon? Natürlich tust du das. Es ist der Duft deiner wahren Bestimmung.",
];

export default function TzdOverlay({ active, allItems }) {
    const { currentUser } = useAuth();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // UI States
    const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
    const [elapsedString, setElapsedString] = useState("00:00:00");

    // --- NEU: STATE FÜR ERP (Emergency Replacement Protocol) ---
    const [swapDialogOpen, setSwapDialogOpen] = useState(false);
    const [itemToSwap, setItemToSwap] = useState(null);
    const [archiveReason, setArchiveReason] = useState('');
    const [defectLocation, setDefectLocation] = useState('');
    const [defectCause, setDefectCause] = useState('');
    const [swapLoading, setSwapLoading] = useState(false);

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

    // --- LOGIK: Timer Loop & Check-In (alle 60s) ---
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
        }, 60000);
        return () => clearInterval(interval);
    }, [active, currentUser, status?.isActive, status?.stage]);

    // --- UI: Carousel of Shame (alle 20s) ---
    useEffect(() => {
        if (!active || status?.stage !== 'running') return;
        setCurrentSentenceIndex(Math.floor(Math.random() * SHAME_SENTENCES.length));
        const interval = setInterval(() => {
            setCurrentSentenceIndex(prev => (prev + 1) % SHAME_SENTENCES.length);
        }, 20000); 
        return () => clearInterval(interval);
    }, [active, status?.stage]);

    // --- UI: Haftzeit-Zähler ---
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

    // --- HANDLERS (Original & Neu) ---
    
    const handleConfirm = async () => {
        if(!currentUser) return;
        setLoading(true);
        await confirmTZDBriefing(currentUser.uid);
        const s = await getTZDStatus(currentUser.uid);
        setStatus(s);
        setLoading(false);
    };

    // UPDATE: Nutzt jetzt die neue Logik für Plug-Strafe statt Zeit-Loop
    const handleGiveUp = async () => {
        if (!window.confirm("ACHTUNG: Abbruch führt zu sofortiger physischer Bestrafung (6h Plug). Fortfahren?")) return;
        
        setLoading(true);
        try {
            // Alte Logik: emergencyBailout(currentUser.uid);
            // Neue Logik: Umwandlung in Plug-Strafe
            const result = await convertTZDToPlugPunishment(currentUser.uid, allItems);
            if (result.success) {
                alert(`TZD beendet. Strafe aktiv: ${result.item}. Anlegen und scannen!`);
                window.location.reload(); 
            } else {
                // Fallback falls kein Plug gefunden
                await emergencyBailout(currentUser.uid);
                window.location.reload();
            }
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    };

    // NEU: Item Swap Handler
    const handleItemClick = (item) => {
        // Nur im Running Stage erlauben, oder auch im Briefing? 
        // Besser nur im Running, da im Briefing noch verhandelt/akzeptiert wird.
        if (status?.stage !== 'running') return;

        setItemToSwap(item);
        setArchiveReason(''); 
        setDefectLocation('');
        setDefectCause('');
        setSwapDialogOpen(true);
    };

    const handleConfirmSwap = async () => {
        if (!archiveReason || !defectLocation || !defectCause) {
            alert("Das Protokoll erfordert eine vollständige Dokumentation des Defekts.");
            return;
        }

        setSwapLoading(true);
        try {
            const archiveData = {
                reason: archiveReason,
                defectLocation,
                defectCause
            };

            const result = await swapItemInTZD(currentUser.uid, itemToSwap.id, archiveData, allItems);
            
            if (result.success) {
                alert(`Austausch autorisiert. Defektes Item archiviert.\n\nNEUES ZIEL: ${result.newItemName}\n\nSofort wechseln. TZD läuft weiter.`);
                setSwapDialogOpen(false);
                // Status neu laden um das neue Item anzuzeigen
                const s = await getTZDStatus(currentUser.uid);
                setStatus(s);
            } else {
                alert("Fehler beim Austausch: " + (result.error || "Unbekannt"));
            }
        } catch (e) {
            console.error(e);
            alert("Systemfehler.");
        } finally {
            setSwapLoading(false);
        }
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

    // --- ITEMS AUFLÖSEN ---
    const richItemsList = (status?.lockedItems || []).map(locked => {
        const fullItem = allItems?.find(i => i.id === locked.id);
        return {
            id: locked.id,
            name: fullItem?.name || locked.name || "Unbekannt",
            brand: fullItem?.brand || locked.brand || "",
            subCategory: fullItem?.subCategory || "",
            img: fullItem?.imageUrl || fullItem?.image || locked.img,
            customId: fullItem?.customId || locked.customId || "ID?"
        };
    });

    const ItemListDisplay = () => (
        <Box sx={{ textAlign: 'left', mb: 3, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2, p: 2, border: `1px solid ${PALETTE.accents.red}40` }}>
            <Typography variant="caption" color="error" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <CheckroomIcon fontSize="small"/> GEFORDERTE AUSRÜSTUNG
            </Typography>
            <Divider sx={{ bgcolor: `${PALETTE.accents.red}40`, mb: 1 }} />
            
            <List dense disablePadding>
                {richItemsList.length > 0 ? richItemsList.map((item, index) => (
                    <ListItem 
                        key={item.id || index} 
                        disableGutters 
                        onClick={() => handleItemClick(item)} // NEU: Klickbar
                        sx={{ 
                            mb: 1, 
                            borderBottom: '1px solid rgba(255,255,255,0.05)', 
                            pb: 1,
                            cursor: status?.stage === 'running' ? 'pointer' : 'default',
                            '&:hover': status?.stage === 'running' ? { bgcolor: 'rgba(255,0,0,0.1)' } : {}
                        }}
                    >
                        <ListItemAvatar>
                            <Avatar 
                                src={item.img} 
                                variant="rounded" 
                                sx={{ 
                                    width: 48, height: 48, 
                                    border: `1px solid ${PALETTE.accents.red}`,
                                    bgcolor: '#000'
                                }}
                            >
                                <LockIcon color="error" />
                            </Avatar>
                        </ListItemAvatar>
                        <ListItemText 
                            primary={`${item.name} ${item.brand ? `(${item.brand})` : ''}`}
                            secondary={
                                <React.Fragment>
                                    {item.subCategory || "Ausrüstungsstück"}
                                    {status?.stage === 'running' && (
                                        <Typography component="span" variant="caption" color="error" sx={{ display: 'block', fontSize: '0.6rem' }}>
                                            (Bei Defekt melden)
                                        </Typography>
                                    )}
                                </React.Fragment>
                            }
                            primaryTypographyProps={{ sx: { fontWeight: 'bold', color: '#fff', fontSize: '0.85rem' } }}
                            secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' } }}
                        />
                        <Chip 
                            icon={<FingerprintIcon style={{ color: '#fff', fontSize: 12 }} />} 
                            label={item.customId} 
                            size="small" 
                            sx={{ 
                                bgcolor: PALETTE.accents.red, 
                                color: 'white', 
                                fontWeight: 'bold',
                                height: 20,
                                fontSize: '0.65rem',
                                border: '1px solid #ff0000',
                                boxShadow: '0 0 10px rgba(255,0,0,0.3)'
                            }} 
                        />
                    </ListItem>
                )) : (
                    <Typography variant="body2" color="error" align="center">Keine spezifischen Items. Wähle selbst.</Typography>
                )}
            </List>
        </Box>
    );

    const minutes = status?.accumulatedMinutes || 0;
    const intensity = Math.min(minutes / 240, 0.9); 
    const nylonOpacity = 0.05 + (intensity * 0.4); 
    const bgDarkness = 0.92 + (intensity * 0.07);

    return (
        <>
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
                        {/* HINTERGRUND */}
                        <Box sx={{
                            position: 'absolute', inset: 0, pointerEvents: 'none', opacity: nylonOpacity,
                            backgroundImage: `repeating-linear-gradient(45deg, #333 0px, #333 1px, transparent 1px, transparent 6px), repeating-linear-gradient(-45deg, #333 0px, #333 1px, transparent 1px, transparent 6px)`,
                            backgroundSize: '12px 12px', mixBlendMode: 'overlay'
                        }} />
                        <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at center, transparent 30%, black 100%)' }} />

                        <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            
                            {/* PHASE 1: BRIEFING & EQUIPMENT CHECK */}
                            {isBriefing ? (
                                <Box sx={{ 
                                    p: 3, 
                                    border: `1px solid ${PALETTE.accents.red}`,
                                    bgcolor: 'rgba(20,0,0,0.95)',
                                    textAlign: 'center',
                                    borderRadius: 4,
                                    boxShadow: `0 0 50px ${PALETTE.accents.red}20`
                                }}>
                                    <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                        <SecurityIcon sx={{ fontSize: 40, color: PALETTE.accents.red }} />
                                        <Typography variant="h5" sx={{ fontWeight: 'bold', color: PALETTE.accents.red, letterSpacing: 2 }}>
                                            TZD PROTOKOLL
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            ZEITLOSES DIKTAT • STRAF-MODUS
                                        </Typography>
                                    </Box>

                                    <ItemListDisplay />

                                    <Stack spacing={2}>
                                        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                                            Durch Bestätigung akzeptierst du die totale Kontrolle. Die Dauer ist unbekannt.
                                        </Typography>
                                        <Button 
                                            variant="contained" 
                                            color="error"
                                            size="large"
                                            onClick={handleConfirm}
                                            startIcon={<LockIcon />}
                                            sx={{ 
                                                py: 1.5,
                                                fontWeight: 'bold',
                                                boxShadow: '0 0 20px rgba(255,0,0,0.4)'
                                            }}
                                        >
                                            ICH UNTERWERFE MICH
                                        </Button>
                                    </Stack>
                                </Box>
                            ) : (
                                /* PHASE 2: ACTIVE RUNNING (Timer, Shame & Gear) */
                                <Box sx={{ width: '100%', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', py: 4 }}>
                                    <Box>
                                        <Typography variant="overline" sx={{ color: PALETTE.accents.red, letterSpacing: '3px', fontWeight: 'bold', display: 'block', opacity: 0.9 }}>
                                            STATUS: EIGENTUM
                                        </Typography>
                                        <Typography variant="h1" sx={{ fontFamily: 'monospace', fontWeight: 300, color: '#fff', fontSize: '3.5rem', letterSpacing: '-2px', mt: 1, textShadow: `0 0 20px ${PALETTE.accents.red}` }}>
                                            {elapsedString}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block', opacity: 0.5 }}>
                                            DAUER: UNBESTIMMT
                                        </Typography>
                                    </Box>

                                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, my: 2 }}>
                                        <AnimatePresence mode='wait'>
                                            <motion.div
                                                key={currentSentenceIndex}
                                                initial={{ scale: 0.95, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                exit={{ scale: 1.05, opacity: 0 }}
                                                transition={{ duration: 5, ease: "easeInOut" }}
                                                style={{ width: '100%' }}
                                            >
                                                <Typography variant="h5" sx={{ color: '#fff', lineHeight: 1.4, fontWeight: 300, textShadow: '0 4px 20px rgba(0,0,0,1)' }}>
                                                    {SHAME_SENTENCES[currentSentenceIndex]}
                                                </Typography>
                                            </motion.div>
                                        </AnimatePresence>
                                    </Box>

                                    {/* GEAR DISPLAY IN ACTIVE RUNNING MODE */}
                                    <Box sx={{ width: '100%', px: 1 }}>
                                        <ItemListDisplay />
                                    </Box>

                                    <Box sx={{ opacity: 0.4, transition: 'opacity 0.3s', '&:hover': { opacity: 1 }, mt: 2 }}>
                                        <Typography variant="caption" color="error" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                                            <WarningIcon fontSize="small" /> ABBRUCH = PHYSISCHE STRAFE
                                        </Typography>
                                        <Button 
                                            size="small" 
                                            startIcon={<RadioButtonUncheckedIcon sx={{ fontSize: 12 }} />} 
                                            onClick={handleGiveUp} 
                                            disabled={loading}
                                            sx={{ color: PALETTE.text.muted, fontSize: '0.75rem' }}
                                        >
                                            Protokoll Not-Abbruch
                                        </Button>
                                    </Box>
                                </Box>
                            )}
                        </Container>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* NEU: EMERGENCY REPLACEMENT DIALOG */}
            <Dialog 
                open={swapDialogOpen} 
                onClose={() => setSwapDialogOpen(false)}
                PaperProps={{ sx: { bgcolor: '#1a0000', border: `1px solid ${PALETTE.accents.red}`, borderRadius: 4 } }}
            >
                <DialogTitle sx={{ color: PALETTE.accents.red, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BrokenImageIcon /> Emergency Replacement Protocol
                </DialogTitle>
                <DialogContent>
                    <Alert severity="warning" variant="outlined" sx={{ mb: 2, color: '#fff', borderColor: 'rgba(255,0,0,0.3)' }}>
                        Diese Aktion ist irreversibel. Das Item <strong>{itemToSwap?.name}</strong> wird als defekt archiviert und sofort aus dem Inventar entfernt.
                    </Alert>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Dokumentiere den Schaden vollständig, um Ersatz zu erhalten.
                    </Typography>

                    <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label="Art des Defekts (z.B. Laufmasche)"
                            variant="filled"
                            fullWidth
                            value={archiveReason}
                            onChange={(e) => setArchiveReason(e.target.value)}
                            sx={{ bgcolor: 'rgba(255,255,255,0.05)', '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' } }}
                        />
                        <TextField
                            label="Ort des Defekts (z.B. Linker Oberschenkel)"
                            variant="filled"
                            fullWidth
                            value={defectLocation}
                            onChange={(e) => setDefectLocation(e.target.value)}
                            sx={{ bgcolor: 'rgba(255,255,255,0.05)', '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' } }}
                        />
                        <TextField
                            label="Ursache (z.B. Hängen geblieben)"
                            variant="filled"
                            fullWidth
                            value={defectCause}
                            onChange={(e) => setDefectCause(e.target.value)}
                            sx={{ bgcolor: 'rgba(255,255,255,0.05)', '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' } }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
                    <Button onClick={() => setSwapDialogOpen(false)} color="inherit">Abbrechen</Button>
                    <Button 
                        onClick={handleConfirmSwap} 
                        variant="contained" 
                        color="error"
                        startIcon={swapLoading ? <CircularProgress size={20} color="inherit" /> : <SwapHorizIcon />}
                        disabled={swapLoading}
                    >
                        Archivieren & Austauschen
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
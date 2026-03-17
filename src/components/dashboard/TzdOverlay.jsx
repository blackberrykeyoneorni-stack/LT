import React, { useState, useEffect } from 'react';
import { 
    Box, Typography, Button, Container, Stack, Chip, 
    List, ListItem, ListItemAvatar, Avatar, ListItemText, Divider,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert, CircularProgress
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { PALETTE } from '../../theme/obsidianDesign';
import useTZDController from '../../hooks/dashboard/useTZDController';
import { grantTZDAmnesty } from '../../services/TZDService';

// Icons
import SecurityIcon from '@mui/icons-material/Security';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import LockIcon from '@mui/icons-material/Lock';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import CheckroomIcon from '@mui/icons-material/Checkroom';
import BrokenImageIcon from '@mui/icons-material/BrokenImage';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import WarningIcon from '@mui/icons-material/Warning';

export default function TzdOverlay({ active, allItems, timeBankData, currentUser }) {
    
    const [forceHide, setForceHide] = useState(false);
    const [amnestyLoading, setAmnestyLoading] = useState(false);

    // KORREKTUR: Overlay resettet seine Amnestie-Ausblendung bei Neuaufruf
    useEffect(() => {
        if (active) {
            setForceHide(false);
        }
    }, [active]);

    // Die komplette Business-Logik und State-Verwaltung wird in den Controller ausgelagert
    const {
        status,
        loading,
        elapsedString,
        currentSentence,
        currentSentenceIndex,
        swapDialogOpen,
        setSwapDialogOpen,
        itemToSwap,
        archiveReason,
        setArchiveReason,
        defectLocation,
        setDefectLocation,
        defectCause,
        setDefectCause,
        swapLoading,
        handleConfirm,
        handleGiveUp,
        handleItemClick,
        handleConfirmSwap
    } = useTZDController(active, allItems);

    const handleBuyAmnesty = async () => {
        if (!currentUser) return;
        setAmnestyLoading(true);
        const success = await grantTZDAmnesty(currentUser.uid);
        if (success) {
            setForceHide(true); // Blendet Overlay lokal sofort aus, bevor der Firebase 5-Minuten-Ticker greift
        }
        setAmnestyLoading(false);
    };

    if (!active || forceHide) return null;

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
                        onClick={() => handleItemClick(item)} 
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
                                        <Typography 
                                            variant="caption" 
                                            sx={{ 
                                                color: status?.isPenalty ? PALETTE.accents.red : 'text.secondary',
                                                fontWeight: status?.isPenalty ? 'bold' : 'normal',
                                                letterSpacing: 1
                                            }}
                                        >
                                            {status?.protocolType === 'evasion_penalty' 
                                                ? "ZEITLOSES DIKTAT • STRAF-MODUS (FLUCHT/UMGEHUNG)" 
                                                : status?.protocolType === 'spiel_tzd' 
                                                    ? "ZEITLOSES DIKTAT • STRAF-MODUS (VERLORENES SPIEL)" 
                                                    : status?.isPenalty 
                                                        ? "ZEITLOSES DIKTAT • STRAF-MODUS" 
                                                        : "ZUFALLS-DIKTAT • REGULÄRES PROTOKOLL"}
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
                                        
                                        {/* KORREKTUR: AMNESTIE KAUFEN (Nur bei Zufalls-TZD) */}
                                        {!status?.isPenalty && (
                                            <Box sx={{ mt: 3, pt: 3, borderTop: `1px dashed ${PALETTE.accents.gold}80`, width: '100%' }}>
                                                <Typography variant="caption" sx={{ color: PALETTE.accents.gold, display: 'block', mb: 1, fontWeight: 'bold', letterSpacing: 1 }}>
                                                    FLUCHTWEG (24H AMNESTIE)
                                                </Typography>
                                                <Button 
                                                    variant="outlined" 
                                                    fullWidth
                                                    disabled={amnestyLoading || !timeBankData || timeBankData.nc < 500 || timeBankData.lc < 500}
                                                    onClick={handleBuyAmnesty}
                                                    sx={{ 
                                                        py: 1.5,
                                                        color: PALETTE.accents.gold, 
                                                        borderColor: PALETTE.accents.gold,
                                                        fontWeight: 'bold',
                                                        '&:hover': { bgcolor: 'rgba(255,215,0,0.1)', borderColor: PALETTE.accents.gold }
                                                    }}
                                                >
                                                    {amnestyLoading ? <CircularProgress size={24} color="inherit" /> : "AMNESTIE ERKAUFEN (500 NC & 500 LC)"}
                                                </Button>
                                                {(!timeBankData || timeBankData.nc < 500 || timeBankData.lc < 500) && (
                                                    <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1, fontSize: '0.7rem' }}>
                                                        Ungenügendes Guthaben (NC: {timeBankData?.nc || 0}, LC: {timeBankData?.lc || 0})
                                                    </Typography>
                                                )}
                                            </Box>
                                        )}
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
                                                    {currentSentence}
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

            {/* EMERGENCY REPLACEMENT DIALOG */}
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
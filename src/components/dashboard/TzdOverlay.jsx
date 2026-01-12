import React, { useState, useEffect } from 'react';
import { 
    Box, Typography, Button, CircularProgress, 
    Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
    Backdrop
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LockIcon from '@mui/icons-material/Lock';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import { doc, getDoc } from 'firebase/firestore'; 
import { db } from '../../firebase';
import { performCheckIn, confirmTZDBriefing, terminateTZD } from '../../services/TZDService';
import { useAuth } from '../../contexts/AuthContext';
import { registerRelease } from '../../services/ReleaseService'; // KORREKTUR: Einheitlicher Import
import { PALETTE } from '../../theme/obsidianDesign';

export default function TzdOverlay({ active, onRefresh }) { 
    const { currentUser } = useAuth();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showReleaseDialog, setShowReleaseDialog] = useState(false);
    const [timeDisplay, setTimeDisplay] = useState({ hours: 0, minutes: 0, seconds: 0 });
    const [itemDetails, setItemDetails] = useState(null);

    // Initial Status Load
    useEffect(() => {
        if (!currentUser || !active) return;
        
        const loadStatus = async () => {
            try {
                const docRef = doc(db, `users/${currentUser.uid}/status/tzd`);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setStatus(docSnap.data());
                }
            } catch (e) {
                console.error("TZD Load Error", e);
            }
        };
        loadStatus();
        
        const interval = setInterval(loadStatus, 5000);
        return () => clearInterval(interval);
    }, [currentUser, active]);

    // ID nachladen
    useEffect(() => {
        if (status?.itemId && !itemDetails && currentUser) {
            getDoc(doc(db, `users/${currentUser.uid}/items`, status.itemId))
                .then(snap => { if (snap.exists()) setItemDetails(snap.data()); });
        }
    }, [status?.itemId, currentUser, itemDetails]);

    // Timer Logic
    useEffect(() => {
        if (!status || !status.isActive || status.stage === 'briefing') return;
        
        const updateTimer = () => {
            const now = new Date();
            const start = status.startTime?.toDate ? status.startTime.toDate() : (status.startTime ? new Date(status.startTime) : new Date());
            
            const diff = Math.floor((now - start) / 1000);
            if (diff >= 0) {
                setTimeDisplay({ 
                    hours: Math.floor(diff / 3600), 
                    minutes: Math.floor((diff % 3600) / 60),
                    seconds: diff % 60
                });
            }
        };
        
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [status]);

    const handleAction = async (fn, ...args) => {
        setLoading(true);
        try { 
            await fn(currentUser.uid, ...args); 
            const docRef = doc(db, `users/${currentUser.uid}/status/tzd`);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) setStatus(docSnap.data());
            if (onRefresh) onRefresh(); 
        } catch (e) { 
            alert(e.message); 
        } finally { 
            setLoading(false); 
        }
    };

    // Wenn nicht aktiv, rendern wir gar nichts
    if (!active || !status || !status.isActive) return null;

    // --- Z-INDEX FIX: CONTAINER FÜR OVERLAY ---
    // Wir nutzen Box statt Backdrop als Wrapper, um mehr Kontrolle über das Stacking zu haben.
    const overlayStyle = {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        bgcolor: '#000000',
        zIndex: 9998, // Sehr hoch, aber unter dem Dialog (normalerweise 1300, aber Dialog bekommt boost)
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: '#fff'
    };

    // SCENE 1: BRIEFING
    if (status.stage === 'briefing') {
        return (
             <Box sx={overlayStyle}>
                <Box sx={{ maxWidth: 400, width: '100%', p: 4, textAlign: 'center' }}>
                    <WarningAmberIcon sx={{ fontSize: 60, color: PALETTE.accents.red, mb: 2 }} />
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: PALETTE.accents.red, mb: 1, letterSpacing: 2 }}>PROTOKOLL</Typography>
                    <Typography variant="body1" sx={{ color: '#fff', mb: 4 }}>
                        Kontrolle übernommen für:<br/>
                        <span style={{ fontSize: '1.5em', fontWeight: 'bold', display:'block', marginTop:'10px' }}>{status.itemName}</span>
                        {itemDetails?.customId && <span style={{ color: '#666', fontSize:'0.8em' }}>ID: #{itemDetails.customId}</span>}
                    </Typography>
                    <Button variant="outlined" color="error" size="large" fullWidth onClick={() => handleAction(confirmTZDBriefing)}>
                        {loading ? <CircularProgress size={24} color="error"/> : "AKZEPTIEREN"}
                    </Button>
                </Box>
             </Box>
        );
    }

    // SCENE 2: MAIN OVERLAY - "THE VOID"
    return (
        <>
            <Box sx={overlayStyle}>
                
                {/* 1. HEADER */}
                <Box sx={{ position: 'absolute', top: '15%', textAlign: 'center' }}>
                    <LockIcon sx={{ fontSize: 40, color: '#333', mb: 2 }} />
                    <Typography variant="overline" sx={{ letterSpacing: 6, color: '#444', display: 'block' }}>LOCKED</Typography>
                    <Typography variant="h5" sx={{ color: '#fff', fontWeight: 300, mt: 1 }}>{status.itemName}</Typography>
                    {itemDetails?.customId && (
                        <Typography variant="caption" sx={{ color: PALETTE.primary.main, letterSpacing: 1, mt: 0.5, display: 'block' }}>
                            ID-TAG: {itemDetails.customId}
                        </Typography>
                    )}
                </Box>

                {/* 2. TIMER */}
                <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h1" sx={{ 
                        fontFamily: '"Playfair Display", serif', 
                        fontSize: '5rem', // Etwas kleiner für Mobile Safety
                        color: '#e0e0e0', 
                        fontWeight: 400,
                        lineHeight: 1
                    }}>
                        {String(timeDisplay.hours).padStart(2,'0')}:{String(timeDisplay.minutes).padStart(2,'0')}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#333', letterSpacing: 4, mt: 1, display: 'block' }}>ELAPSED TIME</Typography>
                </Box>

                {/* 3. ACTIONS */}
                <Box sx={{ position: 'absolute', bottom: '10%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <Button 
                        variant="outlined" 
                        onClick={() => handleAction(performCheckIn)}
                        disabled={loading}
                        startIcon={<FingerprintIcon />}
                        sx={{ 
                            color: '#fff', borderColor: 'rgba(255,255,255,0.2)', px: 5, py: 1.5, borderRadius: 0,
                            '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.05)' }
                        }}
                    >
                        PRÄSENZ BESTÄTIGEN
                    </Button>

                    <Button 
                        color="error" size="small" 
                        onClick={() => setShowReleaseDialog(true)}
                        sx={{ opacity: 0.5, fontSize: '0.7rem' }}
                    >
                        NOTFALL / FEHLALARM BEENDEN
                    </Button>
                </Box>
            </Box>

            {/* RELEASE DIALOG - AUSSERHALB DER BOX RENDERN */}
            <Dialog 
                open={showReleaseDialog} 
                onClose={() => setShowReleaseDialog(false)} 
                sx={{ zIndex: 9999 }} // WICHTIG: Höher als das Overlay (9998)
                PaperProps={{ sx: { bgcolor: '#111', border: '1px solid #333', borderRadius: 0 } }}
            >
                <DialogTitle sx={{ color: PALETTE.accents.red }}>ABBRUCH / RESET</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ color: '#aaa' }}>
                        Nutzen Sie dies bei technischen Fehlern (z.B. falsche Zeit) oder echten Notfällen.
                        Dies beendet die aktuelle TZD-Sitzung sofort.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowReleaseDialog(false)} color="inherit">Zurück</Button>
                    <Button 
                        onClick={() => handleAction(async (uid) => { 
                            // Wir nutzen registerRelease (generic) statt registerReleaseSuccess
                            await registerRelease('tzd_force_end', 1); 
                            await terminateTZD(uid, false); // False = Failed/Aborted
                            setShowReleaseDialog(false);
                            window.location.reload();
                        })} 
                        color="error"
                        variant="contained"
                    >
                        BEENDEN (FORCE)
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

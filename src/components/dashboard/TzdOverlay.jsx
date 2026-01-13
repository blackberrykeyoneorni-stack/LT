import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LockIcon from '@mui/icons-material/Lock';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import { doc, getDoc } from 'firebase/firestore'; 
import { db } from '../../firebase';
import { performCheckIn, confirmTZDBriefing, terminateTZD } from '../../services/TZDService';
import { useAuth } from '../../contexts/AuthContext';
import { registerRelease } from '../../services/ReleaseService';
import { PALETTE, DESIGN_TOKENS } from '../../theme/obsidianDesign';

export default function TzdOverlay({ active, onRefresh }) { 
    const { currentUser } = useAuth();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showReleaseDialog, setShowReleaseDialog] = useState(false);
    const [timeDisplay, setTimeDisplay] = useState({ hours: 0, minutes: 0, seconds: 0 });
    const [itemDetails, setItemDetails] = useState(null);

    useEffect(() => {
        if (!currentUser || !active) return;
        const loadStatus = async () => {
            try {
                const docRef = doc(db, `users/${currentUser.uid}/status/tzd`);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) setStatus(docSnap.data());
            } catch (e) { console.error("TZD Error", e); }
        };
        loadStatus();
        const interval = setInterval(loadStatus, 5000);
        return () => clearInterval(interval);
    }, [currentUser, active]);

    useEffect(() => {
        if (status?.itemId && !itemDetails && currentUser) {
            getDoc(doc(db, `users/${currentUser.uid}/items`, status.itemId)).then(snap => { if (snap.exists()) setItemDetails(snap.data()); });
        }
    }, [status?.itemId, currentUser, itemDetails]);

    useEffect(() => {
        if (!status || !status.isActive || status.stage === 'briefing') return;
        const updateTimer = () => {
            const now = new Date();
            const start = status.startTime?.toDate ? status.startTime.toDate() : (status.startTime ? new Date(status.startTime) : new Date());
            const diff = Math.floor((now - start) / 1000);
            if (diff >= 0) setTimeDisplay({ hours: Math.floor(diff / 3600), minutes: Math.floor((diff % 3600) / 60), seconds: diff % 60 });
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
        } catch (e) { alert(e.message); } finally { setLoading(false); }
    };

    if (!active || !status || !status.isActive) return null;

    const overlayStyle = {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        bgcolor: PALETTE.background.default, // Deep Black
        zIndex: 9998,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff'
    };

    if (status.stage === 'briefing') {
        return (
             <Box sx={overlayStyle}>
                <Box sx={{ maxWidth: 400, width: '100%', p: 4, textAlign: 'center' }}>
                    <WarningAmberIcon sx={{ fontSize: 60, color: PALETTE.accents.red, mb: 2 }} />
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: PALETTE.accents.red, mb: 1, letterSpacing: 2 }}>PROTOKOLL</Typography>
                    <Typography variant="body1" sx={{ color: '#fff', mb: 4 }}>
                        Kontrolle übernommen für:<br/><span style={{ fontSize: '1.5em', fontWeight: 'bold', display:'block', marginTop:'10px' }}>{status.itemName}</span>
                    </Typography>
                    <Button variant="outlined" color="error" size="large" fullWidth onClick={() => handleAction(confirmTZDBriefing)}>
                        {loading ? <CircularProgress size={24} color="error"/> : "AKZEPTIEREN"}
                    </Button>
                </Box>
             </Box>
        );
    }

    return (
        <>
            <Box sx={overlayStyle}>
                <Box sx={{ position: 'absolute', top: '15%', textAlign: 'center' }}>
                    <LockIcon sx={{ fontSize: 40, color: '#333', mb: 2 }} />
                    <Typography variant="overline" sx={{ letterSpacing: 6, color: '#444', display: 'block' }}>LOCKED</Typography>
                    <Typography variant="h5" sx={{ color: '#fff', fontWeight: 300, mt: 1 }}>{status.itemName}</Typography>
                    {itemDetails?.customId && <Typography variant="caption" sx={{ color: PALETTE.primary.main, letterSpacing: 1, mt: 0.5, display: 'block' }}>ID: {itemDetails.customId}</Typography>}
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h1" sx={{ fontFamily: '"Playfair Display", serif', fontSize: '5rem', color: '#e0e0e0', fontWeight: 400, lineHeight: 1 }}>
                        {String(timeDisplay.hours).padStart(2,'0')}:{String(timeDisplay.minutes).padStart(2,'0')}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#333', letterSpacing: 4, mt: 1, display: 'block' }}>ELAPSED TIME</Typography>
                </Box>
                <Box sx={{ position: 'absolute', bottom: '10%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <Button variant="outlined" onClick={() => handleAction(performCheckIn)} disabled={loading} startIcon={<FingerprintIcon />} sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)', px: 5, py: 1.5, borderRadius: 0, '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.05)' } }}>
                        PRÄSENZ BESTÄTIGEN
                    </Button>
                    <Button color="error" size="small" onClick={() => setShowReleaseDialog(true)} sx={{ opacity: 0.5, fontSize: '0.7rem' }}>NOTFALL / FEHLALARM BEENDEN</Button>
                </Box>
            </Box>
            <Dialog open={showReleaseDialog} onClose={() => setShowReleaseDialog(false)} sx={{ zIndex: 9999 }} PaperProps={DESIGN_TOKENS.dialog.paper}>
                <DialogTitle sx={DESIGN_TOKENS.dialog.title.sx}>ABBRUCH / RESET</DialogTitle>
                <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}><DialogContentText>Notfall-Abbruch.</DialogContentText></DialogContent>
                <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
                    <Button onClick={() => setShowReleaseDialog(false)} color="inherit">Zurück</Button>
                    <Button onClick={() => handleAction(async (uid) => { await registerRelease('tzd_force_end', 1); await terminateTZD(uid, false); setShowReleaseDialog(false); window.location.reload(); })} color="error" variant="contained">BEENDEN (FORCE)</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
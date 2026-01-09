import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Backdrop, CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LockIcon from '@mui/icons-material/Lock';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import { doc, getDoc } from 'firebase/firestore'; 
import { db } from '../../firebase';
import { performCheckIn, confirmTZDBriefing, terminateTZD } from '../../services/TZDService';
import { useAuth } from '../../contexts/AuthContext';
import { registerReleaseSuccess } from '../../services/ReleaseService';
import { PALETTE } from '../../theme/obsidianDesign';

export default function TzdOverlay({ status, onRefresh, onClose }) {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [showReleaseDialog, setShowReleaseDialog] = useState(false);
    const [timeDisplay, setTimeDisplay] = useState({ hours: 0, minutes: 0 });
    const [itemDetails, setItemDetails] = useState(null);

    // ID nachladen für Präzision
    useEffect(() => {
        if (status?.itemId && !itemDetails) {
            getDoc(doc(db, `users/${currentUser.uid}/items`, status.itemId))
                .then(snap => { if (snap.exists()) setItemDetails(snap.data()); });
        }
    }, [status?.itemId, currentUser]);

    // Timer
    useEffect(() => {
        if (!status || !status.isActive || status.stage === 'briefing') return;
        const updateTimer = () => {
            const now = new Date();
            const start = status.startDate.toDate ? status.startDate.toDate() : new Date(status.startDate);
            const diff = Math.floor((now - start) / 1000);
            setTimeDisplay({ hours: Math.floor(diff / 3600), minutes: Math.floor((diff % 3600) / 60) });
        };
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [status]);

    const handleAction = async (fn, ...args) => {
        setLoading(true);
        try { await fn(currentUser.uid, ...args); onRefresh(); } catch (e) { alert(e.message); } finally { setLoading(false); }
    };

    if (!status || !status.isActive) return null;

    // BRIEFING
    if (status.stage === 'briefing') {
        return (
             <Backdrop open={true} sx={{ zIndex: 9999, color: '#fff', bgcolor: '#000' }}>
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
             </Backdrop>
        );
    }

    // MAIN OVERLAY - "THE VOID" DESIGN
    return (
        <Backdrop open={true} sx={{ zIndex: 9998, bgcolor: '#000000', flexDirection: 'column' }}>
            
            {/* 1. HEADER: CLEAN & DOMINANT */}
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

            {/* 2. TIMER: MASSIVE SERIF */}
            <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h1" sx={{ 
                    fontFamily: '"Playfair Display", serif', 
                    fontSize: '6rem', 
                    color: '#e0e0e0', 
                    fontWeight: 400,
                    lineHeight: 1
                }}>
                    {String(timeDisplay.hours).padStart(2,'0')}:{String(timeDisplay.minutes).padStart(2,'0')}
                </Typography>
                <Typography variant="caption" sx={{ color: '#333', letterSpacing: 4, mt: 1, display: 'block' }}>ELAPSED TIME</Typography>
            </Box>

            {/* 3. ACTIONS: MINIMAL */}
            <Box sx={{ position: 'absolute', bottom: '15%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
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
                    sx={{ opacity: 0.4, fontSize: '0.7rem' }}
                >
                    NOTFALL / FEHLALARM BEENDEN
                </Button>
            </Box>

            {/* RELEASE DIALOG (Auch Dark) */}
            <Dialog open={showReleaseDialog} onClose={() => setShowReleaseDialog(false)} PaperProps={{ sx: { bgcolor: '#111', border: '1px solid #333', borderRadius: 0 } }}>
                <DialogTitle sx={{ color: PALETTE.accents.red }}>ABBRUCH</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ color: '#aaa' }}>
                        Falls dies ein Fehlalarm ist (Bug) oder ein Notfall, können Sie hier beenden.
                        Im Ernstfall gilt: Abbruch erfordert Entladung.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowReleaseDialog(false)} color="inherit">Zurück</Button>
                    <Button 
                        onClick={() => handleAction(async (uid) => { 
                            await registerReleaseSuccess(uid, 'tzd', true); 
                            await terminateTZD(uid); 
                            setShowReleaseDialog(false);
                            if (onClose) onClose(); // HIER: ERZWINGT SCHLIEßUNG
                        })} 
                        color="error"
                    >
                        BEENDEN (FORCE)
                    </Button>
                </DialogActions>
            </Dialog>

        </Backdrop>
    );
}

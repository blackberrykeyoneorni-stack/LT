import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Snackbar, Alert, Box, CircularProgress, Typography } from '@mui/material';
import { nfcService, isNfcSupported } from '../services/NFCService';
import { resolveTagAction } from '../services/NFCRouter';
import { useAuth } from './AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const NFCContext = createContext();

export const useNFCGlobal = () => useContext(NFCContext);

export const NFCProvider = ({ children }) => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // UI States
    const [isScanning, setIsScanning] = useState(false);
    const [scanMode, setScanMode] = useState('GLOBAL'); // 'GLOBAL' oder 'BIND' (Verknüpfen)
    const [bindCallback, setBindCallback] = useState(null);
    const [feedback, setFeedback] = useState({ open: false, msg: '', severity: 'info' });

    // --- SCAN LOGIK ---
    const handleTagFound = useCallback(async (tagObj) => {
        const tagId = tagObj.id;

        // FALL A: BINDING (Wir warten auf den Tag, um ihn zu speichern)
        if (scanMode === 'BIND' && bindCallback) {
            bindCallback(tagId); 
            setFeedback({ open: true, msg: 'Tag erfolgreich erfasst.', severity: 'success' });
            stopScan(); 
            return;
        }

        // FALL B: GLOBAL (Suche)
        if (scanMode === 'GLOBAL') {
            setFeedback({ open: true, msg: 'Analysiere...', severity: 'info' });
            
            try {
                const itemsRef = collection(db, `users/${currentUser.uid}/items`);

                // 1. PRIO CHECK: Ist es ein Item via nfcTagId? (Hardware ID)
                const q1 = query(itemsRef, where('nfcTagId', '==', tagId));
                const snap1 = await getDocs(q1);

                if (!snap1.empty) {
                    const itemDoc = snap1.docs[0];
                    navigate(`/item/${itemDoc.id}`, { state: { nfcAction: 'start_session' } });
                    setFeedback({ open: true, msg: 'Item gefunden (Tag).', severity: 'success' });
                    return;
                }

                // 2. PRIO CHECK: Ist es ein Item via customId? (Manuelle ID)
                // Dies behebt den logischen Bruch: Item gewinnt immer vor Lagerort.
                const q2 = query(itemsRef, where('customId', '==', tagId));
                const snap2 = await getDocs(q2);

                if (!snap2.empty) {
                    const itemDoc = snap2.docs[0];
                    navigate(`/item/${itemDoc.id}`, { state: { nfcAction: 'start_session' } });
                    setFeedback({ open: true, msg: 'Item gefunden (ID).', severity: 'success' });
                    return;
                }

                // 3. FALLBACK: Router Logic (Checkt Lagerorte & Sonstiges)
                const action = await resolveTagAction(currentUser.uid, tagId);

                if (action.type === 'NAVIGATE_ITEM') {
                    // Fallback, falls resolveTagAction doch noch ein Item findet
                    navigate(action.target, { state: { nfcAction: 'start_session' } });
                    setFeedback({ open: true, msg: action.message, severity: 'success' });
                } 
                else if (action.type === 'FILTER_INVENTORY') {
                    // Lagerort gefunden -> Filter Inventar
                    navigate(action.target, { state: { filterLocation: action.payload.location } });
                    setFeedback({ open: true, msg: action.message, severity: 'success' });
                }
                else {
                    setFeedback({ open: true, msg: `Tag nicht erkannt: ${tagId}`, severity: 'warning' });
                }
            } catch (e) {
                console.error("NFC Error:", e);
                setFeedback({ open: true, msg: 'Fehler beim Verarbeiten des Tags.', severity: 'error' });
            }
        }
    }, [scanMode, bindCallback, currentUser, navigate]);

    // --- ACTIONS ---

    const startGlobalScan = () => {
        setScanMode('GLOBAL');
        setBindCallback(null);
        activateReader();
    };

    const startBindingScan = (callback) => {
        setScanMode('BIND');
        setBindCallback(() => callback);
        activateReader();
    };

    const activateReader = async () => {
        try {
            setIsScanning(true);
            await nfcService.startScan(
                handleTagFound, 
                (err) => setFeedback({ open: true, msg: err.message, severity: 'error' })
            );
        } catch (e) {
            setIsScanning(false);
            setFeedback({ open: true, msg: 'NFC konnte nicht gestartet werden.', severity: 'error' });
        }
    };

    const stopScan = () => {
        nfcService.stopScan();
        setIsScanning(false);
        setScanMode('GLOBAL');
        setBindCallback(null);
    };

    const writeTag = async (text) => {
        try {
            await nfcService.writeTag(text);
            setFeedback({ open: true, msg: 'Tag beschrieben!', severity: 'success' });
            return true;
        } catch (e) {
            setFeedback({ open: true, msg: 'Schreibfehler: ' + e.message, severity: 'error' });
            return false;
        }
    };

    useEffect(() => {
        // Optional: stopScan bei Unmount/Wechsel
    }, [location]);

    return (
        <NFCContext.Provider value={{ isScanning, isSupported: isNfcSupported(), startGlobalScan, startBindingScan, stopScan, writeTag }}>
            {children}
            
            {isScanning && (
                <Box sx={{
                    position: 'fixed', bottom: 90, right: 20, zIndex: 9999,
                    bgcolor: 'rgba(0,0,0,0.85)', borderRadius: 4, px: 3, py: 1.5,
                    display: 'flex', alignItems: 'center', gap: 2,
                    border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)'
                }}>
                    <CircularProgress size={24} color="secondary" />
                    <Box>
                        <Typography variant="body2" sx={{ color: 'white', fontWeight: 'bold' }}>
                            {scanMode === 'BIND' ? 'Scannen...' : 'NFC Suche läuft...'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                            Tag an die Rückseite halten
                        </Typography>
                    </Box>
                </Box>
            )}

            <Snackbar 
                open={feedback.open} autoHideDuration={3000} 
                onClose={() => setFeedback(prev => ({...prev, open: false}))}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert severity={feedback.severity} variant="filled" sx={{ width: '100%' }}>
                    {feedback.msg}
                </Alert>
            </Snackbar>
        </NFCContext.Provider>
    );
};

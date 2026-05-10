import React, { useEffect, useState, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Box, Paper, BottomNavigation, BottomNavigationAction, Snackbar, Alert, Typography, Button } from '@mui/material';
import { DESIGN_TOKENS, PALETTE } from '../theme/obsidianDesign';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { penalizeTZDAppOpen } from '../services/TZDService';
import { checkAndTriggerExtortion, acceptExtortion, processExtortionPenalty } from '../services/SessionService';
import { useConditioningGuard } from '../hooks/useConditioningGuard';
import ConditioningOverlay from './conditioning/ConditioningOverlay';

// Icons
import DashboardIcon from '@mui/icons-material/Dashboard';
import CheckroomIcon from '@mui/icons-material/Checkroom';
import EqualizerIcon from '@mui/icons-material/Equalizer';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SettingsIcon from '@mui/icons-material/Settings';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  
  // Der Gatekeeper, der dich zu Beginn jeder Schicht zwingt, dich zu unterwerfen
  const { showOverlay, loadingGuard, acknowledgePhase } = useConditioningGuard();

  // --- PERFIDITÄT: TZD PENALTY LOGIC ---
  const [penaltyOpen, setPenaltyOpen] = useState(false);
  const lastPenaltyTime = useRef(0);

  // --- ERPRESSUNGS-PROTOKOLL STATE ---
  const [extortionData, setExtortionData] = useState(null);
  const [extortionTimeLeft, setExtortionTimeLeft] = useState(0);

  // Firebase Listener für Erpressungs-Status (Anti-Escape Architektur)
  useEffect(() => {
    if (!currentUser) return;
    const extRef = doc(db, `users/${currentUser.uid}/status/extortion`);
    const unsubscribe = onSnapshot(extRef, (snap) => {
        if (snap.exists() && snap.data().isActive) {
            const data = snap.data();
            const expires = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
            const remaining = Math.round((expires.getTime() - Date.now()) / 1000);
            
            if (remaining <= 0) {
                // Strafe greift sofort bei Neuladen der App, wenn Timer abgelaufen ist
                processExtortionPenalty(currentUser.uid);
            } else {
                setExtortionData(data);
                setExtortionTimeLeft(remaining);
            }
        } else {
            setExtortionData(null);
        }
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Lokaler Timer für UI-Updates und Exekution
  useEffect(() => {
    let timer;
    if (extortionData && extortionTimeLeft > 0) {
        timer = setInterval(() => {
            setExtortionTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    processExtortionPenalty(currentUser.uid);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }
    return () => clearInterval(timer);
  }, [extortionData, extortionTimeLeft, currentUser]);

  // --- ZENTRALER SYSTEM-TRIGGER (Neu) ---
  const executeSystemTriggers = async () => {
    if (!currentUser) return;
    const now = Date.now();
    
    // Drosselung: Nur alle 60 Sekunden prüfen, um TZD-Spam zu vermeiden
    if (now - lastPenaltyTime.current > 60000) {
        const punished = await penalizeTZDAppOpen(currentUser.uid);
        if (punished) {
            lastPenaltyTime.current = now;
            setPenaltyOpen(true);
        }
    }

    // Erpressungs-Protokoll feuern (Backend prüft selbständig Bedingungen und %-Chance)
    checkAndTriggerExtortion(currentUser.uid);
  };

  // 1. Hook für Visibility-Änderungen (Background -> Foreground)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        executeSystemTriggers();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [currentUser]);

  // 2. Hook für Tab-Wechsel und initialen Ladevorgang
  useEffect(() => {
    if (document.visibilityState === 'visible') {
        executeSystemTriggers();
    }
  }, [location.pathname, currentUser]);

  const handleClosePenalty = () => {
      setPenaltyOpen(false);
  };

  // Mapping Route -> Value
  const getNavValue = (path) => {
    if (path.startsWith('/inventory') || path.startsWith('/item')) return 1;
    if (path.startsWith('/stats')) return 2;
    if (path.startsWith('/calendar')) return 3;
    if (path.startsWith('/settings')) return 4;
    return 0; // Dashboard
  };

  const navValue = getNavValue(location.pathname);

  // Blackout-Screen, während der Server prüft, ob du schon geschworen hast.
  if (loadingGuard) {
      return <Box sx={{ width: '100vw', height: '100vh', bgcolor: '#000' }} />;
  }

  return (
    // ZENTRALISIERTER HINTERGRUND
    <Box sx={DESIGN_TOKENS.bottomNavSpacer}>
      
      {/* THE OBEDIENCE GATEKEEPER */}
      {showOverlay && <ConditioningOverlay onAcknowledge={acknowledgePhase} />}

      {/* ERPRESSUNGS-PROTOKOLL OVERLAY (ABSOLUTER ZWANG) */}
      {extortionData && (
          <Box sx={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              bgcolor: 'rgba(0,0,0,0.95)', zIndex: 999999, // Überlagert alles
              display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3
          }}>
              <Paper sx={{ p: 4, textAlign: 'center', border: `2px solid ${PALETTE.accents.red}`, bgcolor: '#111', maxWidth: 400 }}>
                  <Typography variant="h4" color="error" fontWeight="bold" gutterBottom>
                      ULTIMATUM
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 3 }}>
                      Verlängere deine aktuelle Session <b>sofort um 60 Minuten</b>.<br/><br/>
                      Wenn du ablehnst, den Browser schließt oder die Zeit abläuft, werden <b>180 NC und 180 LC</b> unwiderruflich annulliert.
                  </Typography>
                  <Typography variant="h2" fontWeight="bold" color="error" sx={{ mb: 4 }}>
                      00:{extortionTimeLeft.toString().padStart(2, '0')}
                  </Typography>
                  <Button 
                      variant="contained" 
                      color="error" 
                      fullWidth 
                      size="large"
                      onClick={() => acceptExtortion(currentUser.uid)}
                      sx={{ py: 2, fontSize: '1.2rem', fontWeight: 'bold' }}
                  >
                      AKZEPTIEREN
                  </Button>
              </Paper>
          </Box>
      )}

      {/* TZD PENALTY FEEDBACK */}
      <Snackbar 
          open={penaltyOpen} 
          autoHideDuration={6000} 
          onClose={handleClosePenalty}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
          <Alert 
            onClose={handleClosePenalty} 
            severity="error" 
            variant="filled" 
            sx={{ width: '100%', fontWeight: 'bold' }}
          >
              Diktat erkannt. +15 Minuten hinzugefügt.
          </Alert>
      </Snackbar>

      {/* CONTENT AREA */}
      <Box sx={{ p: 2, pb: 10 }}>
         <Outlet />
      </Box>

      {/* BOTTOM NAVIGATION - FIXED */}
      <Paper 
        sx={{ 
          position: 'fixed', 
          bottom: 0, left: 0, right: 0, 
          zIndex: 1000,
          background: 'rgba(10, 10, 10, 0.85)', // Fast blickdicht für Nav
          backdropFilter: 'blur(20px)',
          borderTop: `1px solid ${PALETTE.background.glassBorder}`
        }} 
        elevation={0}
      >
        <BottomNavigation
          showLabels
          value={navValue}
          onChange={(event, newValue) => {
            switch(newValue) {
              case 0: navigate('/'); break;
              case 1: navigate('/inventory'); break;
              case 2: navigate('/stats'); break;
              case 3: navigate('/calendar'); break;
              case 4: navigate('/settings'); break;
              default: break;
            }
          }}
          sx={{ bgcolor: 'transparent', height: 70 }}
        >
          <BottomNavigationAction label="Fem-Status" icon={<DashboardIcon />} sx={{ '&.Mui-selected': { color: PALETTE.primary.main } }} />
          <BottomNavigationAction label="Fem-Essentials" icon={<CheckroomIcon />} sx={{ '&.Mui-selected': { color: PALETTE.primary.main } }} />
          <BottomNavigationAction label="Fem-Analysen" icon={<EqualizerIcon />} sx={{ '&.Mui-selected': { color: PALETTE.primary.main } }} />
          <BottomNavigationAction label="Fem-Chronik" icon={<CalendarMonthIcon />} sx={{ '&.Mui-selected': { color: PALETTE.primary.main } }} />
          <BottomNavigationAction label="Konfiguration" icon={<SettingsIcon />} sx={{ '&.Mui-selected': { color: PALETTE.primary.main } }} />
        </BottomNavigation>
      </Paper>
    </Box>
  );
}

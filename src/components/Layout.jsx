import React, { useEffect, useState, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Box, Paper, BottomNavigation, BottomNavigationAction, Snackbar, Alert } from '@mui/material';
import { DESIGN_TOKENS, PALETTE } from '../theme/obsidianDesign'; // NEU
import { useAuth } from '../contexts/AuthContext';
import { penalizeTZDAppOpen } from '../services/TZDService';

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

  // --- PERFIDITÄT: TZD PENALTY LOGIC ---
  const [penaltyOpen, setPenaltyOpen] = useState(false);
  const lastPenaltyTime = useRef(0);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      // Wenn die App sichtbar wird (User öffnet sie oder wechselt zurück)
      if (document.visibilityState === 'visible' && currentUser) {
        const now = Date.now();
        
        // Drosselung: Nur alle 60 Sekunden prüfen, um System-Trigger zu vermeiden
        if (now - lastPenaltyTime.current > 60000) {
            const punished = await penalizeTZDAppOpen(currentUser.uid);
            
            if (punished) {
                // Wenn bestraft wurde: Zeit merken und Warnung zeigen
                lastPenaltyTime.current = now;
                setPenaltyOpen(true);
            }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentUser]);

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

  return (
    // ZENTRALISIERTER HINTERGRUND
    <Box sx={DESIGN_TOKENS.bottomNavSpacer}>
      
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
          <BottomNavigationAction label="Home" icon={<DashboardIcon />} sx={{ '&.Mui-selected': { color: PALETTE.primary.main } }} />
          <BottomNavigationAction label="Items" icon={<CheckroomIcon />} sx={{ '&.Mui-selected': { color: PALETTE.accents.purple } }} />
          <BottomNavigationAction label="Stats" icon={<EqualizerIcon />} sx={{ '&.Mui-selected': { color: PALETTE.accents.green } }} />
          <BottomNavigationAction label="Kalender" icon={<CalendarMonthIcon />} sx={{ '&.Mui-selected': { color: PALETTE.accents.gold } }} />
          <BottomNavigationAction label="Optionen" icon={<SettingsIcon />} sx={{ '&.Mui-selected': { color: PALETTE.text.secondary } }} />
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
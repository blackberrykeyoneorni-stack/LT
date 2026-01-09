import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Box, Paper, BottomNavigation, BottomNavigationAction, useTheme } from '@mui/material';
// --- NEW SYSTEM IMPORTS ---
import { Icons } from '../theme/appIcons';
import { PALETTE } from '../theme/obsidianDesign';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();

  // NAV-FIX: Robustes Mapping statt String-Vergleich
  // UPDATE: Budget Route hinzugefügt (Mapped auf Statistik/Management)
  const getValue = () => {
    const p = location.pathname;
    if (p === '/') return 0;
    if (p.startsWith('/inventory') || p.startsWith('/item') || p.startsWith('/add') || p.startsWith('/wishlist')) return 1;
    if (p.startsWith('/stats')) return 2;
    if (p.startsWith('/budget')) return 2; // FIX: Budget gehört zum Bereich Statistik/Management
    if (p.startsWith('/calendar')) return 3;
    if (p.startsWith('/settings')) return 4;
    return 0;
  };

  return (
    <Box sx={{ pb: 7, minHeight: '100vh', bgcolor: 'background.default' }}>
      
      {/* CONTENT AREA */}
      <Box component="main" sx={{ p: 2, pb: 10 }}>
        {children}
      </Box>

      {/* BOTTOM NAVIGATION (GLASS STYLE) */}
      <Paper 
        sx={{ 
          position: 'fixed', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          zIndex: theme.zIndex.appBar,
          background: 'rgba(10, 10, 10, 0.85)',
          backdropFilter: 'blur(12px)',
          borderTop: `1px solid ${PALETTE.background.glassBorder}`,
          borderRadius: '20px 20px 0 0'
        }} 
        elevation={0}
      >
        <BottomNavigation
          showLabels
          value={getValue()}
          onChange={(event, newValue) => {
            switch (newValue) {
              case 0: navigate('/'); break;
              case 1: navigate('/inventory'); break;
              case 2: navigate('/stats'); break;
              case 3: navigate('/calendar'); break;
              case 4: navigate('/settings'); break;
              default: navigate('/');
            }
          }}
          sx={{ 
            bgcolor: 'transparent', 
            height: 70,
            '& .MuiBottomNavigationAction-root': {
                color: 'text.secondary',
                '&.Mui-selected': {
                    color: PALETTE.primary.main,
                }
            }
          }}
        >
          <BottomNavigationAction label="Dash" icon={<Icons.Home sx={{ mb: 0.5 }} />} />
          <BottomNavigationAction label="Inventar" icon={<Icons.Inventory sx={{ mb: 0.5 }} />} />
          <BottomNavigationAction label="Statistik" icon={<Icons.Speed sx={{ mb: 0.5 }} />} />
          <BottomNavigationAction label="Kalender" icon={<Icons.Calendar sx={{ mb: 0.5 }} />} />
          <BottomNavigationAction label="Setup" icon={<Icons.Settings sx={{ mb: 0.5 }} />} />
        </BottomNavigation>
      </Paper>
    </Box>
  );
}

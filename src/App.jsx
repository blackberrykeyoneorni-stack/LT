import React, { useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SecurityProvider } from './contexts/SecurityContext';
import { ItemProvider } from './contexts/ItemContext';
import { NFCProvider } from './contexts/NFCContext';
import { ThemeProvider, CssBaseline, CircularProgress, Box } from '@mui/material';
import { getObsidianTheme } from './theme/obsidianDesign';

// Pages
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Inventory from './pages/Inventory';
import ItemDetail from './pages/ItemDetail';
import Settings from './pages/Settings';
import Wishlist from './pages/Wishlist';
import StatsPage from './pages/Stats';
import CalendarPage from './pages/Calendar';
import Budget from './pages/Budget'; // NEU: Budget Modul

// Components
import Layout from './components/Layout';
import SecurityLock from './components/SecurityLock';

function AppContent() {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'background.default' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  // 1. Wenn NICHT eingeloggt -> Zeige Login
  if (!currentUser) {
    return <Login />;
  }

  // 2. Wenn eingeloggt -> Starte die App mit Daten & Sicherheit
  return (
    <SecurityLock>
      <ItemProvider> 
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            {/* Route /add wurde entfernt, da AddItem jetzt ein BottomSheet im Inventory ist */}
            <Route path="/item/:id" element={<ItemDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            
            {/* NEUE ROUTE FÜR BUDGET */}
            <Route path="/budget" element={<Budget />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </ItemProvider>
    </SecurityLock>
  );
}

export default function App() {
  const theme = useMemo(() => getObsidianTheme(), []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <SecurityProvider>
            <NFCProvider>
               <AppContent />
            </NFCProvider>
          </SecurityProvider>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

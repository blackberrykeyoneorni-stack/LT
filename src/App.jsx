import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Box, CircularProgress, Container, Avatar, Typography, Button } from '@mui/material';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { materialTheme } from './theme/materialTheme';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ItemProvider } from './contexts/ItemContext';
import { SecurityProvider } from './contexts/SecurityContext';
import { NFCGlobalProvider } from './contexts/NFCContext';

// COMPONENTS
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import SecurityLock from './components/SecurityLock';

// Ein steriles, unauffälliges System-Theme für den Camouflage-Vorraum
const camouflageTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#607D8B' }, // Neutrales Blau-Grau
    background: { default: '#F3F4F6', paper: '#FFFFFF' },
    text: { primary: '#333333', secondary: '#666666' }
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
  }
});

// ZWANGS-UPDATE KOMPONENTE (Konzept 3)
function UpdateBlocker() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  // Zeige nichts an, solange kein Update bereitsteht
  if (!needRefresh) return null;

  // Sobald needRefresh true ist (Download fertig), sperre den kompletten Bildschirm
  return (
    <ThemeProvider theme={camouflageTheme}>
      <Box sx={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        bgcolor: 'background.default', zIndex: 999999, // Überlagert alles, auch den LockScreen
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        touchAction: 'none'
      }}>
        <Container maxWidth="xs" sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Box sx={{ position: 'relative', mb: 4, display: 'flex', justifyContent: 'center' }}>
            <Avatar sx={{ width: 80, height: 80, bgcolor: '#E5E7EB', color: '#607D8B' }}>
              <SystemUpdateAltIcon sx={{ fontSize: 40 }} />
            </Avatar>
          </Box>
          <Typography variant="h5" gutterBottom sx={{ color: 'text.primary', fontWeight: 500, letterSpacing: 0.5 }}>
            LT System Data
          </Typography>
          <Typography variant="body2" sx={{ mb: 6, color: 'text.secondary' }}>
            Systemupdate erforderlich. Bitte bestätigen, um fortzufahren.
          </Typography>
          <Button
            variant="contained" size="large" color="primary"
            onClick={() => updateServiceWorker(true)}
            sx={{ width: '100%', py: 1.5, mb: 3, fontSize: '1rem', borderRadius: 1, textTransform: 'none', boxShadow: 'none' }}
          >
            Update ausführen
          </Button>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

// --- HELPER FÜR STABILE LAZY LOADS ---
// Fängt "Failed to fetch dynamically imported module" ab und erzwingt Reload
const lazyRetry = (importFn) => {
  return lazy(async () => {
    try {
      const component = await importFn();
      sessionStorage.removeItem('pwa-chunk-retry');
      return component;
    } catch (error) {
      // Prüfen, ob es sich um den Versions-Fehler handelt
      if (error.message && (error.message.includes('dynamically imported module') || error.message.includes('Importing a module script failed'))) {
        const retries = parseInt(sessionStorage.getItem('pwa-chunk-retry') || '0', 10);
        
        if (retries < 2) {
          sessionStorage.setItem('pwa-chunk-retry', String(retries + 1));
          // Seite neu laden, um die neue Version (neue Chunks) vom Server zu holen
          window.location.reload();
          // Promise nicht auflösen, um React-Rendering während des Reloads zu blockieren
          return new Promise(() => {});
        }
      }
      // Andere Fehler weiterwerfen, damit ErrorBoundary sie fängt (und Endlosschleife verhindert wird)
      throw error;
    }
  });
};

// LAZY LOADING PAGES
// Verwendung von lazyRetry statt lazy pur
const Login = lazyRetry(() => import('./pages/Login'));
const Dashboard = lazyRetry(() => import('./pages/Dashboard'));
const Inventory = lazyRetry(() => import('./pages/Inventory'));
const ItemDetail = lazyRetry(() => import('./pages/ItemDetail'));
const Stats = lazyRetry(() => import('./pages/Stats'));
const Settings = lazyRetry(() => import('./pages/Settings'));
const CalendarPage = lazyRetry(() => import('./pages/Calendar'));
const Wishlist = lazyRetry(() => import('./pages/Wishlist'));
const Budget = lazyRetry(() => import('./pages/Budget'));

// Loading Screen für Suspense Fallback
const PageLoader = () => (
  <Box sx={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    bgcolor: 'background.default' 
  }}>
    <CircularProgress color="primary" />
  </Box>
);

function PrivateRoute({ children }) {
  const { currentUser, loading } = useAuth();
  
  if (loading) return null; 
  if (!currentUser) return <Navigate to="/login" />;

  return (
    <SecurityLock>
      {children}
    </SecurityLock>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <UpdateBlocker />
      <ThemeProvider theme={materialTheme}>
        <CssBaseline />
        <Router>
          <AuthProvider>
            <SecurityProvider>
              <NFCGlobalProvider>
                <ItemProvider>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/login" element={<Login />} />
                      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
                        <Route index element={<Dashboard />} />
                        <Route path="inventory" element={<Inventory />} />
                        <Route path="item/:id" element={<ItemDetail />} />
                        <Route path="stats" element={<Stats />} />
                        <Route path="calendar" element={<CalendarPage />} />
                        <Route path="wishlist" element={<Wishlist />} />
                        <Route path="budget" element={<Budget />} />
                        <Route path="settings" element={<Settings />} />
                      </Route>
                      <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                  </Suspense>
                </ItemProvider>
              </NFCGlobalProvider>
            </SecurityProvider>
          </AuthProvider>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
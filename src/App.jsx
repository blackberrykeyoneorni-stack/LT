import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box, CircularProgress } from '@mui/material';
import { materialTheme } from './theme/materialTheme';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ItemProvider } from './contexts/ItemContext';
import { SecurityProvider } from './contexts/SecurityContext';
import { NFCGlobalProvider } from './contexts/NFCContext';

// COMPONENTS
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import SecurityLock from './components/SecurityLock';

// --- HELPER FÜR STABILE LAZY LOADS ---
// Fängt "Failed to fetch dynamically imported module" ab und erzwingt Reload
const lazyRetry = (importFn) => {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (error) {
      // Prüfen, ob es sich um den Versions-Fehler handelt
      if (error.message && (error.message.includes('dynamically imported module') || error.message.includes('Importing a module script failed'))) {
        // Seite neu laden, um die neue Version (neue Chunks) vom Server zu holen
        window.location.reload();
      }
      // Andere Fehler weiterwerfen, damit ErrorBoundary sie fängt
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
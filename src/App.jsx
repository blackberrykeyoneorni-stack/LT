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

// LAZY LOADING PAGES
// Performance-Optimierung: Seiten werden nur geladen, wenn sie benötigt werden.
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Inventory = lazy(() => import('./pages/Inventory'));
const ItemDetail = lazy(() => import('./pages/ItemDetail'));
const Stats = lazy(() => import('./pages/Stats'));
const Settings = lazy(() => import('./pages/Settings'));
const CalendarPage = lazy(() => import('./pages/Calendar'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const Budget = lazy(() => import('./pages/Budget'));

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
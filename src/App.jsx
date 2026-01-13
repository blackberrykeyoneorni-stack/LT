import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { materialTheme } from './theme/materialTheme'; // Neues Theme

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ItemProvider } from './contexts/ItemContext';
import { SecurityProvider, useSecurity } from './contexts/SecurityContext';
import { NFCGlobalProvider } from './contexts/NFCContext';

// COMPONENTS & PAGES
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import ItemDetail from './pages/ItemDetail';
import Stats from './pages/Stats';
import Settings from './pages/Settings';
import CalendarPage from './pages/Calendar';
import Wishlist from './pages/Wishlist';
import Budget from './pages/Budget';
import ErrorBoundary from './components/ErrorBoundary';
import SecurityLock from './components/SecurityLock';

function PrivateRoute({ children }) {
  const { currentUser, loading } = useAuth();
  const { isLocked, isAuthenticated } = useSecurity();

  if (loading) return null; 
  if (!currentUser) return <Navigate to="/login" />;
  if (isLocked && !isAuthenticated) return <SecurityLock />;

  return children;
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
                </ItemProvider>
              </NFCGlobalProvider>
            </SecurityProvider>
          </AuthProvider>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, GlobalStyles } from '@mui/material';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ItemProvider } from './contexts/ItemContext';
import { SecurityProvider, useSecurity } from './contexts/SecurityContext';
import { NFCGlobalProvider } from './contexts/NFCContext';
import { PALETTE } from './theme/obsidianDesign'; // ZENTRALE QUELLE

// COMPONENTS
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

// --- THEME GENERIERUNG AUS OBSIDIAN DESIGN ---
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: PALETTE.primary,
    secondary: PALETTE.secondary,
    background: {
      default: PALETTE.background.default,
      paper: PALETTE.background.paper,
    },
    text: PALETTE.text,
    error: { main: PALETTE.accents.red },
    warning: { main: PALETTE.accents.gold },
    info: { main: PALETTE.accents.blue },
    success: { main: PALETTE.accents.green },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 800, letterSpacing: '-0.02em' },
    h6: { fontWeight: 600, letterSpacing: '0.01em' },
    button: { fontWeight: 600, textTransform: 'none' },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: PALETTE.background.default,
          scrollbarWidth: 'none', 
          '&::-webkit-scrollbar': { display: 'none' },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        }
      }
    }
  },
});

// PRIVATE ROUTE WRAPPER
function PrivateRoute({ children }) {
  const { currentUser, loading } = useAuth();
  const { isLocked, isAuthenticated } = useSecurity();

  if (loading) return null; 
  
  if (!currentUser) return <Navigate to="/login" />;
  
  // Wenn App gesperrt ist (Biometrie/Time), zeige LockScreen
  if (isLocked && !isAuthenticated) {
     return <SecurityLock />;
  }

  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Router>
          {/* REIHENFOLGE KORRIGIERT: Auth muss VOR Security kommen */}
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
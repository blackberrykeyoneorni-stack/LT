import React from 'react';
import { Navigate } from 'react-router-dom';
import { Container, Typography, Button, Box } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { DESIGN_TOKENS } from '../theme/obsidianDesign';

export default function Login() {
  const { login, currentUser } = useAuth();

  // Wenn User schon eingeloggt ist, direkt zum Dashboard
  if (currentUser) return <Navigate to="/" />;

  return (
    <Container maxWidth="sm" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', textAlign: 'center' }}>
      
      <Box sx={{ mb: 6 }}>
        <Typography variant="h2" component="h1" gutterBottom sx={{ ...DESIGN_TOKENS.textGradient, mb: 2 }}>
            LaceTracker
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" sx={{ letterSpacing: '0.05em' }}>
            ARCHIVE YOUR PASSION
        </Typography>
      </Box>

      <Button 
        variant="contained" 
        onClick={login}
        size="large"
        sx={{ 
          ...DESIGN_TOKENS.buttonGradient,
          py: 2, px: 6, fontSize: '1.1rem',
          boxShadow: '0 0 20px rgba(230, 194, 191, 0.3)',
          '&:hover': { 
              boxShadow: '0 0 30px rgba(230, 194, 191, 0.5), inset 0 0 20px rgba(230, 194, 191, 0.05)' 
          }
        }}
      >
        Eintreten
      </Button>
    </Container>
  );
}

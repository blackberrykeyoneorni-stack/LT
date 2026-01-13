import React from 'react';
import { Navigate } from 'react-router-dom';
import { Container, Typography, Button, Box } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { DESIGN_TOKENS, PALETTE } from '../theme/obsidianDesign';

export default function Login() {
  const { login, currentUser } = useAuth();

  if (currentUser) return <Navigate to="/" />;

  return (
    <Box sx={{ ...DESIGN_TOKENS.bottomNavSpacer, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
        
        <Box sx={{ mb: 8 }}>
            <Typography variant="h2" component="h1" gutterBottom sx={{ ...DESIGN_TOKENS.textGradient, mb: 2, fontSize: '3.5rem' }}>
                LaceTracker
            </Typography>
            <Typography variant="subtitle1" sx={{ color: PALETTE.text.secondary, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                Archive Your Passion
            </Typography>
        </Box>

        <Button 
            variant="contained" 
            onClick={login}
            size="large"
            sx={{ 
            ...DESIGN_TOKENS.buttonGradient,
            py: 2, px: 8, fontSize: '1.2rem',
            borderRadius: '50px'
            }}
        >
            Eintreten
        </Button>
        </Container>
    </Box>
  );
}
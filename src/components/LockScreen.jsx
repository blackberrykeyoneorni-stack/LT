import React from 'react';
import { Box, Typography, Button, Container, Paper } from '@mui/material';
import { useSecurity } from '../contexts/SecurityContext';
import { useAuth } from '../contexts/AuthContext'; // NEU: Für Fallback

// --- NEW SYSTEM IMPORTS ---
import { DESIGN_TOKENS, PALETTE } from '../theme/obsidianDesign';
import { Icons } from '../theme/appIcons';

export default function LockScreen() {
  const { unlock, forceUnlock } = useSecurity();
  const { login } = useAuth(); // Nutzen wir für Re-Auth

  const handleFallback = async () => {
    try {
      // Erzwingt Google Login als Sicherheitsnachweis
      await login(); 
      // Wenn erfolgreich (kein Error), entsperren wir
      forceUnlock();
    } catch (e) {
      console.error("Fallback fehlgeschlagen", e);
    }
  };

  return (
    <Box sx={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      bgcolor: '#050505', 
      backgroundImage: 'linear-gradient(to bottom, #050505, #121212)',
      zIndex: 9999, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      touchAction: 'none'
    }}>
      <Container maxWidth="xs" sx={{ textAlign: 'center' }}>
        <Box sx={{ 
          position: 'relative', 
          display: 'inline-flex', 
          p: 4, 
          borderRadius: '50%',
          ...DESIGN_TOKENS.glassCard,
          border: `1px solid ${PALETTE.primary.main}33`,
          mb: 4
        }}>
           <Icons.Lock sx={{ fontSize: 60, color: PALETTE.primary.main }} />
        </Box>
        
        <Typography variant="h4" gutterBottom sx={DESIGN_TOKENS.textGradient}>
          LACE TRACKER
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 8, opacity: 0.6 }}>
          Sicherer Bereich
        </Typography>

        <Button 
          variant="contained" 
          size="large" 
          startIcon={<Icons.Fingerprint />} 
          onClick={unlock}
          sx={{ 
            ...DESIGN_TOKENS.buttonGradient,
            py: 2, 
            px: 6, 
            borderRadius: 50, 
            fontSize: '1.1rem',
            mb: 2
          }}
        >
          Entsperren
        </Button>
        
        <Box>
          <Button 
            variant="text" 
            size="small" 
            color="secondary"
            onClick={handleFallback}
            sx={{ opacity: 0.5, fontSize: '0.75rem' }}
          >
            Biometrie defekt? Login nutzen
          </Button>
        </Box>
      </Container>
    </Box>
  );
}

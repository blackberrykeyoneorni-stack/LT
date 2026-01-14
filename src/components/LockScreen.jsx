import React from 'react';
import { Box, Typography, Button, Container, Avatar } from '@mui/material';
import { useSecurity } from '../contexts/SecurityContext';
import { useAuth } from '../contexts/AuthContext';

// Design Imports
import { DESIGN_TOKENS, PALETTE } from '../theme/obsidianDesign';
import { Icons } from '../theme/appIcons';

export default function LockScreen() {
  const { unlock, forceUnlock, authError } = useSecurity();
  const { login } = useAuth(); 

  // Fallback: Wenn Biometrie kaputt ist, kann man sich über Google neu einloggen
  const handleFallback = async () => {
    try {
      await login(); 
      forceUnlock(); // Wenn Login erfolgreich, sperre auf
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
      bgcolor: PALETTE.background.default, // Deep Dark Background
      zIndex: 99999, // Muss über allem liegen
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      touchAction: 'none' // Verhindert Scrollen
    }}>
      <Container maxWidth="xs" sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        {/* Icon Circle mit Glow */}
        <Box sx={{ 
          position: 'relative', 
          mb: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
           <Avatar sx={{ 
               width: 80, 
               height: 80, 
               bgcolor: 'rgba(76, 221, 174, 0.1)', // Primary Transparent
               color: PALETTE.primary.main 
           }}>
               <Icons.Lock sx={{ fontSize: 40 }} />
           </Avatar>
        </Box>
        
        <Typography variant="h4" gutterBottom sx={{ color: PALETTE.text.primary, fontWeight: 400, letterSpacing: 1 }}>
          GESPERRT
        </Typography>
        
        <Typography variant="body1" sx={{ mb: 6, color: PALETTE.text.secondary }}>
          Authentifizierung erforderlich
        </Typography>

        {/* Fehlermeldung falls vorhanden */}
        {authError && (
            <Typography variant="caption" color="error" sx={{ mb: 2, display: 'block' }}>
                {authError}
            </Typography>
        )}

        {/* Haupt-Button: Startet Biometrie/PIN Dialog vom System */}
        <Button 
          variant="contained" 
          size="large" 
          startIcon={<Icons.Fingerprint />} 
          onClick={unlock}
          sx={{ 
            ...DESIGN_TOKENS.buttonGradient, // Pill Shape
            width: '100%',
            py: 1.5,
            mb: 3,
            fontSize: '1rem'
          }}
        >
          Gerät entsperren
        </Button>
        
        <Typography variant="caption" sx={{ color: PALETTE.text.muted, mb: 1 }}>
            Nutzt Fingerabdruck, FaceID oder Geräte-PIN
        </Typography>

        {/* Notfall Login */}
        <Button 
          variant="text" 
          size="small" 
          onClick={handleFallback}
          sx={{ color: PALETTE.text.secondary, mt: 4 }}
        >
          Probleme? Mit Google Account öffnen
        </Button>

      </Container>
    </Box>
  );
}
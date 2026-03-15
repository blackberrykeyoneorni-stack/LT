import React from 'react';
import { Box, Typography, Button, Container, Avatar } from '@mui/material';
import { useSecurity } from '../contexts/SecurityContext';
import { useAuth } from '../contexts/AuthContext';
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
      bgcolor: 'background.default', // Bezieht sich auf das sterile Camouflage-Theme
      zIndex: 99999, // Muss über allem liegen
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      touchAction: 'none' // Verhindert Scrollen
    }}>
      <Container maxWidth="xs" sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        {/* Langweiliges System-Icon statt aufreizendem Glow-Effekt */}
        <Box sx={{ 
          position: 'relative', 
          mb: 4, 
          display: 'flex', 
          justifyContent: 'center' 
        }}>
          <Avatar sx={{ 
            width: 80, 
            height: 80, 
            bgcolor: '#E5E7EB', // Steriles helles Grau
            color: '#607D8B'    // Neutrales System-Blau-Grau
          }}>
            <Icons.Lock sx={{ fontSize: 40 }} />
          </Avatar>
        </Box>
        
        <Typography variant="h5" gutterBottom sx={{ color: 'text.primary', fontWeight: 500, letterSpacing: 0.5 }}>
          LT System Data
        </Typography>
        
        <Typography variant="body2" sx={{ mb: 6, color: 'text.secondary' }}>
          Authentifizierung erforderlich
        </Typography>

        {/* Fehlermeldung falls vorhanden */}
        {authError && (
            <Typography variant="caption" color="error" sx={{ mb: 2, display: 'block' }}>
                {authError}
            </Typography>
        )}

        {/* Haupt-Button: Steril und technisch */}
        <Button 
          variant="contained" 
          size="large" 
          color="primary"
          startIcon={<Icons.Fingerprint />} 
          onClick={unlock}
          sx={{ 
            width: '100%',
            py: 1.5,
            mb: 3,
            fontSize: '1rem',
            borderRadius: 1, 
            textTransform: 'none', 
            boxShadow: 'none'
          }}
        >
          Systemzugriff freigeben
        </Button>
        
        <Typography variant="caption" sx={{ color: 'text.disabled', mb: 1 }}>
            Biometrische Verifizierung oder System-PIN
        </Typography>

        {/* Notfall Login */}
        <Button 
          variant="text" 
          size="small" 
          onClick={handleFallback}
          sx={{ color: 'text.secondary', mt: 4, textTransform: 'none' }}
        >
          Admin-Fallback: Google Login
        </Button>
        
      </Container>
    </Box>
  );
}
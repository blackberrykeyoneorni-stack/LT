import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';
import { DESIGN_TOKENS, PALETTE } from '../theme/obsidianDesign'; // NEU

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("PWA CRASH:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ 
            p: 3, 
            height: '100vh', 
            bgcolor: PALETTE.background.default, // Zentralisiert
            color: PALETTE.text.primary, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center' 
        }}>
          <BugReportIcon sx={{ fontSize: 60, mb: 2, color: PALETTE.accents.red }} />
          
          <Typography variant="h5" sx={{ color: PALETTE.accents.red, mb: 1 }}>
              Kritischer Systemfehler
          </Typography>
          
          <Typography variant="body1" align="center" sx={{ mb: 2, color: PALETTE.text.secondary }}>
            Die App ist abgestürzt. Bitte mache einen Screenshot hiervon:
          </Typography>
          
          <Paper sx={{ 
              p: 2, 
              bgcolor: 'rgba(0,0,0,0.5)', 
              border: `1px solid ${PALETTE.accents.red}40`, 
              maxWidth: '100%', 
              overflow: 'auto', 
              mb: 3,
              borderRadius: '12px'
          }}>
            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: PALETTE.accents.gold }}>
              {this.state.error && this.state.error.toString()}
            </Typography>
          </Paper>
          
          <Button 
            variant="contained" 
            onClick={() => window.location.reload()}
            sx={DESIGN_TOKENS.buttonGradient} // Zentralisiert
          >
            App Neustarten
          </Button>
        </Box>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';

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
        <Box sx={{ p: 3, height: '100vh', bgcolor: '#121212', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <BugReportIcon color="error" sx={{ fontSize: 60, mb: 2 }} />
          <Typography variant="h5" color="error" gutterBottom>Kritischer Systemfehler</Typography>
          <Typography variant="body1" align="center" sx={{ mb: 2 }}>
            Die App ist abgestürzt. Bitte mache einen Screenshot hiervon:
          </Typography>
          <Paper sx={{ p: 2, bgcolor: '#000', border: '1px solid #333', maxWidth: '100%', overflow: 'auto', mb: 3 }}>
            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#ffb74d' }}>
              {this.state.error && this.state.error.toString()}
            </Typography>
          </Paper>
          <Button variant="contained" color="primary" onClick={() => window.location.reload()}>
            App Neustarten
          </Button>
        </Box>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;

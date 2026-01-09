import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Falls du eine globale CSS hast, sonst weglassen

// Eine Notfall-Komponente, die Fehler anzeigt
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, backgroundColor: '#1a1a1a', color: '#ff5555', height: '100vh', overflow: 'auto', fontFamily: 'monospace' }}>
          <h2 style={{ borderBottom: '1px solid #555', paddingBottom: 10 }}>💥 SYSTEMABSTURZ</h2>
          
          <h3 style={{ color: '#fff' }}>Fehler:</h3>
          <div style={{ backgroundColor: '#000', padding: 10, borderRadius: 5, marginBottom: 20 }}>
            {this.state.error && this.state.error.toString()}
          </div>

          <h3 style={{ color: '#fff' }}>Ort:</h3>
          <pre style={{ fontSize: '11px', whiteSpace: 'pre-wrap', color: '#aaa' }}>
             {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>

          <button 
            onClick={() => { localStorage.clear(); window.location.reload(); }} 
            style={{ 
              padding: '15px 30px', 
              marginTop: 20, 
              backgroundColor: '#ff5555', 
              color: 'white', 
              border: 'none', 
              borderRadius: 5,
              fontSize: '16px',
              width: '100%'
            }}>
            CACHE LÖSCHEN & NEUSTART
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

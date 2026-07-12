import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Rete di sicurezza: se qualcosa va storto durante il funzionamento
// dell'app, mostra un messaggio leggibile invece di uno schermo bianco
// senza spiegazioni — è esattamente quello che è mancato l'ultima volta.
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', background: '#0B0A08', color: '#F7F2E7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'sans-serif', textAlign: 'center' }}>
          <div style={{ maxWidth: 340 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Qualcosa si è rotto</div>
            <div style={{ fontSize: 12.5, opacity: 0.75, lineHeight: 1.5, wordBreak: 'break-word' }}>{String(this.state.error.message || this.state.error)}</div>
            <div style={{ fontSize: 11, opacity: 0.5, marginTop: 14 }}>Manda questo messaggio in chat — dice esattamente cosa non va.</div>
          </div>
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

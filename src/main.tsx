import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { webClient, webDataUtils } from './api/webClient';

// Initialize web client if not in Electron
if (!window.electron) {
  console.log('🌐 Running in Web Mode - Initializing Web Client');
  // @ts-ignore
  window.db = webClient;
  // @ts-ignore
  window.dataUtils = webDataUtils;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);

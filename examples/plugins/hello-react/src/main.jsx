import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

function handleBridge(e) {
  const d = e.data;
  if (d && d.source === 'action-quick-host' && d.type === 'aq-init-bridge' && d.script) {
    try { eval(d.script); } catch(x) {}
  }
}
window.addEventListener('message', handleBridge);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

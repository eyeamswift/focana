import React from 'react';
import ReactDOM from 'react-dom/client';
import posthog from 'posthog-js';
import App from './App';
import './styles/main.css';

const analyticsEnabled = import.meta.env.VITE_ENABLE_ANALYTICS === 'true';
const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

if (analyticsEnabled && posthogKey) {
  try {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      defaults: '2026-01-30',
    });
  } catch (error) {
    console.warn('PostHog initialization failed; analytics disabled.', error);
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

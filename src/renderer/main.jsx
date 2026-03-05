import React from 'react';
import ReactDOM from 'react-dom/client';
import posthog from 'posthog-js';
import App from './App';
import './styles/main.css';

try {
  posthog.init('phc_vZ4qnRVsao0nnscIJsBxC8LqOpPbNns5AE9ibSYhUdr', {
    api_host: 'https://us.i.posthog.com',
    defaults: '2026-01-30',
  });
} catch (error) {
  console.warn('PostHog initialization failed; analytics disabled.', error);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Colored Logs Implementation
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args: any[]) => {
  originalLog('%c[LOG]', 'color: #10C080; font-weight: bold; background: rgba(16, 192, 128, 0.1); padding: 2px 5px; border-radius: 4px;', ...args);
};

console.error = (...args: any[]) => {
  originalError('%c[ERROR]', 'color: #FF4D4D; font-weight: bold; background: rgba(255, 77, 77, 0.1); padding: 2px 5px; border-radius: 4px;', ...args);
};

console.warn = (...args: any[]) => {
  originalWarn('%c[WARN]', 'color: #FFA500; font-weight: bold; background: rgba(255, 165, 0, 0.1); padding: 2px 5px; border-radius: 4px;', ...args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

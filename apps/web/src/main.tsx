import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { ToastProvider } from './features/toast';
import './app/app.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('The page is missing the #root element.');
}

createRoot(container).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);

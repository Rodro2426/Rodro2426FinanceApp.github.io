import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { loadData } from './lib/store';
import './styles.css';

loadData().then(() => {
  createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
});

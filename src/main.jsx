import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import AdminPage from './screens/AdminPage.jsx';
import './index.css';
import './styles/loading.css';
import './styles/classroom.css';
import './styles/home.css';
import './styles/home-motion.css';
import './styles/responsive.css';
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {window.location.pathname.startsWith('/admin') ? <AdminPage /> : <App />}
  </React.StrictMode>,
);

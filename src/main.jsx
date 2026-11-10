import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Loading from './components/Loading.jsx';
const AdminPage = lazy(() => import('./screens/AdminPage.jsx'));
import './index.css';
import './styles/loading.css';
import './styles/classroom.css';
import './styles/home.css';
import './styles/home-motion.css';
import './styles/responsive.css';
import './styles/classroom-design.css';
import './styles/characters.css';
import './styles/tipy-ui.css';
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback={<Loading fullscreen label="Đang mở trang…" />}>
      {window.location.pathname.startsWith('/admin') ? <AdminPage /> : <App />}
    </Suspense>
  </React.StrictMode>,
);

import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';
import { Toast } from './ui.jsx';

export default function Layout() {
  const { currentUser, mustChangePassword, toast, authPending } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // A route change (including a same-route filter click from the drawer
  // itself) should always close the mobile drawer rather than leave it
  // covering the page the person just navigated to.
  useEffect(() => setSidebarOpen(false), [location.pathname, location.search]);

  // A token exists but the live user list hasn't loaded yet (e.g. right
  // after a brand-new person's first login/signup) — wait rather than
  // treating "not found yet" as "not signed in".
  if (authPending) return null;
  if (!currentUser) return <Navigate to="/" replace />;
  if (mustChangePassword) return <Navigate to="/change-password" replace />;

  return (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--page-bg)' }}>
      <Header onMenuClick={() => setSidebarOpen((v) => !v)} />
      <div style={{ flex: 1, display: 'flex', minWidth: 0 }}>
        <div className={`sidebar-backdrop${sidebarOpen ? ' open' : ''}`} onClick={() => setSidebarOpen(false)} />
        <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
        <div className="layout-content" style={{ flex: 1, padding: '32px 36px', minWidth: 0 }}>
          <Outlet />
        </div>
      </div>
      <Toast message={toast} />
    </div>
  );
}

import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';
import { Toast } from './ui.jsx';

export default function Layout() {
  const { currentUser, mustChangePassword, toast, authPending } = useApp();

  // A token exists but the live user list hasn't loaded yet (e.g. right
  // after a brand-new person's first login/signup) — wait rather than
  // treating "not found yet" as "not signed in".
  if (authPending) return null;
  if (!currentUser) return <Navigate to="/" replace />;
  if (mustChangePassword) return <Navigate to="/change-password" replace />;

  return (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--page-bg)' }}>
      <Header />
      <div style={{ flex: 1, display: 'flex' }}>
        <Sidebar />
        <div style={{ flex: 1, padding: '32px 36px', minWidth: 0 }}>
          <Outlet />
        </div>
      </div>
      <Toast message={toast} />
    </div>
  );
}

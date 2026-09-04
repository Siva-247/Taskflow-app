import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { IconLogo, IconBell, IconCheckCircle, IconPlusCircle, IconUser, IconMenu } from './icons.jsx';
import { Avatar } from './ui.jsx';
import ProfilePanel from './ProfilePanel.jsx';
import { roleHome, formatDate } from '../utils.js';

const NOTIFICATION_ICON = {
  assigned: (color) => <IconPlusCircle size={14} color={color} />,
  submitted: (color) => <IconUser size={14} color={color} />,
  approved: (color) => <IconCheckCircle size={14} color={color} />,
  changes_requested: (color) => <IconUser size={14} color={color} />,
  marked: (color) => <IconCheckCircle size={14} color={color} />,
};

export default function Header({ onMenuClick }) {
  const { currentUser, notifications, markNotificationRead, markAllNotificationsRead } = useApp();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  if (!currentUser) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotificationClick = (n) => {
    setNotifOpen(false);
    if (!n.read) markNotificationRead(n.id);
    if (n.taskId) navigate(`/tasks/${n.taskId}`);
  };

  return (
    <div style={{
      height: 68, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px', gap: 12, position: 'sticky', top: 0, zIndex: 40,
      background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(14px) saturate(160%)', WebkitBackdropFilter: 'blur(14px) saturate(160%)',
      borderBottom: '1px solid rgba(230,225,240,0.8)', boxShadow: '0 4px 20px -14px rgba(59,30,112,0.2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <button type="button" className="hamburger-btn" onClick={onMenuClick} aria-label="Toggle navigation">
          <IconMenu size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', minWidth: 0 }} onClick={() => navigate(roleHome(currentUser.role))}>
          <IconLogo size={34} />
          <span className="header-brand-text" style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: 'var(--heading)', whiteSpace: 'nowrap' }}>TMS</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <div
            onClick={() => { setNotifOpen((v) => !v); setProfileOpen(false); }}
            style={{ width: 34, height: 34, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer' }}
          >
            <IconBell size={18} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 3, right: 3, minWidth: 15, height: 15, borderRadius: 999, background: 'var(--amber-fill)',
                border: '1.5px solid #FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: '#FFFFFF', padding: '0 3px',
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>

          {notifOpen && (
            <div className="notif-panel" style={{
              position: 'absolute', top: 44, right: -10, border: '1px solid rgba(230,225,240,0.8)',
              background: 'rgba(255,255,255,0.86)', backdropFilter: 'blur(16px) saturate(160%)', WebkitBackdropFilter: 'blur(16px) saturate(160%)',
              borderRadius: 10, boxShadow: '0 10px 28px -12px rgba(59,30,112,0.25)', width: 340, maxWidth: 'calc(100vw - 24px)', maxHeight: 420, overflowY: 'auto', zIndex: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>Notifications</span>
                {unreadCount > 0 && (
                  <span onClick={() => markAllNotificationsRead()} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--accent-dark)', cursor: 'pointer' }}>
                    Mark all read
                  </span>
                )}
              </div>
              {notifications.length === 0 && (
                <div style={{ padding: '24px 16px', textAlign: 'center', fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 15, color: 'var(--text-muted)' }}>
                  No notifications yet.
                </div>
              )}
              {notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', cursor: 'pointer',
                    borderBottom: '1px solid var(--border)', background: n.read ? 'transparent' : 'var(--accent-soft)',
                  }}
                >
                  {(NOTIFICATION_ICON[n.type] || NOTIFICATION_ICON.assigned)('var(--accent-dark)')}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: n.read ? 500 : 700, fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.4 }}>{n.text}</div>
                    <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{formatDate(n.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="header-user-text" style={{ width: 1, height: 22, background: 'var(--border)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }} onClick={() => { setProfileOpen((v) => !v); setNotifOpen(false); }}>
          <Avatar initial={currentUser.initial} size={32} />
          <div className="header-user-text" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--text-primary)' }}>{currentUser.name}</span>
            {currentUser.title && <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-muted)' }}>{currentUser.title}</span>}
          </div>
        </div>
      </div>

      {profileOpen && <ProfilePanel onClose={() => setProfileOpen(false)} />}
    </div>
  );
}

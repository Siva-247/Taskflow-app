import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { Card, Button } from '../components/ui.jsx';
import { IconPlusCircle, IconUser, IconCheckCircle, IconAlertTriangle } from '../components/icons.jsx';
import { formatDate } from '../utils.js';

const NOTIFICATION_ICON = {
  assigned: (color) => <IconPlusCircle size={16} color={color} />,
  submitted: (color) => <IconUser size={16} color={color} />,
  approved: (color) => <IconCheckCircle size={16} color={color} />,
  changes_requested: (color) => <IconUser size={16} color={color} />,
  marked: (color) => <IconCheckCircle size={16} color={color} />,
  blocker_assigned: (color) => <IconAlertTriangle size={16} color={color} />,
  blocker_resolved: (color) => <IconCheckCircle size={16} color={color} />,
};

// Same list the Header's bell dropdown used to show, moved to its own page
// (with a sidebar entry) instead — the bell icon now just links here rather
// than keeping a second, parallel notifications UI of its own.
export default function Notifications() {
  const { currentUser, notifications, markNotificationRead, markAllNotificationsRead, openBlockerRegister } = useApp();
  const navigate = useNavigate();

  if (!currentUser) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleClick = (n) => {
    if (!n.read) markNotificationRead(n.id);
    if (n.taskId) navigate(`/tasks/${n.taskId}`);
    else if (n.blockerId) openBlockerRegister();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>Notifications</div>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
          </div>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" onClick={() => markAllNotificationsRead()}>Mark all read</Button>
        )}
      </div>

      <Card padded={false}>
        {notifications.length === 0 && (
          <div style={{ padding: '40px 22px', textAlign: 'center', fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)' }}>
            No notifications yet.
          </div>
        )}
        {notifications.map((n, i) => (
          <div
            key={n.id}
            onClick={() => handleClick(n)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 22px', cursor: 'pointer',
              borderTop: i === 0 ? 'none' : '1px solid var(--border)', background: n.read ? 'transparent' : 'var(--surface)',
              transition: 'background .12s ease',
            }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 999, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              {(NOTIFICATION_ICON[n.type] || NOTIFICATION_ICON.assigned)('var(--accent-dark)')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: n.read ? 500 : 700, fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.5 }}>{n.text}</div>
              <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{formatDate(n.createdAt)}</div>
            </div>
            {!n.read && <div style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--amber-fill)', flexShrink: 0, marginTop: 6 }} />}
          </div>
        ))}
      </Card>
    </div>
  );
}

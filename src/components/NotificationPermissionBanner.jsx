import React, { useState } from 'react';
import { useChat } from '../context/ChatContext.jsx';
import { Button } from './ui.jsx';
import { IconBell, IconX } from './icons.jsx';

// Only ever shown for 'default' (never yet asked) — 'granted' has nothing
// left to do, and 'denied' can't be re-prompted from JS at all (browsers
// refuse to show the permission dialog again once a site is blocked; that
// case needs the person to go change it in their own browser's site
// settings, which a banner button can't do for them). Dismissing just hides
// it for this page load — reloading (a new session) offers it again rather
// than remembering a "no" forever, since permission itself is what actually
// tracks the lasting decision.
export default function NotificationPermissionBanner() {
  const { notificationPermission, requestNotificationPermission } = useChat();
  const [dismissed, setDismissed] = useState(false);

  if (notificationPermission !== 'default' || dismissed) return null;

  return (
    <div
      className="anim-fade"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px',
        background: 'var(--accent-soft)', borderBottom: '1px solid var(--border)',
      }}
    >
      <IconBell size={17} color="var(--accent-dark)" />
      <div style={{ flex: 1, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
        Turn on desktop notifications to see new chat messages even when you're on another page.
      </div>
      <Button variant="primary" style={{ padding: '7px 16px', fontSize: 12.5 }} onClick={() => requestNotificationPermission()}>
        Enable notifications
      </Button>
      <button
        type="button" onClick={() => setDismissed(true)} aria-label="Dismiss"
        style={{ display: 'flex', border: 0, background: 'transparent', cursor: 'pointer', padding: 4, flexShrink: 0 }}
      >
        <IconX size={16} color="var(--text-muted)" />
      </button>
    </div>
  );
}

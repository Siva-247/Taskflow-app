import React, { useState } from 'react';
import { useChat } from '../context/ChatContext.jsx';
import { Button } from './ui.jsx';
import { IconBell, IconAlertTriangle, IconX } from './icons.jsx';

// 'default' (never yet asked) gets the normal ask-for-it banner below.
// 'granted' has nothing left to do, so nothing renders.
// 'denied' can't be re-prompted from JS at all — browsers permanently
// refuse to show the permission dialog again once a site is blocked, so a
// button here would just silently do nothing. Before this existed, that
// left someone stuck wondering why they never saw notifications with zero
// explanation (this is also what a "not asked yet, ignored, and quietly
// auto-blocked by Chrome's own anti-spam heuristics" history looks like
// from the outside — indistinguishable from an explicit click on "Block").
// Since the fix has to happen in the browser's own UI, this state instead
// spells out exactly where to go, per-browser wording since Chrome and
// Edge don't put it in quite the same place.
const isChromium = /Edg\//.test(navigator.userAgent) ? 'edge' : /Chrome\//.test(navigator.userAgent) ? 'chrome' : null;
const BLOCKED_INSTRUCTIONS = {
  edge: 'Click the lock icon left of the address bar → Permissions for this site → Notifications → Allow, then reload the page.',
  chrome: 'Click the lock icon left of the address bar → Notifications → Allow, then reload the page (or visit chrome://settings/content/notifications and move this site to "Allowed").',
}[isChromium] || 'Open this site\'s permissions in your browser\'s address bar and switch Notifications to Allow, then reload the page.';

export default function NotificationPermissionBanner() {
  const { notificationPermission, requestNotificationPermission } = useChat();
  const [dismissed, setDismissed] = useState(false);

  if (notificationPermission === 'granted' || dismissed) return null;
  if (notificationPermission !== 'default' && notificationPermission !== 'denied') return null;

  const blocked = notificationPermission === 'denied';

  return (
    <div
      className="anim-fade"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px',
        background: blocked ? 'var(--amber-bg)' : 'var(--accent-soft)', borderBottom: '1px solid var(--border)',
      }}
    >
      {blocked ? <IconAlertTriangle size={17} /> : <IconBell size={17} color="var(--accent-dark)" />}
      <div style={{ flex: 1, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
        {blocked
          ? <>Chat notifications are blocked in this browser. {BLOCKED_INSTRUCTIONS}</>
          : 'Turn on desktop notifications to see new chat messages even when you\'re on another page.'}
      </div>
      {!blocked && (
        <Button variant="primary" style={{ padding: '7px 16px', fontSize: 12.5 }} onClick={() => requestNotificationPermission()}>
          Enable notifications
        </Button>
      )}
      <button
        type="button" onClick={() => setDismissed(true)} aria-label="Dismiss"
        style={{ display: 'flex', border: 0, background: 'transparent', cursor: 'pointer', padding: 4, flexShrink: 0 }}
      >
        <IconX size={16} color="var(--text-muted)" />
      </button>
    </div>
  );
}

import React from 'react';
import { Avatar } from '../ui.jsx';

// Overlapping avatar stack with a "+N" overflow badge — a compact preview of
// a team's roster, never the full list (that lives in the Members tab).
// Renders nothing for an empty team; callers show their own empty-state text.
export default function MemberAvatarGroup({ members, max = 4, size = 26 }) {
  if (!members || members.length === 0) return null;
  const shown = members.slice(0, max);
  const overflow = members.length - shown.length;
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((m, idx) => (
        <div key={m.id} title={m.name} style={{ marginLeft: idx === 0 ? 0 : -8, borderRadius: 999, border: '2px solid var(--field-bg)' }}>
          <Avatar initial={m.initial} size={size} />
        </div>
      ))}
      {overflow > 0 && (
        <div style={{
          marginLeft: -8, width: size, height: size, borderRadius: 999, background: 'var(--neutral-bg)',
          border: '2px solid var(--field-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 10, color: 'var(--text-secondary)', flexShrink: 0,
        }}>
          +{overflow}
        </div>
      )}
    </div>
  );
}

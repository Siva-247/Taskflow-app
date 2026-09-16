import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../ui.jsx';
import { IconUsers, IconDotsVertical, IconEdit } from '../icons.jsx';
import MemberAvatarGroup from './MemberAvatarGroup.jsx';

const menuItemStyle = {
  display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px', cursor: 'pointer',
  fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--text-primary)', whiteSpace: 'nowrap',
};

// One team, nested under its department (Overview tab) or standalone in a
// flat list (Teams tab, via `departmentName`). Edit/Delete live behind the
// "•••" menu to keep the row itself down to icon + name + roster + one button,
// matching the compact row shape asked for.
export default function TeamCard({ team, lead, members, departmentName, onEdit, onDelete, onViewTeam }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const leadLabel = lead ? `Led by ${lead.name}` : 'No team lead yet';
  const membersLabel = members.length > 0 ? `${members.length} member${members.length === 1 ? '' : 's'}` : 'No members yet';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 16px', borderRadius: 10, background: 'var(--field-bg)', flexWrap: 'wrap' }}>
      <div style={{ width: 30, height: 30, borderRadius: 999, background: 'var(--surface-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <IconUsers size={15} color="var(--accent-dark)" />
      </div>
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>{team.name}</div>
        <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
          {departmentName ? `${departmentName} · ` : ''}{leadLabel} · {membersLabel}
        </div>
      </div>
      <MemberAvatarGroup members={members} />
      <Button variant="secondary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={onViewTeam}>View Team</Button>
      <div ref={menuRef} style={{ position: 'relative' }}>
        <span
          onClick={() => setMenuOpen((v) => !v)}
          title="More actions"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, cursor: 'pointer' }}
          className="settings-row-action"
        >
          <IconDotsVertical size={15} />
        </span>
        {menuOpen && (
          <div style={{
            position: 'absolute', top: 32, right: 0, background: 'var(--field-bg)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 14px 32px -12px rgba(59,30,112,0.3)', overflow: 'hidden', zIndex: 30, minWidth: 150,
          }}>
            <div style={menuItemStyle} onClick={() => { setMenuOpen(false); onEdit(); }}>
              <IconEdit size={13} /> Edit team
            </div>
            <div style={{ ...menuItemStyle, color: 'var(--amber-text)' }} onClick={() => { setMenuOpen(false); onDelete(); }}>
              Delete team
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { Card, Button } from '../ui.jsx';
import { IconChevronDown, IconEdit, IconDotsVertical, IconBuilding, IconPlusCircle } from '../icons.jsx';
import TeamCard from './TeamCard.jsx';

const menuItemStyle = {
  display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px', cursor: 'pointer',
  fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--text-primary)', whiteSpace: 'nowrap',
};

// Flatter than the app's default frosted-glass card (no purple glow) — an
// explicit override, not a new design system, so a professional org-chart
// card reads calmer than the rest of the app's more decorative surfaces.
const FLAT_SHADOW = '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)';

function IconButton({ onClick, title, children }) {
  return (
    <span
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={title}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, cursor: 'pointer' }}
      className="settings-row-action"
    >
      {children}
    </span>
  );
}

// One department's card: header row (icon, name, roll-up counts, actions,
// expand chevron) plus its teams when expanded. `expandable=false` (used by
// the Departments tab) drops the chevron and never renders teams at all —
// team management lives entirely in the Teams tab in that mode.
export default function DepartmentCard({
  dept, color, memberCount, teamRows, expandable = true, isCollapsed, onToggle,
  onAddTeam, onEdit, onDelete, onEditTeam, onDeleteTeam, onViewTeam,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const teamsLabel = teamRows.length === 0 ? 'No teams yet' : `${teamRows.length} team${teamRows.length === 1 ? '' : 's'}`;
  const membersLabel = memberCount > 0 ? `${memberCount} member${memberCount === 1 ? '' : 's'}` : null;
  const caption = membersLabel ? `${teamsLabel} · ${membersLabel}` : teamsLabel;

  return (
    <Card padded={false} style={{ boxShadow: FLAT_SHADOW, border: '1px solid var(--border)', overflow: 'visible' }}>
      <div
        onClick={expandable ? onToggle : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px', cursor: expandable ? 'pointer' : 'default' }}
      >
        <div style={{ width: 40, height: 40, borderRadius: 12, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <IconBuilding size={19} color="#FFFFFF" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 15, color: 'var(--heading)' }}>{dept.name}</div>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{caption}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }} onClick={(e) => e.stopPropagation()}>
          <IconButton title="Edit department" onClick={onEdit}><IconEdit size={15} /></IconButton>
          <div ref={menuRef} style={{ position: 'relative' }}>
            <IconButton title="More actions" onClick={() => setMenuOpen((v) => !v)}><IconDotsVertical size={16} /></IconButton>
            {menuOpen && (
              <div style={{
                position: 'absolute', top: 32, right: 0, background: 'var(--field-bg)', border: '1px solid var(--border)', borderRadius: 10,
                boxShadow: '0 14px 32px -12px rgba(59,30,112,0.3)', overflow: 'hidden', zIndex: 30, minWidth: 170,
              }}>
                {expandable && (
                  <div style={menuItemStyle} onClick={() => { setMenuOpen(false); onAddTeam(); }}>
                    <IconPlusCircle size={13} color="var(--accent-dark)" /> Add team here
                  </div>
                )}
                <div style={{ ...menuItemStyle, color: 'var(--amber-text)' }} onClick={() => { setMenuOpen(false); onDelete(); }}>
                  Delete department
                </div>
              </div>
            )}
          </div>
          {expandable && (
            <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s ease' }}>
              <IconChevronDown size={14} color="var(--text-muted)" />
            </div>
          )}
        </div>
      </div>

      {expandable && !isCollapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '2px 18px 16px' }}>
          {teamRows.map(({ team, lead, members }) => (
            <div key={team.id} style={{ marginLeft: 54 }}>
              <TeamCard
                team={team}
                lead={lead}
                members={members}
                onEdit={() => onEditTeam(team)}
                onDelete={() => onDeleteTeam(team)}
                onViewTeam={() => onViewTeam(team)}
              />
            </div>
          ))}
          {teamRows.length === 0 && (
            <div style={{ marginLeft: 54, padding: '14px 16px', background: 'var(--field-bg)', border: '1px dashed var(--border)', borderRadius: 10 }}>
              <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>No teams created yet</div>
              <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--text-muted)', marginTop: 3, marginBottom: 10 }}>
                Create a team to start organizing members.
              </div>
              <Button variant="secondary" style={{ padding: '7px 14px', fontSize: 12.5 }} onClick={onAddTeam}>
                <IconPlusCircle size={13} color="var(--accent-dark)" /> Create Team
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

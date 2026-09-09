import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { useChat } from '../context/ChatContext.jsx';
import { ROLES } from '../data/mockData.js';
import {
  IconGrid, IconUser, IconUsers, IconChecklist, IconBarChart, IconGear,
  IconEye, IconCalendar, IconChat, IconChevronDown,
} from './icons.jsx';
import { Avatar } from './ui.jsx';

const ADMIN_NAV = [
  { label: 'Dashboard', icon: IconGrid, to: '/admin' },
  { label: 'Employees', icon: IconUser, to: '/employees' },
  { label: 'All Tasks', icon: IconChecklist, to: '/tasks' },
  { label: 'Chat', icon: IconChat, to: '/chat' },
  { label: 'Daily Updates', icon: IconCalendar, to: '/daily-updates' },
  { label: 'Reports', icon: IconBarChart, to: '/reports' },
  { label: 'Settings', icon: IconGear, to: '/settings' },
];

const NAV_BY_ROLE = {
  [ROLES.SUPER_ADMIN]: ADMIN_NAV,
  [ROLES.ADMIN]: ADMIN_NAV,
  [ROLES.MANAGER]: [
    { label: 'Dashboard', icon: IconGrid, to: '/manager' },
    { label: 'Employees', icon: IconUser, to: '/employees' },
    { label: 'Tasks', icon: IconChecklist, to: '/tasks' },
    { label: 'Approvals', icon: IconEye, to: '/tasks?status=Pending+Approval' },
    { label: 'Chat', icon: IconChat, to: '/chat' },
    { label: 'Daily Updates', icon: IconCalendar, to: '/daily-updates' },
    { label: 'Reports', icon: IconBarChart, to: '/reports' },
  ],
  [ROLES.ASSISTANT_MANAGER]: [
    { label: 'Dashboard', icon: IconGrid, to: '/assistant-manager' },
    { label: 'My Team', icon: IconUsers, to: '/my-team' },
    { label: 'Tasks', icon: IconChecklist, to: '/tasks' },
    { label: 'Approvals', icon: IconEye, to: '/tasks?status=Pending+Approval' },
    { label: 'Reviews', icon: IconEye, to: '/tasks?status=Submitted+for+Review' },
    { label: 'Chat', icon: IconChat, to: '/chat' },
    { label: 'Daily Updates', icon: IconCalendar, to: '/daily-updates' },
    { label: 'Reports', icon: IconBarChart, to: '/reports' },
  ],
  [ROLES.TEAM_LEAD]: [
    { label: 'Dashboard', icon: IconGrid, to: '/team-lead' },
    { label: 'My Team', icon: IconUsers, to: '/my-team' },
    { label: 'Tasks', icon: IconChecklist, to: '/tasks' },
    { label: 'Approvals', icon: IconEye, to: '/tasks?status=Pending+Approval' },
    { label: 'Reviews', icon: IconEye, to: '/tasks?status=Submitted+for+Review' },
    { label: 'Chat', icon: IconChat, to: '/chat' },
    { label: 'Daily Updates', icon: IconCalendar, to: '/daily-updates' },
    { label: 'Reports', icon: IconBarChart, to: '/reports' },
  ],
  [ROLES.EMPLOYEE]: [
    { label: 'Dashboard', icon: IconGrid, to: '/employee' },
    { label: 'My Tasks', icon: IconChecklist, to: '/tasks' },
    { label: 'Chat', icon: IconChat, to: '/chat' },
    { label: 'Update History', icon: IconBarChart, to: '/daily-updates' },
  ],
};

const WIDTH_BY_ROLE = {
  [ROLES.EMPLOYEE]: 212,
};
const MIN_WIDTH = 180;
const MAX_WIDTH = 380;
const STORAGE_KEY = 'sidebarWidth';
// Same table ProfilePanel.jsx keeps locally for its own identity display —
// duplicated here rather than shared, matching that existing convention.
const ROLE_LABEL = {
  super_admin: 'Super Admin', admin: 'Admin', manager: 'Manager',
  assistant_manager: 'Assistant Manager', team_lead: 'Team Lead', employee: 'Employee',
};

function loadStoredWidth(defaultWidth) {
  try {
    const raw = Number(localStorage.getItem(STORAGE_KEY));
    if (raw >= MIN_WIDTH && raw <= MAX_WIDTH) return raw;
  } catch {
    // localStorage unavailable (private mode etc) — fall back silently
  }
  return defaultWidth;
}

// `collapsed`/`onToggleCollapse` are owned by Layout (the `.is-collapsed`
// class has to land on an ancestor of `.sidebar-shell` for the hover-expand
// CSS in global.css to apply) — this component just reflects that state and
// renders the toggle control itself. While collapsed the rail's width is
// fully CSS-driven (`!important`), so the drag-resize handle below is hidden
// rather than fighting it.
export default function Sidebar({ open = false, onNavigate, collapsed = false, onToggleCollapse }) {
  const { currentUser, showToast } = useApp();
  const { conversations } = useChat();
  const navigate = useNavigate();
  const location = useLocation();
  const defaultWidth = WIDTH_BY_ROLE[currentUser?.role] || 232;
  const [width, setWidth] = useState(() => loadStoredWidth(defaultWidth));
  const [dragging, setDragging] = useState(false);
  const [handleHover, setHandleHover] = useState(false);
  const widthRef = useRef(width);
  widthRef.current = width;

  useEffect(() => {
    if (!dragging) return undefined;
    const handleMouseMove = (e) => {
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
      setWidth(next);
    };
    const stopDragging = () => {
      setDragging(false);
      try {
        localStorage.setItem(STORAGE_KEY, String(widthRef.current));
      } catch {
        // localStorage unavailable — width just won't persist across reloads
      }
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopDragging);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopDragging);
    };
  }, [dragging]);

  if (!currentUser) return null;

  const items = NAV_BY_ROLE[currentUser.role] || [];
  const currentPath = location.pathname + location.search;
  // Same "unread" rule as the Chat page's conversation list — one badge
  // count per conversation currently carrying an unread message from
  // someone else, not a running total of every message, so reading a chat
  // always drops it by exactly the 1 that chat was contributing.
  const unreadChatCount = conversations.filter((c) => c.lastMessageAt && (!c.lastReadAt || c.lastMessageAt > c.lastReadAt) && c.lastMessageSenderId !== currentUser.id).length;

  const go = (to) => {
    navigate(to);
    if (onNavigate) onNavigate();
  };

  return (
    <div className={`sidebar-shell card-glass${open ? ' open' : ''}`} style={{
      width, flexShrink: 0, borderRadius: 20, margin: '16px 0 16px 16px',
      position: 'relative', zIndex: 1,
      padding: '18px 14px', display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div
        onClick={onToggleCollapse}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="btn-glass"
        style={{
          width: 26, height: 26, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', alignSelf: collapsed ? 'center' : 'flex-end', marginBottom: 8, flexShrink: 0,
        }}
      >
        <span style={{ display: 'flex', transform: collapsed ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform .2s ease' }}>
          <IconChevronDown size={11} color="var(--brand)" />
        </span>
      </div>

      {items.map((item) => {
        const isActive = item.to && (item.to === location.pathname || item.to === currentPath);
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className={`sidebar-nav-item${isActive ? ' active' : ''}`}
            onClick={() => (item.to ? go(item.to) : showToast(`${item.label} is planned for Phase 2`))}
          >
            <Icon size={17} color={isActive ? 'var(--brand)' : 'var(--muted-strong)'} style={{ flexShrink: 0 }} />
            <span className="label" style={{ flex: 1, fontSize: 13.5 }}>
              {item.label}
            </span>
            {item.to === '/chat' && unreadChatCount > 0 && (
              <span className="label anim-badge-pop" style={{
                minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: 'var(--amber-fill)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 10.5, color: '#FFFFFF', flexShrink: 0,
              }}>
                {unreadChatCount > 9 ? '9+' : unreadChatCount}
              </span>
            )}
          </div>
        );
      })}

      <div className="sidebar-user-block" style={{
        marginTop: 'auto', paddingTop: 14, display: 'flex', alignItems: 'center', gap: 10,
        borderTop: '1px solid var(--line)',
      }}>
        <Avatar initial={currentUser.initial} size={34} gradient />
        <div className="sidebar-user-text" style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13.5, color: 'var(--heading)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {currentUser.name}
          </div>
          <div style={{
            fontWeight: 600, fontSize: 11.5, color: 'var(--muted)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {currentUser.title || ROLE_LABEL[currentUser.role]}
          </div>
        </div>
      </div>

      {!collapsed && (
        <div
          className="sidebar-resize-handle"
          onMouseDown={(e) => { e.preventDefault(); setDragging(true); }}
          onMouseEnter={() => setHandleHover(true)}
          onMouseLeave={() => setHandleHover(false)}
          title="Drag to resize"
          style={{
            position: 'absolute', top: 0, bottom: 0, right: -4, width: 8,
            cursor: 'col-resize', zIndex: 2,
          }}
        >
          <div style={{
            width: 3, height: '100%', margin: '0 auto',
            background: (handleHover || dragging) ? 'var(--accent)' : 'transparent',
            opacity: (handleHover || dragging) ? 0.55 : 0,
            borderRadius: 999, transition: dragging ? 'none' : 'opacity 150ms ease, background 150ms ease',
          }} />
        </div>
      )}
    </div>
  );
}

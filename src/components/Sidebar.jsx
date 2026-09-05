import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { useChat } from '../context/ChatContext.jsx';
import { ROLES } from '../data/mockData.js';
import {
  IconGrid, IconLayers, IconUser, IconUsers, IconChecklist, IconBarChart, IconGear,
  IconEye, IconCalendar, IconChat,
} from './icons.jsx';

const ADMIN_NAV = [
  { label: 'Dashboard', icon: IconGrid, to: '/admin' },
  { label: 'Departments', icon: IconLayers, to: '/departments' },
  { label: 'Employees', icon: IconUser, to: '/employees' },
  { label: 'Teams', icon: IconUsers, to: '/teams' },
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
    { label: 'Teams', icon: IconUsers, to: '/teams' },
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

export default function Sidebar({ open = false, onNavigate }) {
  const { currentUser, showToast } = useApp();
  const { conversations } = useChat();
  const navigate = useNavigate();
  const location = useLocation();
  if (!currentUser) return null;

  const items = NAV_BY_ROLE[currentUser.role] || [];
  const width = WIDTH_BY_ROLE[currentUser.role] || 232;
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
    <div className={`sidebar${open ? ' open' : ''}`} style={{
      width, flexShrink: 0, background: '#FFFFFF', borderRight: '1px solid var(--border)',
      boxShadow: '4px 0 24px -12px rgba(124,58,237,0.22)', position: 'relative', zIndex: 1,
      padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      {items.map((item) => {
        const isActive = item.to && (item.to === location.pathname || item.to === currentPath);
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            onClick={() => (item.to ? go(item.to) : showToast(`${item.label} is planned for Phase 2`))}
            style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', borderRadius: 12,
              background: isActive ? 'var(--accent-soft)' : 'transparent',
              boxShadow: isActive ? '0 0 0 1px rgba(124,58,237,0.12), 0 4px 14px -6px rgba(124,58,237,0.35)' : 'none',
              cursor: 'pointer', userSelect: 'none', transition: 'background 150ms ease, box-shadow 150ms ease',
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--field-bg)'; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
          >
            <Icon size={17} color={isActive ? 'var(--accent-dark)' : 'var(--text-muted)'} />
            <span style={{
              flex: 1,
              fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? 'var(--accent-dark)' : 'var(--text-secondary)',
            }}>
              {item.label}
            </span>
            {item.to === '/chat' && unreadChatCount > 0 && (
              <span style={{
                minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: 'var(--amber-fill)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 10.5, color: '#FFFFFF',
              }}>
                {unreadChatCount > 9 ? '9+' : unreadChatCount}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

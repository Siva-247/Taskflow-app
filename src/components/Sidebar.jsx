import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { ROLES } from '../data/mockData.js';
import {
  IconGrid, IconLayers, IconUser, IconUsers, IconChecklist, IconBarChart, IconGear,
  IconPlusCircle, IconEye, IconCalendar,
} from './icons.jsx';

const NAV_BY_ROLE = {
  [ROLES.ADMIN]: [
    { label: 'Dashboard', icon: IconGrid, to: '/admin' },
    { label: 'Departments', icon: IconLayers, to: '/departments' },
    { label: 'Employees', icon: IconUser, to: '/employees' },
    { label: 'Teams', icon: IconUsers, to: '/teams' },
    { label: 'All Tasks', icon: IconChecklist, to: '/tasks' },
    { label: 'Daily Updates', icon: IconCalendar, to: '/daily-updates' },
    { label: 'Reports', icon: IconBarChart, to: '/reports' },
    { label: 'Settings', icon: IconGear, to: '/settings' },
  ],
  [ROLES.MANAGER]: [
    { label: 'Dashboard', icon: IconGrid, to: '/manager' },
    { label: 'Teams', icon: IconUsers, to: '/teams' },
    { label: 'Employees', icon: IconUser, to: '/employees' },
    { label: 'Tasks', icon: IconChecklist, to: '/tasks' },
    { label: 'Create Task', icon: IconPlusCircle, to: '/tasks/new' },
    { label: 'Approvals', icon: IconEye, to: '/tasks?status=Pending+Approval' },
    { label: 'Daily Updates', icon: IconCalendar, to: '/daily-updates' },
    { label: 'Reports', icon: IconBarChart, to: '/reports' },
  ],
  [ROLES.TEAM_LEAD]: [
    { label: 'Dashboard', icon: IconGrid, to: '/team-lead' },
    { label: 'My Team', icon: IconUsers, to: '/my-team' },
    { label: 'Tasks', icon: IconChecklist, to: '/tasks' },
    { label: 'Create Task', icon: IconPlusCircle, to: '/tasks/new' },
    { label: 'Approvals', icon: IconEye, to: '/tasks?status=Pending+Approval' },
    { label: 'Reviews', icon: IconEye, to: '/tasks?status=Submitted+for+Review' },
    { label: 'Daily Updates', icon: IconCalendar, to: '/daily-updates' },
    { label: 'Reports', icon: IconBarChart, to: '/reports' },
  ],
  [ROLES.EMPLOYEE]: [
    { label: 'Dashboard', icon: IconGrid, to: '/employee' },
    { label: 'My Tasks', icon: IconChecklist, to: '/tasks' },
    { label: 'Create Task', icon: IconPlusCircle, to: '/tasks/new' },
    { label: 'Daily Work Update', icon: IconCalendar, to: '/daily-update' },
    { label: 'Update History', icon: IconBarChart, to: '/daily-updates' },
    { label: 'Profile', icon: IconUser, to: '/profile' },
  ],
};

const WIDTH_BY_ROLE = {
  [ROLES.EMPLOYEE]: 212,
};

export default function Sidebar() {
  const { currentUser, showToast } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  if (!currentUser) return null;

  const items = NAV_BY_ROLE[currentUser.role] || [];
  const width = WIDTH_BY_ROLE[currentUser.role] || 232;
  const currentPath = location.pathname + location.search;

  return (
    <div style={{
      width, flexShrink: 0, background: '#FFFFFF', borderRight: '1px solid var(--border)',
      padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      {items.map((item) => {
        const isActive = item.to && (item.to === location.pathname || item.to === currentPath);
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            onClick={() => (item.to ? navigate(item.to) : showToast(`${item.label} is planned for Phase 2`))}
            style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', borderRadius: 9,
              background: isActive ? 'var(--accent-soft)' : 'transparent',
              cursor: 'pointer', userSelect: 'none',
            }}
          >
            <Icon size={17} color={isActive ? 'var(--accent-dark)' : 'var(--text-muted)'} />
            <span style={{
              fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? 'var(--accent-dark)' : 'var(--text-secondary)',
            }}>
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

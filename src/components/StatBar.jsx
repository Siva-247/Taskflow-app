import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconClipboard, IconCheckCircle, IconClock, IconAlertTriangle, IconPending, IconUsersGroup, IconBuilding } from './icons.jsx';

export function defaultStatItems(stats, totalLabel = 'Total', completedBadge) {
  return [
    { icon: <IconClipboard size={19} color="var(--accent)" />, value: stats.total, label: totalLabel, to: '/tasks' },
    { icon: <IconCheckCircle size={19} color="var(--accent-dark)" />, value: stats.completed, label: 'Completed', badge: completedBadge, to: '/tasks?status=Completed' },
    { icon: <IconClock size={19} color="var(--accent-mid)" />, value: stats.inProgress, label: 'In Progress', to: '/tasks?status=In+Progress' },
    { icon: <IconPending size={19} color="var(--accent-deep)" />, value: stats.pending, label: 'Pending', to: '/tasks?status=To+Do' },
    { icon: <IconAlertTriangle size={19} color="var(--amber-text)" />, value: stats.overdue, label: 'Overdue', to: '/tasks?status=Overdue' },
  ];
}

export function orgStatItems({ totalEmployees, totalDepartments }) {
  return [
    { icon: <IconUsersGroup size={19} color="var(--accent)" />, value: totalEmployees, label: 'Total Employees', to: '/employees' },
    { icon: <IconBuilding size={19} color="var(--accent-dark)" />, value: totalDepartments, label: 'Total Departments', to: '/departments' },
  ];
}

export default function StatBar({ items }) {
  const navigate = useNavigate();

  return (
    <div className="stat-bar" style={{ display: 'grid', '--stat-cols': items.length }}>
      {items.map((item) => (
        <div
          key={item.label}
          onClick={item.to ? () => navigate(item.to) : undefined}
          className={item.to ? 'stat-card stat-card-clickable' : 'stat-card'}
          style={{
            padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 13,
            background: 'var(--accent-soft)', borderRadius: 14,
            cursor: item.to ? 'pointer' : 'default',
          }}
        >
          {item.icon}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 22, color: 'var(--heading)', lineHeight: 1 }}>{item.value}</span>
              {item.badge && <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: 'var(--accent-dark)' }}>{item.badge}</span>}
            </div>
            <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{item.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

import { ROLES } from './data/mockData.js';

export function roleHome(role) {
  switch (role) {
    case ROLES.ADMIN: return '/admin';
    case ROLES.MANAGER: return '/manager';
    case ROLES.TEAM_LEAD: return '/team-lead';
    case ROLES.EMPLOYEE: return '/employee';
    default: return '/';
  }
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function isOverdue(dueDate, today, status) {
  return status !== 'Completed' && dueDate < today;
}

function toCsvValue(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function downloadCsv(filename, rows, columns) {
  const header = columns.map((c) => toCsvValue(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => toCsvValue(c.value(row))).join(','));
  const csv = [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

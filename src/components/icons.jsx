import React from 'react';

const base = (size) => ({ width: size, height: size, fill: 'none', xmlns: 'http://www.w3.org/2000/svg' });

export function IconLogo({ size = 19 }) {
  return (
    <svg {...base(size)} viewBox="0 0 24 24">
      <path d="M4 12c2.5 0 2.5-5 5-5s2.5 10 5 10 2.5-5 5-5" stroke="white" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconBell({ size = 18, color = 'var(--text-secondary)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 20 20">
      <path d="M5 8.5a5 5 0 0110 0c0 3.2 1.2 4.4 1.9 5.1.3.3.1.9-.4.9H3.5c-.5 0-.7-.6-.4-.9.7-.7 1.9-1.9 1.9-5.1z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8.2 16.8a1.9 1.9 0 003.6 0" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconChevronDown({ size = 13, color = 'var(--text-secondary)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 20 20">
      <path d="M5 8l5 5 5-5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconGrid({ size = 17, color = 'var(--text-muted)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 20 20">
      <rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1.6" stroke={color} strokeWidth="1.6" />
      <rect x="11" y="2.5" width="6.5" height="6.5" rx="1.6" stroke={color} strokeWidth="1.6" />
      <rect x="2.5" y="11" width="6.5" height="6.5" rx="1.6" stroke={color} strokeWidth="1.6" />
      <rect x="11" y="11" width="6.5" height="6.5" rx="1.6" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

export function IconLayers({ size = 17, color = 'var(--text-muted)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 20 20">
      <path d="M10 2.5L17.5 6.5L10 10.5L2.5 6.5L10 2.5Z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M2.5 10.5L10 14.5L17.5 10.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 14.2L10 18.2L17.5 14.2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconUser({ size = 17, color = 'var(--text-muted)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 20 20">
      <circle cx="10" cy="6.5" r="3.2" stroke={color} strokeWidth="1.6" />
      <path d="M3.5 17c0-3.3 2.9-5.8 6.5-5.8s6.5 2.5 6.5 5.8" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconUsers({ size = 17, color = 'var(--text-muted)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 20 20">
      <circle cx="7" cy="6.2" r="2.7" stroke={color} strokeWidth="1.6" />
      <circle cx="14.2" cy="7.2" r="2.2" stroke={color} strokeWidth="1.6" />
      <path d="M2 17c0-2.9 2.3-5.1 5-5.1s5 2.2 5 5.1" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12.8 12.3c2.4.2 4.2 2.1 4.2 4.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconChecklist({ size = 17, color = 'var(--text-muted)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 20 20">
      <rect x="2.5" y="2.5" width="15" height="15" rx="3" stroke={color} strokeWidth="1.6" />
      <path d="M6 10l2.3 2.3L14 6.8" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconBarChart({ size = 17, color = 'var(--text-muted)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 20 20">
      <path d="M3 17V10.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M10 17V4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M17 17V8" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M2 17h16" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconGear({ size = 17, color = 'var(--text-muted)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="2.6" stroke={color} strokeWidth="1.6" />
      <path d="M10 2.8v2.1M10 15.1v2.1M17.2 10h-2.1M4.9 10H2.8M15.1 4.9l-1.5 1.5M6.4 13.6l-1.5 1.5M15.1 15.1l-1.5-1.5M6.4 6.4L4.9 4.9" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconPlusCircle({ size = 17, color = 'var(--text-muted)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="7.5" stroke={color} strokeWidth="1.6" />
      <path d="M10 6.8v6.4M6.8 10h6.4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconCheckCircle({ size = 17, color = 'var(--text-muted)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="7.5" stroke={color} strokeWidth="1.6" />
      <path d="M6.8 10.2l2.2 2.2 4.2-4.6" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconEye({ size = 17, color = 'var(--text-muted)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 20 20">
      <path d="M2 10c1.8-3.3 4.8-5 8-5s6.2 1.7 8 5c-1.8 3.3-4.8 5-8 5s-6.2-1.7-8-5Z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2.3" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

export function IconCalendar({ size = 17, color = 'var(--text-muted)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 20 20">
      <rect x="2.5" y="4" width="15" height="13.5" rx="2.2" stroke={color} strokeWidth="1.6" />
      <path d="M2.5 8h15" stroke={color} strokeWidth="1.6" />
      <path d="M6.5 2.5v3M13.5 2.5v3" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconClock({ size = 19, color = 'var(--accent-mid)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.7" />
      <path d="M12 7v5l3.3 2" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconAlertTriangle({ size = 19, color = 'var(--amber-text)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 24 24">
      <path d="M12 3.5L21.5 20h-19L12 3.5Z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M12 9.5v4.4" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="16.8" r="0.9" fill={color} stroke="none" />
    </svg>
  );
}

export function IconClipboard({ size = 19, color = 'var(--accent)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 24 24">
      <rect x="5" y="3.5" width="14" height="18" rx="2.5" stroke={color} strokeWidth="1.7" />
      <path d="M9 3.5V3a2 2 0 012-2h2a2 2 0 012 2v.5" stroke={color} strokeWidth="1.7" />
      <path d="M8.3 12l2.1 2.1 4.3-4.3" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPaperclip({ size = 15, color = 'var(--text-secondary)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 20 20">
      <path d="M13.5 6.5l-6 6a2.5 2.5 0 003.5 3.5l6.5-6.5a4 4 0 00-5.5-5.5l-6.5 6.5a5.5 5.5 0 007.5 7.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconComment({ size = 13, color = 'var(--text-secondary)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 20 20">
      <path d="M3 4.5h14v9H8l-3.5 3v-3H3v-9Z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCheck({ size = 13, color = 'var(--accent-dark)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 20 20">
      <path d="M4 10.5l3.5 3.5L16 5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconArrowRight({ size = 14, color = 'var(--accent-dark)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 20 20">
      <path d="M4 10h12M11 5l5 5-5 5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPlus({ size = 13, color = '#FFFFFF' }) {
  return (
    <svg {...base(size)} viewBox="0 0 20 20">
      <path d="M10 4.5v11M4.5 10h11" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconLink({ size = 14, color = 'var(--accent-dark)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 20 20">
      <path d="M8.5 11.5a3 3 0 004.2 0l2.3-2.3a3 3 0 00-4.2-4.2l-1 1" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M11.5 8.5a3 3 0 00-4.2 0L5 10.8a3 3 0 004.2 4.2l1-1" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconPending({ size = 19, color = 'var(--accent-deep)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.7" strokeDasharray="3 3" />
      <circle cx="12" cy="12" r="2" fill={color} stroke="none" />
    </svg>
  );
}

export function IconUsersGroup({ size = 19, color = 'var(--accent)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 24 24">
      <circle cx="9" cy="8" r="3.2" stroke={color} strokeWidth="1.7" />
      <circle cx="17" cy="9.5" r="2.6" stroke={color} strokeWidth="1.7" />
      <path d="M3.5 20c0-3.6 2.5-6.3 5.5-6.3s5.5 2.7 5.5 6.3" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M15.5 14.5c2.7.4 4.5 2.6 4.5 5.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconBuilding({ size = 19, color = 'var(--accent-dark)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 24 24">
      <rect x="4" y="3.5" width="12" height="17" rx="1.5" stroke={color} strokeWidth="1.7" />
      <path d="M16 9.5h4v11H16" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M7.5 7.5h1.8M7.5 11h1.8M7.5 14.5h1.8M12 7.5h1.8M12 11h1.8M12 14.5h1.8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconSearch({ size = 16, color = 'var(--text-muted)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 20 20">
      <circle cx="9" cy="9" r="6" stroke={color} strokeWidth="1.7" />
      <path d="M13.5 13.5L17.5 17.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconDownload({ size = 14, color = '#FFFFFF' }) {
  return (
    <svg {...base(size)} viewBox="0 0 20 20">
      <path d="M10 3v10M6 9l4 4 4-4M4 16h12" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconMenu({ size = 20, color = 'var(--text-primary)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 20 20">
      <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconX({ size = 20, color = 'var(--text-primary)' }) {
  return (
    <svg {...base(size)} viewBox="0 0 20 20">
      <path d="M5 5l10 10M15 5L5 15" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

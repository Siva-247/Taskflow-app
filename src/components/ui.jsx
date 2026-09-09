import React from 'react';
import { createPortal } from 'react-dom';
import { STATUS, PRIORITY } from '../data/mockData.js';

export function Avatar({ initial, size = 32, gradient = false }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 999, flexShrink: 0,
      background: gradient ? 'var(--brand-grad)' : 'var(--accent-dark)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: Math.round(size * 0.4), color: '#FFFFFF',
    }}>
      {initial}
    </div>
  );
}

const statusStyles = {
  [STATUS.TODO]: { bg: 'var(--neutral-bg)', color: 'var(--text-secondary)' },
  [STATUS.IN_PROGRESS]: { bg: 'var(--accent-soft)', color: 'var(--accent-dark)' },
  [STATUS.IN_REVIEW]: { bg: 'var(--amber-bg)', color: 'var(--amber-text)' },
  [STATUS.COMPLETED]: { bg: '#EDE4FB', color: 'var(--accent-dark)' },
  [STATUS.DRAFT]: { bg: 'var(--neutral-bg)', color: 'var(--text-muted)' },
  [STATUS.PENDING_APPROVAL]: { bg: 'var(--amber-bg)', color: 'var(--amber-text)' },
};

export function StatusBadge({ status }) {
  const s = statusStyles[status] || statusStyles[STATUS.TODO];
  return (
    <span className="anim-badge-pop" style={{
      display: 'inline-block', padding: '4px 11px', borderRadius: 999,
      background: s.bg, color: s.color,
      fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 11.5,
    }}>
      {status}
    </span>
  );
}

// The daily-update tracker's own status vocabulary doesn't match Task's
// STATUS enum (only "Completed" overlaps), so the Task-oriented StatusBadge
// above would render everything else with the same generic fallback style —
// this gives each of the 7 values its own color. Shared by DailyUpdateHistory
// and CurrentProjectsBoard so both render a project/entry's status identically.
export const DAILY_STATUS_COLOR = {
  Open: { bg: 'var(--neutral-bg)', color: 'var(--text-secondary)' },
  Inprogress: { bg: 'var(--accent-soft)', color: 'var(--accent-dark)' },
  Pending: { bg: 'var(--amber-bg)', color: 'var(--amber-text)' },
  Completed: { bg: '#EDE4FB', color: 'var(--accent-dark)' },
  Hold: { bg: 'var(--amber-fill)', color: '#FFFFFF' },
  Cancelled: { bg: 'var(--neutral-bg)', color: 'var(--text-muted)' },
  Interested: { bg: 'var(--accent-soft)', color: 'var(--accent-mid)' },
};

export function DailyStatusBadge({ status }) {
  const s = DAILY_STATUS_COLOR[status] || DAILY_STATUS_COLOR.Open;
  return (
    <span style={{
      display: 'inline-block', padding: '4px 11px', borderRadius: 999, background: s.bg, color: s.color,
      fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 11.5,
    }}>
      {status}
    </span>
  );
}

const priorityStyles = {
  [PRIORITY.HIGH]: { bg: 'var(--amber-bg)', color: 'var(--amber-text)', dot: 'var(--amber-fill)' },
  [PRIORITY.MEDIUM]: { bg: 'var(--neutral-bg)', color: 'var(--text-secondary)', dot: 'var(--text-muted)' },
  [PRIORITY.LOW]: { bg: 'var(--accent-soft)', color: 'var(--accent-dark)', dot: 'var(--accent)' },
};

export function PriorityBadge({ priority }) {
  const s = priorityStyles[priority] || priorityStyles[PRIORITY.MEDIUM];
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 999, background: s.bg, color: s.color,
      fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 11,
    }}>
      {priority} priority
    </span>
  );
}

export function PriorityDot({ priority }) {
  const s = priorityStyles[priority] || priorityStyles[PRIORITY.MEDIUM];
  return <span style={{ width: 8, height: 8, borderRadius: 999, background: s.dot, flexShrink: 0, display: 'inline-block' }} />;
}

export function ProgressBar({ value, height = 8, color = 'var(--accent)' }) {
  return (
    <div style={{ flex: 1, height, borderRadius: 999, background: 'var(--track-bg)', overflow: 'hidden' }}>
      <div style={{ width: `${value}%`, height: '100%', borderRadius: 999, background: color, transition: 'width .25s ease' }} />
    </div>
  );
}

const BUTTON_VARIANT_CLASS = {
  primary: 'btn-3d btn-3d-primary',
  secondary: 'btn-3d btn-glass',
  accentOutline: 'btn-3d btn-glass',
  danger: 'btn-3d btn-3d-danger',
};

export function Button({ variant = 'primary', children, onClick, style, type = 'button', disabled, className }) {
  const base = {
    padding: '10px 22px', fontFamily: 'var(--font-body)',
    fontWeight: 700, fontSize: 13.5, border: 0, display: 'inline-flex',
    alignItems: 'center', gap: 7, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
  };
  const classes = [BUTTON_VARIANT_CLASS[variant] || BUTTON_VARIANT_CLASS.primary, className].filter(Boolean).join(' ');
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={classes} style={{ ...base, ...style }}>
      {children}
    </button>
  );
}

export function Card({ children, style, padded = true, className, animate = true }) {
  const classes = ['card-glass', animate ? 'anim-scale-in' : '', className].filter(Boolean).join(' ');
  return (
    <div className={classes} style={{
      borderRadius: 18, padding: padded ? '24px 26px' : 0, ...style,
    }}>
      {children}
    </div>
  );
}

export function SectionLabel({ children, first, icon }) {
  return (
    <div style={{ padding: first ? '20px 0 10px' : '26px 0 10px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 11.5,
        letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-strong)',
        borderTop: first ? 'none' : '1px solid var(--line)', paddingTop: first ? 0 : 20,
      }}>
        {icon}{children}
      </div>
    </div>
  );
}

export function Field({ label, required, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
        {label} {required && <span style={{ color: 'var(--amber-text)' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  padding: '12px 15px', border: '1px solid var(--line)', borderRadius: 14, background: 'var(--surface)',
  fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13.5, color: 'var(--text-primary)', width: '100%',
  transition: 'border-color .15s ease, box-shadow .15s ease, background .15s ease',
};

export function TextInput({ value, onChange, placeholder, type = 'text', disabled = false, min, onKeyDown }) {
  return (
    <input
      type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} min={min} onKeyDown={onKeyDown}
      style={{ ...inputStyle, ...(disabled ? { background: 'var(--field-bg)', color: 'var(--text-muted)', cursor: 'not-allowed' } : {}) }}
    />
  );
}

export function TextArea({ value, onChange, placeholder, minHeight = 64 }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ ...inputStyle, minHeight, lineHeight: 1.6, resize: 'vertical' }}
    />
  );
}

export function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

export function Modal({ title, children, onClose, maxWidth = 400 }) {
  return (
    <div
      onClick={onClose}
      className="anim-fade"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,0,40,.5)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card-glass anim-pop"
        style={{
          borderRadius: 20, padding: '26px 28px', maxWidth, width: '100%', maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {title && <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, color: 'var(--heading)', marginBottom: 10 }}>{title}</div>}
        {children}
      </div>
    </div>
  );
}

// A right-anchored slide-over, for content that belongs alongside the page
// rather than interrupting it full-screen — sized to roughly a quarter of
// the viewport, clamped so it never feels cramped on a small screen or
// oversized on an ultra-wide one.
//
// Portaled straight to <body>: this is opened from inside Header, and
// Header's own backdrop-filter (the glass effect) makes it a new containing
// block for any `position: fixed` descendant — without the portal, this
// drawer's "fixed, inset: 0" backdrop gets trapped inside Header's own
// 68px-tall box instead of covering the viewport.
export function Drawer({ title, children, onClose, width = 'clamp(300px, 25vw, 420px)' }) {
  return createPortal(
    <div
      onClick={onClose}
      className="anim-fade"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,0,40,.5)',
        zIndex: 2000, display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="anim-slide-in"
        style={{
          background: 'var(--glass)', backdropFilter: 'blur(20px) saturate(160%)', WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          borderLeft: '1px solid var(--glass-border)', width, height: '100%',
          boxShadow: '-28px 0 64px -20px rgba(20,10,40,0.35), -10px 0 40px -14px rgba(124,58,237,0.4)',
          padding: '26px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column',
        }}
      >
        {title && <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, color: 'var(--heading)', marginBottom: 18 }}>{title}</div>}
        {children}
      </div>
    </div>,
    document.body,
  );
}

// Shared page-size everyone paginating a flat record list (Tasks, Daily
// Update History, etc.) slices against, so "10 rows per page" reads the
// same everywhere rather than being redeclared per page.
export const PAGE_SIZE = 10;

// Renders nothing for a single-page result — callers don't need to guard
// that themselves. `onChange` receives the next 1-indexed page number;
// callers own the page state and should clamp it back in range if the
// underlying (filtered) list shrinks out from under the current page.
export function Pagination({ page, totalItems, pageSize = PAGE_SIZE, onChange }) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  if (pageCount <= 1) return null;
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(totalItems, page * pageSize);
  const btnStyle = (disabled) => ({
    padding: '7px 14px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12.5,
    color: disabled ? 'var(--text-muted)' : 'var(--brand)',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1,
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12.5, color: 'var(--muted)' }}>
        Showing {start}–{end} of {totalItems}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button type="button" className="btn-3d btn-glass" disabled={page <= 1} onClick={() => onChange(page - 1)} style={btnStyle(page <= 1)}>← Prev</button>
        <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12.5, color: 'var(--text-primary)', padding: '0 4px' }}>
          Page {page} of {pageCount}
        </span>
        <button type="button" className="btn-3d btn-glass" disabled={page >= pageCount} onClick={() => onChange(page + 1)} style={btnStyle(page >= pageCount)}>Next →</button>
      </div>
    </div>
  );
}

export function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="anim-drop-in" style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--heading)', color: '#FFFFFF', padding: '12px 22px', borderRadius: 999,
      fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13.5,
      boxShadow: '0 10px 28px -10px rgba(0,0,0,0.35)', zIndex: 1000,
    }}>
      {message}
    </div>
  );
}

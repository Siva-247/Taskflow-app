import React from 'react';
import { STATUS, PRIORITY } from '../data/mockData.js';

export function Avatar({ initial, size = 32, gradient = false }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 999, flexShrink: 0,
      background: gradient ? 'linear-gradient(135deg,var(--accent-dark),var(--accent))' : 'var(--accent-dark)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: Math.round(size * 0.4), color: '#FFFFFF',
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
    <span style={{
      display: 'inline-block', padding: '4px 11px', borderRadius: 999,
      background: s.bg, color: s.color,
      fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5,
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
      fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11,
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
      <div style={{ width: `${value}%`, height: '100%', borderRadius: 999, background: color, transition: 'width .2s ease' }} />
    </div>
  );
}

export function Button({ variant = 'primary', children, onClick, style, type = 'button', disabled }) {
  const base = {
    padding: '10px 22px', borderRadius: 9, fontFamily: "'Manrope',system-ui,sans-serif",
    fontWeight: 700, fontSize: 13.5, border: '1px solid transparent', display: 'inline-flex',
    alignItems: 'center', gap: 7, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
  };
  const variants = {
    primary: { background: 'var(--accent)', color: '#FFFFFF' },
    secondary: { background: '#FFFFFF', border: '1px solid var(--border)', color: 'var(--text-secondary)' },
    accentOutline: { background: '#FFFFFF', border: '1px solid var(--border)', color: 'var(--accent-dark)' },
    danger: { background: 'var(--amber-fill)', color: '#FFFFFF' },
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

export function Card({ children, style, padded = true }) {
  return (
    <div style={{
      background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 14,
      boxShadow: 'var(--card-shadow)', padding: padded ? '24px 26px' : 0, ...style,
    }}>
      {children}
    </div>
  );
}

export function SectionLabel({ children, first }) {
  return (
    <div style={{ padding: first ? '20px 0 10px' : '26px 0 10px' }}>
      <div style={{
        fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5,
        letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent-dark)',
        borderTop: first ? 'none' : '1px solid var(--border)', paddingTop: first ? 0 : 20,
      }}>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, required, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
        {label} {required && <span style={{ color: 'var(--amber-text)' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  padding: '12px 15px', border: '1px solid var(--border)', borderRadius: 9, background: '#FFFFFF',
  fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-primary)', width: '100%',
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
      style={{ ...inputStyle, minHeight, lineHeight: 1.6, resize: 'vertical', fontFamily: "'Manrope',system-ui,sans-serif" }}
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

export function Modal({ title, children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(23,18,38,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#FFFFFF', borderRadius: 14, boxShadow: '0 28px 64px -20px rgba(20,10,40,0.4)', padding: '26px 28px', maxWidth: 400, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {title && <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 17, color: 'var(--heading)', marginBottom: 10 }}>{title}</div>}
        {children}
      </div>
    </div>
  );
}

// A right-anchored slide-over, for content that belongs alongside the page
// rather than interrupting it full-screen — sized to roughly a quarter of
// the viewport, clamped so it never feels cramped on a small screen or
// oversized on an ultra-wide one.
export function Drawer({ title, children, onClose, width = 'clamp(300px, 25vw, 420px)' }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(23,18,38,0.45)',
        zIndex: 2000, display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF', width, height: '100%', boxShadow: '-28px 0 64px -20px rgba(20,10,40,0.35)',
          padding: '26px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column',
        }}
      >
        {title && <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 17, color: 'var(--heading)', marginBottom: 18 }}>{title}</div>}
        {children}
      </div>
    </div>
  );
}

export function Toast({ message }) {
  if (!message) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--heading)', color: '#FFFFFF', padding: '12px 22px', borderRadius: 10,
      fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5,
      boxShadow: '0 10px 28px -10px rgba(0,0,0,0.35)', zIndex: 1000,
    }}>
      {message}
    </div>
  );
}

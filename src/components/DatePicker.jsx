import React, { useEffect, useRef, useState } from 'react';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n) => String(n).padStart(2, '0');
const toISO = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

function parseISO(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDisplay(iso) {
  const d = parseISO(iso);
  if (!d) return '';
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

const isSameDay = (a, y, m, d) => a && a.getFullYear() === y && a.getMonth() === m && a.getDate() === d;

// A fully custom calendar dropdown — native <input type="date"> pickers
// are rendered by the OS/browser and cannot be styled with CSS at all, so
// there was no way to theme them purple. Stores/emits the same yyyy-mm-dd
// string every date field in this app already reads and compares directly.
export default function DatePicker({ value, onChange, min, placeholder = 'Select date', disabled = false }) {
  const [open, setOpen] = useState(false);
  const selected = parseISO(value);
  const minDate = parseISO(min);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const base = selected || today;
  const [viewYear, setViewYear] = useState(base.getFullYear());
  const [viewMonth, setViewMonth] = useState(base.getMonth());
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const b = selected || today;
    setViewYear(b.getFullYear());
    setViewMonth(b.getMonth());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  const cells = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ day: prevMonthDays - i, muted: true, y, m });
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, muted: false, y: viewYear, m: viewMonth });
  const trailing = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= trailing; d++) {
    const m = viewMonth === 11 ? 0 : viewMonth + 1;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ day: d, muted: true, y, m });
  }

  const isDisabledDate = (y, m, d) => minDate && new Date(y, m, d) < minDate;

  const pick = (y, m, d) => {
    onChange(toISO(y, m, d));
    setOpen(false);
  };

  const goMonth = (delta) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; } else if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  };

  const goToday = () => {
    if (!isDisabledDate(today.getFullYear(), today.getMonth(), today.getDate())) {
      pick(today.getFullYear(), today.getMonth(), today.getDate());
    } else {
      setViewYear(today.getFullYear());
      setViewMonth(today.getMonth());
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        onClick={() => !disabled && setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%',
          padding: '12px 15px', border: '1px solid var(--date-accent)', borderRadius: 9,
          background: disabled ? 'var(--field-bg)' : 'var(--date-field-bg)', cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: open ? '0 0 0 3px rgba(186,85,211,0.35)' : 'none', transition: 'box-shadow 150ms ease, border-color 150ms ease',
        }}
      >
        <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 15.5, color: value ? 'var(--accent-dark)' : 'var(--text-muted)' }}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
          <rect x="2.5" y="4" width="15" height="13.5" rx="2.2" stroke="var(--date-accent)" strokeWidth="1.6" />
          <path d="M2.5 8h15" stroke="var(--date-accent)" strokeWidth="1.6" />
          <path d="M6.5 2.5v3M13.5 2.5v3" stroke="var(--date-accent)" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 30, width: 280,
          background: 'var(--date-soft)', border: '1px solid rgba(186,85,211,0.45)', borderRadius: 14,
          boxShadow: '0 16px 40px -14px rgba(124,58,237,0.35)', padding: '16px 16px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button type="button" onClick={() => goMonth(-1)} style={navBtnStyle}>‹</button>
            <span style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--heading)' }}>
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={() => goMonth(1)} style={navBtnStyle}>›</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
            {WEEKDAYS.map((w) => (
              <div key={w} style={{ textAlign: 'center', fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 10.5, color: 'var(--text-muted)', padding: '4px 0' }}>{w}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
            {cells.map((c, i) => {
              const isSelected = isSameDay(selected, c.y, c.m, c.day);
              const isToday = isSameDay(today, c.y, c.m, c.day);
              const disabledDay = c.muted || isDisabledDate(c.y, c.m, c.day);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabledDay}
                  onClick={() => pick(c.y, c.m, c.day)}
                  style={{
                    width: 32, height: 32, borderRadius: 999, border: isToday && !isSelected ? '1.5px solid var(--date-accent)' : '1.5px solid transparent',
                    background: isSelected ? 'var(--date-accent)' : 'transparent',
                    color: disabledDay ? 'var(--text-muted)' : isSelected ? '#FFFFFF' : 'var(--text-primary)',
                    opacity: c.muted ? 0.35 : 1, cursor: disabledDay ? 'not-allowed' : 'pointer',
                    fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: isSelected || isToday ? 700 : 500, fontSize: 13,
                    transition: 'background 120ms ease',
                  }}
                  onMouseEnter={(e) => { if (!disabledDay && !isSelected) e.currentTarget.style.background = 'rgba(186,85,211,0.3)'; }}
                  onMouseLeave={(e) => { if (!disabledDay && !isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  {c.day}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(186,85,211,0.35)' }}>
            <span onClick={() => { onChange(''); setOpen(false); }} style={linkStyle}>Clear</span>
            <span onClick={goToday} style={linkStyle}>Today</span>
          </div>
        </div>
      )}
    </div>
  );
}

const navBtnStyle = {
  width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer',
  fontSize: 16, color: 'var(--accent-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const linkStyle = {
  fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--accent-dark)', cursor: 'pointer',
};

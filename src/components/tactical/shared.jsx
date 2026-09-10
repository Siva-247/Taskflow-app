import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Shared building blocks between the Tactical Meeting Individual and Team
// views — same visual language (frosted cards, the violet categorical
// palette, one donut implementation), pulled out here specifically so
// Team View could be added later without redesigning or duplicating
// Individual View's pieces.

export const CHART_COLORS = ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)', 'var(--cat-5)', 'var(--cat-6)', 'var(--cat-7)', 'var(--cat-8)'];

function pad(n) { return String(n).padStart(2, '0'); }
export function toLocalISO(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function daysBack(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - (n - 1));
  return toLocalISO(d);
}
export function monthStart(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}
export function periodPresets(today) {
  return [
    { key: 'all', label: 'All Time' },
    { key: '7d', label: 'Last 7 Days', from: daysBack(today, 7), to: today },
    { key: '30d', label: 'Last 30 Days', from: daysBack(today, 30), to: today },
    { key: 'month', label: 'This Month', from: monthStart(today), to: today },
    { key: 'custom', label: 'Custom Range' },
  ];
}

export function FilterField({ label, children }) {
  return (
    <div className="filter-field" style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 170 }}>
      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 10.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</span>
      {children}
    </div>
  );
}

// A generic donut + legend — arbitrary number of segments (projects,
// milestones, reliability/health buckets), unlike Donut.jsx which is
// hardwired to Task's fixed 4-status shape.
export function GenericDonut({ segments, centerLabel, centerValue }) {
  const R = 46; const CIRC = 2 * Math.PI * R;
  const total = segments.reduce((s, seg) => s + seg.count, 0);
  let cursor = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: 112, height: 112, flexShrink: 0 }}>
        <svg width="112" height="112" viewBox="0 0 118 118" style={{ position: 'absolute', inset: 0 }}>
          <circle cx="59" cy="59" r={R} fill="none" stroke="var(--track-bg)" strokeWidth="13" />
          {total > 0 && segments.map((seg) => {
            const frac = seg.count / total;
            const len = frac * CIRC;
            const offset = -cursor * CIRC;
            cursor += frac;
            return (
              <circle
                key={seg.label} cx="59" cy="59" r={R} fill="none" stroke={seg.color} strokeWidth="13"
                strokeDasharray={`${len} ${CIRC}`} strokeDashoffset={offset} transform="rotate(-90 59 59)"
              />
            );
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'var(--heading)' }}>{centerValue}</div>
          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 9.5, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.2 }}>{centerLabel}</div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {segments.map((seg) => (
          <div key={seg.label} title={`${seg.label}: ${seg.pct}% (${seg.count})`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2.5, background: seg.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seg.label}</span>
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12, color: 'var(--heading)', flexShrink: 0 }}>{seg.pct}% <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({seg.count})</span></span>
          </div>
        ))}
        {total === 0 && <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)' }}>No data in this range.</div>}
      </div>
    </div>
  );
}

// A shared "activity over time" bar chart — used by both Individual View
// (one series: entries per bucket) and Team View (paired series: total vs
// completed per bucket). Column width scales with granularity specifically
// so a weekly bucket's longer range label ("Aug 10–16") never crowds into
// its neighbor — fixing that once here beats two copies of the same chart
// quietly drifting out of sync.
const TREND_COL_WIDTH = { daily: 38, weekly: 62, monthly: 54 };
export function TrendBarChart({ buckets, series, granularity = 'weekly', height = 140 }) {
  if (buckets.length === 0) return <EmptyNote>No activity logged in this range.</EmptyNote>;
  const max = Math.max(1, ...buckets.flatMap((b) => series.map((s) => b[s.key] || 0)));
  const colWidth = TREND_COL_WIDTH[granularity] || 48;
  const barAreaHeight = height - 34;
  return (
    <div>
      {series.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
          {series.map((s) => (
            <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-secondary)' }}>{s.label}</span>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height, overflowX: 'auto', paddingBottom: 2 }}>
        {buckets.map((b) => (
          <div key={b.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: '0 0 auto', width: colWidth }}>
            {series.length === 1 && (
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 11, color: 'var(--heading)' }}>{b[series[0].key]}</span>
            )}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: barAreaHeight }}>
              {series.map((s) => (
                <div
                  key={s.key} className="anim-scale-in" title={`${b.label} · ${s.label}: ${b[s.key] || 0}`}
                  style={{ width: series.length > 1 ? 16 : 22, height: Math.max(4, ((b[s.key] || 0) / max) * barAreaHeight), borderRadius: '5px 5px 2px 2px', background: s.color, cursor: 'default' }}
                />
              ))}
            </div>
            <span title={b.label} style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.25 }}>{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function KpiCard({ icon, value, label, tone }) {
  return (
    <div style={{
      padding: '16px 18px', borderRadius: 14, background: tone === 'danger' ? 'rgba(225,29,72,.08)' : 'var(--accent-soft)',
      display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 150px', minWidth: 140,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: tone === 'danger' ? 'rgba(225,29,72,.14)' : 'var(--surface-strong)',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: tone === 'danger' ? 'var(--red-deep)' : 'var(--heading)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
}

export function SectionTitle({ icon, children, trailing }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon}
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14.5, color: 'var(--heading)' }}>{children}</span>
      </div>
      {trailing}
    </div>
  );
}

// A checkbox-list multi-select — used by Team View's "Members" filter, where
// a plain <select> can't represent "more than one chosen". Portaled to
// <body> with `position: fixed` from the trigger's own getBoundingClientRect
// — same reasoning as DatePicker.jsx: an ancestor Card carries
// `backdrop-filter`, and Chromium clips any absolutely-positioned descendant
// to a backdrop-filter element's bounds, so the panel has to render outside
// that DOM subtree to avoid getting cut off.
export function MultiSelectField({ label, options, selected, onChange, allLabel = 'All' }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const reposition = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setCoords({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, 220) });
  };

  useEffect(() => {
    if (!open) return undefined;
    reposition();
    const handler = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange([...next]);
  };

  const summary = selected.length === 0
    ? allLabel
    : selected.length === 1
      ? (options.find((o) => o.value === selected[0])?.label || '1 selected')
      : `${selected.length} selected`;

  return (
    <FilterField label={label}>
      <div ref={triggerRef}>
        <div
          onClick={() => setOpen((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%',
            padding: '12px 15px', border: '1px solid var(--line)', borderRadius: 9, background: 'var(--field-bg)', cursor: 'pointer',
            boxShadow: open ? '0 0 0 3px rgba(124,58,237,0.2)' : 'none',
          }}
        >
          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13.5, color: selected.length ? 'var(--text-primary)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}><path d="M5 8l5 5 5-5" stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </div>

      {open && coords && createPortal(
        <div
          ref={panelRef}
          className="anim-modal-in"
          style={{
            position: 'fixed', top: coords.top, left: coords.left, width: coords.width, zIndex: 3000, maxHeight: 280, overflowY: 'auto',
            background: 'var(--surface-strong)', border: '1px solid var(--line)', borderRadius: 12,
            boxShadow: '0 16px 40px -14px rgba(124,58,237,0.35)', padding: 6,
          }}
        >
          <div
            onClick={() => onChange([])}
            style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12.5, color: selected.length === 0 ? 'var(--brand)' : 'var(--text-primary)' }}
          >
            {allLabel}
          </div>
          {options.map((opt) => (
            <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12.5, color: 'var(--text-primary)' }}>
              <input type="checkbox" checked={selected.includes(opt.value)} onChange={() => toggle(opt.value)} style={{ accentColor: 'var(--brand)' }} />
              {opt.label}
            </label>
          ))}
          {options.length === 0 && <div style={{ padding: '8px 10px', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)' }}>No members.</div>}
        </div>,
        document.body,
      )}
    </FilterField>
  );
}

export function EmptyNote({ children }) {
  return <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--text-muted)', padding: '10px 0' }}>{children}</div>;
}

const DAILY_STATUS_TONE = {
  Completed: { bg: 'var(--accent-soft)', fg: 'var(--green-deep)' },
  Pending: { bg: 'var(--amber-bg)', fg: 'var(--amber-text)' },
  Inprogress: { bg: 'var(--accent-soft)', fg: 'var(--accent-dark)' },
  Open: { bg: 'var(--surface)', fg: 'var(--text-secondary)' },
  Hold: { bg: 'var(--amber-bg)', fg: 'var(--amber-text)' },
  Cancelled: { bg: 'var(--surface)', fg: 'var(--text-muted)' },
};
export function DailyStatusPill({ status }) {
  const tone = DAILY_STATUS_TONE[status] || DAILY_STATUS_TONE.Open;
  return (
    <span style={{ padding: '3px 10px', borderRadius: 999, background: tone.bg, color: tone.fg, fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 11 }}>{status}</span>
  );
}

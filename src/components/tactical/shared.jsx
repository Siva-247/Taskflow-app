import React from 'react';

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
          <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2.5, background: seg.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seg.label}</span>
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12, color: 'var(--heading)' }}>{seg.pct}% <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({seg.count})</span></span>
          </div>
        ))}
        {total === 0 && <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)' }}>No data in this range.</div>}
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

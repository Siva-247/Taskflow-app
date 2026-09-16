import React from 'react';

// Horizontal underline tabs on desktop/tablet (scrolls sideways rather than
// wrapping, via the app's existing .tab-row-scroll class), collapsing to a
// plain <select> below 560px so the tab row never causes page-level
// horizontal overflow on a phone. Both are rendered; a scoped <style> block
// toggles which one is visible — no JS viewport detection needed.
export default function SettingsTabs({ tabs, active, onChange }) {
  return (
    <div className="settings-tabs-wrap">
      <style>{`
        .settings-tabs-select { display: none; }
        @media (max-width: 560px) {
          .settings-tabs-row { display: none !important; }
          .settings-tabs-select { display: block; }
        }
      `}</style>
      <div className="settings-tabs-row tab-row-scroll" style={{ borderBottom: '1px solid var(--border)' }}>
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
                padding: '10px 4px 12px', marginRight: 22,
                fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 13.5,
                color: isActive ? 'var(--accent-dark)' : 'var(--text-secondary)',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'color 0.15s ease, border-color 0.15s ease',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <select
        className="settings-tabs-select"
        value={active}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 9,
          background: 'var(--field-bg)', fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 13.5,
          color: 'var(--accent-dark)', appearance: 'none',
        }}
      >
        {tabs.map((t) => (
          <option key={t.key} value={t.key}>{t.label}</option>
        ))}
      </select>
    </div>
  );
}

import React, { useState } from 'react';
import { IconTarget, IconUser, IconUsersGroup } from '../components/icons.jsx';
import IndividualTacticalView from '../components/tactical/IndividualTacticalView.jsx';
import TeamTacticalView from '../components/tactical/TeamTacticalView.jsx';

// The page shell: header + the Individual/Team segmented toggle, mounting
// whichever view is active. Each view is self-contained (own filters, own
// fetch) — this file only owns the toggle and the hand-off when Team View's
// performance table asks to open one specific person in Individual View.
export default function TacticalMeeting() {
  const [viewMode, setViewMode] = useState('individual');
  const [pendingIndividualId, setPendingIndividualId] = useState(null);
  // Bumped on every hand-off so IndividualTacticalView remounts even when
  // the same person is picked twice in a row (a fresh mount is what makes
  // its useState(initialSelectedId) initializer re-run at all).
  const [individualKey, setIndividualKey] = useState(0);
  // Tracks whether the current Individual View visit was reached via a Team
  // View row click (vs. the plain toggle) — only then does the contextual
  // "← Back to Team View" link make sense.
  const [cameFromTeamView, setCameFromTeamView] = useState(false);

  const openMember = (memberId) => {
    setPendingIndividualId(memberId);
    setIndividualKey((k) => k + 1);
    setCameFromTeamView(true);
    setViewMode('individual');
  };

  const backToTeamView = () => {
    setCameFromTeamView(false);
    setViewMode('team');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--brand-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IconTarget size={20} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--heading)' }}>Tactical Meeting</div>
            <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12.5, color: 'var(--text-secondary)' }}>Track · Review · Discuss · Drive Results</div>
          </div>
        </div>

        <div className="btn-3d btn-glass" style={{ display: 'flex', padding: 4, gap: 2, borderRadius: 999 }}>
          <button
            type="button" onClick={() => { setCameFromTeamView(false); setViewMode('individual'); }}
            className={`tab-pill${viewMode === 'individual' ? ' active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', border: 0, background: 'transparent', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
          >
            <IconUser size={14} color={viewMode === 'individual' ? '#FFFFFF' : 'currentColor'} />
            Individual View
          </button>
          <button
            type="button" onClick={() => setViewMode('team')}
            className={`tab-pill${viewMode === 'team' ? ' active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', border: 0, background: 'transparent', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
          >
            <IconUsersGroup size={14} color={viewMode === 'team' ? '#FFFFFF' : 'currentColor'} />
            Team View
          </button>
        </div>
      </div>

      {viewMode === 'individual' ? (
        <IndividualTacticalView
          key={individualKey}
          initialSelectedId={pendingIndividualId}
          onBackToTeamView={cameFromTeamView ? backToTeamView : undefined}
        />
      ) : (
        <TeamTacticalView onSelectMember={openMember} />
      )}
    </div>
  );
}

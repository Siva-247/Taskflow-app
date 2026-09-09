import React from 'react';
import { Card, Avatar, DailyStatusBadge, DAILY_STATUS_COLOR } from './ui.jsx';
import { IconLayers } from './icons.jsx';

// A grid of project "cards" rather than another row-table — the dashboards
// already lean heavily on tables, so this widget is deliberately shaped
// differently (a board, closer to a kanban tile) to stand out as its own
// kind of summary rather than blending into the surrounding lists. Fed
// entirely from AppContext's `currentProjects` (see GET /daily-updates/projects),
// which derives every project purely from the free-text "Project" field on
// the Daily Update form/log — this component only decides how to lay out
// whatever that endpoint hands it.
//
// Capped to the most recently-active few rather than every active project —
// a dashboard widget, not a full listing — with a "+N more" line so nothing
// is silently hidden.
const MAX_VISIBLE = 6;

function relativeDate(iso, today) {
  if (!iso) return '';
  const days = Math.round((new Date(today) - new Date(iso)) / 86400000);
  if (days <= 0) return 'Updated today';
  if (days === 1) return 'Updated yesterday';
  return `Updated ${days} days ago`;
}

function ProjectCard({ project, today, showDepartment }) {
  const stripe = (DAILY_STATUS_COLOR[project.latestStatus] || DAILY_STATUS_COLOR.Open).color;
  return (
    <div style={{
      position: 'relative', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 16px 14px 18px',
      background: '#FFFFFF', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: stripe }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 14.5, color: 'var(--heading)', lineHeight: 1.3 }}>{project.project}</div>
        <DailyStatusBadge status={project.latestStatus} />
      </div>

      {showDepartment && project.departmentName && (
        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 11, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 6 }}>
          {project.departmentName}
        </div>
      )}

      {project.latestMilestone && (
        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 10 }}>
          On {project.latestMilestone}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
        <div style={{ display: 'flex' }}>
          {project.contributors.slice(0, 4).map((c, i) => (
            <div key={c.id} style={{ marginLeft: i === 0 ? 0 : -8, border: '2px solid #FFFFFF', borderRadius: 999 }}>
              <Avatar initial={c.name?.[0] || '?'} size={24} />
            </div>
          ))}
          {project.contributors.length > 4 && (
            <div style={{
              marginLeft: -8, width: 24, height: 24, borderRadius: 999, border: '2px solid #FFFFFF', background: 'var(--neutral-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 10, color: 'var(--text-muted)',
            }}>
              +{project.contributors.length - 4}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 11.5, color: 'var(--text-muted)' }}>
          {project.updateCount} update{project.updateCount === 1 ? '' : 's'}
          <div>{relativeDate(project.latestDate, today)}</div>
        </div>
      </div>
    </div>
  );
}

function ProjectGrid({ projects, today, showDepartment }) {
  const visible = projects.slice(0, MAX_VISIBLE);
  const hidden = projects.length - visible.length;
  return (
    <>
      <div className="responsive-grid" style={{ display: 'grid', '--cols': 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
        {visible.map((p) => <ProjectCard key={`${p.departmentId}::${p.project}`} project={p} today={today} showDepartment={showDepartment} />)}
      </div>
      {hidden > 0 && (
        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
          +{hidden} more active project{hidden === 1 ? '' : 's'} not shown here
        </div>
      )}
    </>
  );
}

// `groupByDepartment` is what makes the Admin/Super Admin view read as
// "particular departments" rather than one undifferentiated pile — every
// other role's `projects` already comes back scoped to a single team/
// department, so grouping would just make a pointless single section.
export default function CurrentProjectsBoard({ title, projects, today, groupByDepartment = false }) {
  if (groupByDepartment) {
    const byDept = new Map();
    for (const p of projects) {
      const key = p.departmentId || 'none';
      if (!byDept.has(key)) byDept.set(key, { name: p.departmentName || 'Unassigned', items: [] });
      byDept.get(key).items.push(p);
    }
    const sections = [...byDept.values()].sort((a, b) => a.name.localeCompare(b.name));

    return (
      <Card>
        <Header title={title} count={projects.length} />
        {sections.length === 0 && <EmptyState />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, marginTop: sections.length ? 18 : 0 }}>
          {sections.map((section) => (
            <div key={section.name}>
              <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 12.5, color: 'var(--text-primary)', marginBottom: 10 }}>
                {section.name} · {section.items.length}
              </div>
              <ProjectGrid projects={section.items} today={today} showDepartment={false} />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <Header title={title} count={projects.length} />
      {projects.length === 0 ? <EmptyState /> : <div style={{ marginTop: 18 }}><ProjectGrid projects={projects} today={today} showDepartment={false} /></div>}
    </Card>
  );
}

function Header({ title, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <IconLayers size={17} color="var(--accent)" />
      <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>{title}</div>
      <div style={{
        marginLeft: 'auto', fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: 'var(--accent-dark)',
        background: 'var(--accent-soft)', padding: '3px 10px', borderRadius: 999,
      }}>
        {count} active
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)', padding: '18px 0 4px' }}>
      No projects currently in progress.
    </div>
  );
}

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Avatar, Button } from '../ui.jsx';
import SearchFilterBar from './SearchFilterBar.jsx';
import { IconPlusCircle, IconX } from '../icons.jsx';

const FLAT_SHADOW = '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)';

// Members tab: the full company roster grouped by department — same data
// AddEmployeeModal/editUser/deleteUser already power elsewhere, just laid
// out here instead of on its own page. `focusLabel`/`onClearFocus` back the
// "View Team"/"View Department" jump from the other tabs — landing here
// pinned to just that team or department until explicitly cleared, rather
// than silently reusing the free-text search box (which can't express
// "this department" for a department whose name isn't a substring of any
// of its members' own names). `canResetPassword` is off for a Manager, who
// never had that capability via the old Employees page either.
export default function MembersSection({
  memberGroups, search, onSearchChange, onAddEmployee, roleLabel,
  onEdit, onResetPassword, onDeactivate, onReactivate, onDelete, hasAnyDepartments,
  subtitle = 'Every department across the company.', canResetPassword = true,
  focusLabel, onClearFocus,
}) {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 16.5, color: 'var(--heading)' }}>Members</div>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
            {subtitle}
          </div>
        </div>
        <Button onClick={onAddEmployee}>
          <IconPlusCircle size={15} color="#FFFFFF" /> Add employee
        </Button>
      </div>

      {focusLabel && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          padding: '9px 14px', background: 'var(--accent-soft)', borderRadius: 9,
        }}>
          <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 12.5, color: 'var(--accent-dark)' }}>
            Showing members of {focusLabel}
          </span>
          <span onClick={onClearFocus} title="Clear" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 12, color: 'var(--accent-dark)' }}>
            <IconX size={12} color="var(--accent-dark)" /> Clear
          </span>
        </div>
      )}

      <SearchFilterBar search={search} onSearchChange={onSearchChange} placeholder="Search employees..." />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {memberGroups.map(({ dept, people }) => (
          <Card key={dept.id} padded={false} style={{ boxShadow: FLAT_SHADOW, border: '1px solid var(--border)' }}>
            <div style={{ padding: '16px 20px 4px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 15, color: 'var(--heading)' }}>{dept.name}</div>
              <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>{people.length} member{people.length === 1 ? '' : 's'}</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 800 }}>
                <div className="table-head-brand" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 0.7fr 0.9fr 1.2fr', padding: '10px 20px', marginTop: 8 }}>
                  {['Employee', 'Team', 'Role', 'Assigned', 'Completed', 'Status'].map((h) => (
                    <div key={h} style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{h}</div>
                  ))}
                </div>
                {people.map((row, i) => {
                  const isActive = row.user.isActive === undefined || !!row.user.isActive;
                  return (
                    <div
                      key={row.user.id}
                      onClick={() => navigate(`/tasks?assignee=${row.user.id}`)}
                      style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 0.7fr 0.9fr 1.2fr', padding: '13px 20px', alignItems: 'center', borderTop: '1px solid var(--border)', borderBottom: i === people.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', opacity: isActive ? 1 : 0.55 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar initial={row.user.initial} size={26} />
                        <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{row.user.name}</span>
                      </div>
                      <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>{row.team?.name || '—'}</div>
                      <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>{roleLabel(row.user)}</div>
                      <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--heading)' }}>{row.assigned}</div>
                      <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--heading)' }}>{row.completed}</div>
                      <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                        <span onClick={() => onEdit(row.user)} style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: 'var(--accent-dark)', cursor: 'pointer' }}>Edit</span>
                        {canResetPassword && (
                          <span onClick={() => onResetPassword(row.user)} style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: 'var(--accent-dark)', cursor: 'pointer' }}>Reset password</span>
                        )}
                        {isActive ? (
                          <span onClick={() => onDeactivate(row.user)} style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: 'var(--green-text, #1F7A44)', cursor: 'pointer' }}>● Active</span>
                        ) : (
                          <span onClick={() => onReactivate(row.user)} style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: 'var(--amber-text)', cursor: 'pointer' }}>● Inactive — Reactivate</span>
                        )}
                        <span onClick={() => onDelete(row.user)} style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: 'var(--text-muted)', cursor: 'pointer' }}>Delete</span>
                      </div>
                    </div>
                  );
                })}
                {people.length === 0 && (
                  <div style={{ padding: '22px', textAlign: 'center', fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 13, color: 'var(--text-muted)' }}>
                    No one in this department yet.
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
        {memberGroups.length === 0 && (
          <Card style={{ boxShadow: FLAT_SHADOW, border: '1px solid var(--border)' }}>
            <div style={{ textAlign: 'center', fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)' }}>
              {hasAnyDepartments ? 'No members match your search.' : 'No departments yet.'}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

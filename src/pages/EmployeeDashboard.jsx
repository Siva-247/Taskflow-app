import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { STATUS, ROLES } from '../data/mockData.js';
import { Card, PriorityBadge, Button, TextArea } from '../components/ui.jsx';
import { IconCheck, IconComment, IconPlus, IconCalendar } from '../components/icons.jsx';
import { useRoleGuard } from '../hooks/useRoleGuard.js';

export default function EmployeeDashboard() {
  const { currentUser, scopedTasks, submitForReview, addComment, TODAY } = useApp();
  const navigate = useNavigate();
  const allowed = useRoleGuard(ROLES.EMPLOYEE);
  const [openCommentTaskId, setOpenCommentTaskId] = useState(null);
  const [commentDraft, setCommentDraft] = useState('');
  if (!allowed) return null;

  const toggleCommentBox = (taskId) => {
    setCommentDraft('');
    setOpenCommentTaskId((prev) => (prev === taskId ? null : taskId));
  };

  const postComment = (taskId) => {
    if (!commentDraft.trim()) return;
    addComment(taskId, currentUser.id, commentDraft);
    setCommentDraft('');
    setOpenCommentTaskId(null);
  };

  const myTasks = scopedTasks(currentUser).filter((t) => t.status !== STATUS.DRAFT);
  const done = myTasks.filter((t) => t.status === STATUS.COMPLETED).length;
  const activeTasks = myTasks.filter((t) => t.status !== STATUS.COMPLETED).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  const overdueCount = activeTasks.filter((t) => t.dueDate < TODAY).length;
  const inProgressCount = activeTasks.length - overdueCount;
  const nextDeadline = activeTasks.find((t) => t.dueDate >= TODAY);

  const openTasks = activeTasks.slice(0, 4);

  const markedTasks = myTasks.filter((t) => t.marks != null).sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1));
  const averageMarks = markedTasks.length ? Math.round(markedTasks.reduce((sum, t) => sum + t.marks, 0) / markedTasks.length) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>Good Morning, {currentUser.name} 👋</div>
          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Here's your work for today.</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '11px 20px', background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--card-shadow)' }}>
          <StatChip value={myTasks.length} label="tasks" color="var(--heading)" />
          <Divider />
          <StatChip value={done} label="done" color="var(--accent-dark)" />
          <Divider />
          <StatChip value={inProgressCount} label="active" color="var(--accent-mid)" />
          <Divider />
          <StatChip value={overdueCount} label="overdue" color="var(--amber-text)" />
          {averageMarks != null && (
            <>
              <Divider />
              <StatChip value={`${averageMarks}%`} label="avg marks" color="var(--accent-dark)" />
            </>
          )}
        </div>
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 16.5, color: 'var(--heading)' }}>My tasks</div>
          <div onClick={() => navigate('/tasks')} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--accent-dark)' }}>View all</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {openTasks.map((task, i) => (
            <div key={task.id} style={{ padding: '20px 0', borderTop: '1px solid var(--border)', marginTop: i === 0 ? 16 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ cursor: 'pointer' }} onClick={() => navigate(`/tasks/${task.id}`)}>
                  <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 16, color: 'var(--text-primary)' }}>{task.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 8 }}>
                    <PriorityBadge priority={task.priority} />
                    <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-muted)' }}>
                      {task.dueDate === TODAY ? 'Due today' : `Due ${task.dueDate.slice(5)}`}
                    </span>
                  </div>
                </div>
                <Button variant={task.status === STATUS.TODO ? 'secondary' : 'primary'} onClick={() => navigate(`/tasks/${task.id}`)} style={{ padding: '8px 20px', fontSize: 13 }}>
                  {task.status === STATUS.PENDING_APPROVAL ? 'View' : task.status === STATUS.TODO ? 'Start' : 'Update Progress'}
                </Button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
                <span style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 15, color: 'var(--heading)' }}>{task.progress}%</span>
                <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-muted)', marginLeft: 8 }}>{task.status}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
                {(() => {
                  const locked = task.status === STATUS.IN_REVIEW || task.status === STATUS.COMPLETED || task.status === STATUS.PENDING_APPROVAL;
                  return (
                    <span
                      onClick={() => !locked && submitForReview(task.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5,
                        color: locked ? 'var(--text-muted)' : 'var(--accent-dark)',
                        cursor: locked ? 'default' : 'pointer',
                      }}
                    >
                      <IconCheck size={13} color={locked ? 'var(--text-muted)' : 'var(--accent-dark)'} />
                      {task.status === STATUS.PENDING_APPROVAL ? 'Awaiting approval' : task.status === STATUS.IN_REVIEW ? 'Submitted' : 'Submit for review'}
                    </span>
                  );
                })()}
                <span onClick={() => toggleCommentBox(task.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <IconComment size={13} />
                  {openCommentTaskId === task.id ? 'Cancel' : 'Add comment'}
                </span>
              </div>
              {openCommentTaskId === task.id && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <TextArea value={commentDraft} onChange={setCommentDraft} placeholder="Write a comment..." minHeight={48} />
                  <div>
                    <Button variant="secondary" style={{ padding: '7px 18px', fontSize: 12.5 }} disabled={!commentDraft.trim()} onClick={() => postComment(task.id)}>
                      Post comment
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {openTasks.length === 0 && (
            <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)', padding: '20px 0' }}>All caught up — no open tasks.</div>
          )}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.85fr 0.85fr', gap: 20 }}>
        <Card>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>Today's work update</div>
          <div style={{ marginTop: 13, padding: '13px 16px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--field-bg)', minHeight: 46, display: 'flex', alignItems: 'center' }}>
            <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-muted)' }}>What did you work on today?</span>
          </div>
          <Button onClick={() => navigate('/daily-update')} style={{ marginTop: 13 }}>
            <IconPlus size={13} /> Add daily update
          </Button>
        </Card>

        <Card>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>Upcoming deadlines</div>
          {nextDeadline ? (
            <div onClick={() => navigate(`/tasks/${nextDeadline.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, cursor: 'pointer' }}>
              <IconCalendar size={16} color="var(--amber-text)" />
              <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-primary)' }}>
                {nextDeadline.title} — {nextDeadline.dueDate.slice(5)}
              </span>
            </div>
          ) : (
            <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)', marginTop: 16 }}>Nothing coming up.</div>
          )}
        </Card>

        <Card>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>My marks</div>
          {markedTasks.length === 0 ? (
            <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)', marginTop: 16 }}>No marks yet.</div>
          ) : (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>Average</span>
                <span style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 15, color: 'var(--accent-dark)' }}>{averageMarks}%</span>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: markedTasks.length ? 14 : 0 }}>
            {markedTasks.slice(0, 3).map((t, i) => (
              <div
                key={t.id}
                onClick={() => navigate(`/tasks/${t.id}`)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderTop: i === 0 ? '1px solid var(--border)' : '1px solid var(--border)', cursor: 'pointer' }}
              >
                <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                <span style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--heading)', flexShrink: 0 }}>{t.marks}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatChip({ value, label, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 17, color }}>{value}</span>
      <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 11.5, color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 18, background: 'var(--border)' }} />;
}

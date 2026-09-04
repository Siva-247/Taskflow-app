import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { ROLES } from '../data/mockData.js';
import { Card, Button, Modal, PriorityBadge } from '../components/ui.jsx';
import { roleHome } from '../utils.js';

export default function Drafts() {
  const { currentUser, users, myDrafts, deleteTask, publishDraft, showToast } = useApp();
  const navigate = useNavigate();
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const canCreate = currentUser.role === ROLES.TEAM_LEAD || currentUser.role === ROLES.MANAGER || currentUser.role === ROLES.EMPLOYEE;
  const needsApproval = currentUser.role === ROLES.TEAM_LEAD || currentUser.role === ROLES.EMPLOYEE;

  useEffect(() => {
    if (!canCreate) {
      showToast('Only Team Leads, Managers, and Employees have drafts');
      navigate(roleHome(currentUser.role));
    }
  }, [canCreate]);

  if (!canCreate) return null;

  const drafts = myDrafts(currentUser.id);

  const handleDeleteConfirm = () => {
    deleteTask(pendingDeleteId, { isDraft: true });
    setPendingDeleteId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 26, color: 'var(--heading)' }}>Drafts</div>
          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 16, color: 'var(--text-secondary)', marginTop: 4 }}>
            Tasks you've started but haven't assigned yet — not counted in your active task stats.
          </div>
        </div>
        <Button onClick={() => navigate('/tasks/new')}>New task</Button>
      </div>

      <Card padded={false}>
        {drafts.length === 0 && (
          <div style={{ padding: '40px 22px', textAlign: 'center', fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 15.5, color: 'var(--text-muted)' }}>
            No drafts saved. Start a task and choose "Save draft" to come back to it later.
          </div>
        )}
        {drafts.map((task, i) => {
          const assignee = users.find((u) => u.id === task.assigneeId);
          return (
            <div
              key={task.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '18px 22px',
                borderBottom: i < drafts.length - 1 ? '1px solid var(--border)' : 'none', flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 220 }}>
                <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 17, color: 'var(--text-primary)' }}>
                  {task.title || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Untitled draft</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <PriorityBadge priority={task.priority} />
                  <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 14.5, color: 'var(--text-muted)' }}>
                    {assignee ? `For ${assignee.name}` : 'No assignee chosen yet'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Button variant="secondary" style={{ padding: '8px 16px', fontSize: 14.5 }} onClick={() => navigate(`/tasks/new/${task.id}`)}>
                  Continue editing
                </Button>
                <Button
                  variant="primary" style={{ padding: '8px 16px', fontSize: 14.5 }}
                  disabled={!task.title.trim() || !task.description.trim() || !task.assigneeId || !task.startDate || !task.dueDate || task.dueDate < task.startDate}
                  onClick={() => publishDraft(task.id)}
                >
                  {needsApproval ? 'Submit for approval' : 'Assign as task'}
                </Button>
                <Button variant="danger" style={{ padding: '8px 16px', fontSize: 14.5 }} onClick={() => setPendingDeleteId(task.id)}>
                  Delete
                </Button>
              </div>
            </div>
          );
        })}
      </Card>

      {pendingDeleteId && (
        <Modal title="Delete this draft?" onClose={() => setPendingDeleteId(null)}>
          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 15.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            This can't be undone. The draft will be permanently removed.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={() => setPendingDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDeleteConfirm}>Delete draft</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

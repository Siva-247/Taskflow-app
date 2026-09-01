import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { Card, Field, TextInput, TextArea, Select, Button, StatusBadge, Modal } from '../components/ui.jsx';
import { formatDate } from '../utils.js';

const STATUS_OPTIONS = ['Completed', 'In Progress'];

export default function DailyUpdate() {
  const { currentUser, dailyUpdates, scopedTasks, addDailyUpdate, editDailyUpdate, deleteDailyUpdate, TODAY, showToast } = useApp();
  const navigate = useNavigate();

  const myTasks = scopedTasks(currentUser);

  const [editingId, setEditingId] = useState(null);
  const [date, setDate] = useState(TODAY);
  const [taskId, setTaskId] = useState('');
  const [status, setStatus] = useState('Completed');
  const [taskCompleted, setTaskCompleted] = useState('');
  const [conceptsCovered, setConceptsCovered] = useState('');
  const [practicalTask, setPracticalTask] = useState('');
  const [videosCompleted, setVideosCompleted] = useState('');
  const [videoLink, setVideoLink] = useState('');
  const [errors, setErrors] = useState({});
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const myUpdates = dailyUpdates.filter((u) => u.userId === currentUser.id);
  const todaysUpdate = myUpdates.find((u) => u.date === TODAY);
  // Once today's update exists, the create form is never shown again for
  // today — only editing the existing entry, so a second row can't be made.
  const showForm = !todaysUpdate || Boolean(editingId);

  const resetForm = () => {
    setEditingId(null); setDate(TODAY); setTaskId('');
    setTaskCompleted(''); setConceptsCovered(''); setPracticalTask(''); setVideosCompleted(''); setVideoLink('');
    setErrors({});
  };

  const startEdit = (u) => {
    setEditingId(u.id);
    setDate(u.date);
    setTaskId(u.taskId || '');
    setStatus(u.status);
    setTaskCompleted(u.taskCompleted);
    setConceptsCovered(u.conceptsCovered || '');
    setPracticalTask(u.practicalTask || '');
    setVideosCompleted(u.videosCompleted ? String(u.videosCompleted) : '');
    setVideoLink(u.videoLink || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    const e = {};
    if (!date) e.date = true;
    if (!taskCompleted.trim()) e.taskCompleted = true;
    if (Object.keys(e).length) {
      setErrors(e);
      showToast('Fill in the required fields first');
      return;
    }
    const linkedTask = myTasks.find((t) => t.id === taskId);
    const payload = {
      taskId: linkedTask?.id || null, taskTitle: linkedTask?.title || '', status, taskCompleted: taskCompleted.trim(),
      conceptsCovered: conceptsCovered.trim(), practicalTask: practicalTask.trim(),
      videosCompleted: Number(videosCompleted) || 0, videoLink: videoLink.trim(),
    };
    try {
      if (editingId) {
        await editDailyUpdate(editingId, payload);
        resetForm();
      } else {
        await addDailyUpdate({ userId: currentUser.id, date, ...payload });
        resetForm();
        navigate(currentUser.role === 'team_lead' ? '/team-lead' : '/employee');
      }
    } catch {
      // context already surfaced a toast for the failure
    }
  };

  const handleDeleteConfirm = async () => {
    await deleteDailyUpdate(pendingDeleteId);
    if (editingId === pendingDeleteId) resetForm();
    setPendingDeleteId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>{editingId ? 'Edit daily work update' : 'Daily work update'}</div>
        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>{editingId ? "You can only edit today's update." : todaysUpdate ? "You've already submitted today — edit it below if anything needs to change." : 'Log what you worked on today'}</div>
      </div>

      {showForm && (
        <Card style={{ maxWidth: 760 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
            <Field label="Date" required>
              <TextInput type="date" value={date} onChange={setDate} disabled={Boolean(editingId)} />
            </Field>
            <Field label="Related task">
              <Select value={taskId} onChange={setTaskId} options={[{ value: '', label: '— None —' }, ...myTasks.map((t) => ({ value: t.id, label: t.title }))]} />
            </Field>
          </div>

          <div style={{ height: 18 }} />
          <Field label="Task completed" required>
            <TextArea value={taskCompleted} onChange={setTaskCompleted} placeholder="What did you finish today?" minHeight={56} />
          </Field>
          {errors.taskCompleted && <ErrorText>This field is required.</ErrorText>}

          <div style={{ height: 18 }} />
          <Field label="Concepts covered">
            <TextArea value={conceptsCovered} onChange={setConceptsCovered} placeholder="What did you learn?" minHeight={56} />
          </Field>

          <div style={{ height: 18 }} />
          <Field label="Practical task">
            <TextArea value={practicalTask} onChange={setPracticalTask} placeholder="What did you build or practice?" minHeight={56} />
          </Field>

          <div style={{ height: 18 }} />
          <Field label="Status" required>
            <Select value={status} onChange={setStatus} options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))} />
          </Field>

          <div style={{ height: 18 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
            <Field label="No. of videos completed">
              <TextInput type="number" value={videosCompleted} onChange={setVideosCompleted} placeholder="0" />
            </Field>
            <Field label="Video link">
              <TextInput value={videoLink} onChange={setVideoLink} placeholder="training.internal/..." />
            </Field>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 26 }}>
            <Button variant="secondary" onClick={() => (editingId ? resetForm() : navigate(-1))}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit}>{editingId ? 'Save changes' : 'Submit update'}</Button>
          </div>
        </Card>
      )}

      {todaysUpdate && !editingId && (
        <Card style={{ maxWidth: 760 }} padded={false}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 26px 4px' }}>
            <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>Today's update</div>
            <span onClick={() => navigate('/daily-updates')} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--accent-dark)', cursor: 'pointer' }}>View full history</span>
          </div>
          <div style={{ padding: '14px 26px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{formatDate(todaysUpdate.date)}{todaysUpdate.taskTitle && <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}> · {todaysUpdate.taskTitle}</span>}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <StatusBadge status={todaysUpdate.status} />
                <span onClick={() => startEdit(todaysUpdate)} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 11.5, color: 'var(--accent-dark)', cursor: 'pointer' }}>Edit</span>
                <span onClick={() => setPendingDeleteId(todaysUpdate.id)} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 11.5, color: 'var(--amber-text)', cursor: 'pointer' }}>Delete</span>
              </div>
            </div>
            <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{todaysUpdate.taskCompleted}</div>
            {todaysUpdate.videosCompleted > 0 && (
              <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{todaysUpdate.videosCompleted} video{todaysUpdate.videosCompleted === 1 ? '' : 's'}{todaysUpdate.videoLink ? ` · ${todaysUpdate.videoLink}` : ''}</div>
            )}
          </div>
        </Card>
      )}

      {pendingDeleteId && (
        <Modal title="Delete this update?" onClose={() => setPendingDeleteId(null)}>
          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            This can't be undone.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={() => setPendingDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDeleteConfirm}>Delete update</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ErrorText({ children }) {
  return <div style={{ marginTop: 6, fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{children}</div>;
}

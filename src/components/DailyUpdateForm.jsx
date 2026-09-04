import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { Modal, Field, TextInput, TextArea, Select, Button } from './ui.jsx';

const STATUS_OPTIONS = ['Completed', 'In Progress'];

// Always today's entry — if one already exists it opens pre-filled for
// editing (still gated server-side to the same day), otherwise it opens
// blank. Closes itself (via onClose) as soon as the save succeeds.
export default function DailyUpdateForm({ onClose }) {
  const { currentUser, dailyUpdates, scopedTasks, addDailyUpdate, editDailyUpdate, TODAY, showToast } = useApp();

  const myTasks = scopedTasks(currentUser);
  const todaysUpdate = dailyUpdates.find((u) => u.userId === currentUser.id && u.date === TODAY);
  const editingId = todaysUpdate?.id || null;

  const [taskId, setTaskId] = useState(todaysUpdate?.taskId || '');
  const [status, setStatus] = useState(todaysUpdate?.status || 'Completed');
  const [taskCompleted, setTaskCompleted] = useState(todaysUpdate?.taskCompleted || '');
  const [conceptsCovered, setConceptsCovered] = useState(todaysUpdate?.conceptsCovered || '');
  const [practicalTask, setPracticalTask] = useState(todaysUpdate?.practicalTask || '');
  const [videosCompleted, setVideosCompleted] = useState(todaysUpdate?.videosCompleted ? String(todaysUpdate.videosCompleted) : '');
  const [videoLink, setVideoLink] = useState(todaysUpdate?.videoLink || '');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!taskCompleted.trim()) {
      setErrors({ taskCompleted: true });
      showToast('Fill in the required fields first');
      return;
    }
    const linkedTask = myTasks.find((t) => t.id === taskId);
    const payload = {
      taskId: linkedTask?.id || null, taskTitle: linkedTask?.title || '', status, taskCompleted: taskCompleted.trim(),
      conceptsCovered: conceptsCovered.trim(), practicalTask: practicalTask.trim(),
      videosCompleted: Number(videosCompleted) || 0, videoLink: videoLink.trim(),
    };
    setSaving(true);
    try {
      if (editingId) await editDailyUpdate(editingId, payload);
      else await addDailyUpdate({ userId: currentUser.id, date: TODAY, ...payload });
      onClose();
    } catch {
      // context already surfaced a toast for the failure
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={editingId ? "Edit today's update" : "Today's update"} onClose={onClose} maxWidth={480}>
      <Field label="Related task">
        <Select value={taskId} onChange={setTaskId} options={[{ value: '', label: '— None —' }, ...myTasks.map((t) => ({ value: t.id, label: t.title }))]} />
      </Field>

      <div style={{ height: 16 }} />
      <Field label="Task completed" required>
        <TextArea value={taskCompleted} onChange={setTaskCompleted} placeholder="What did you finish today?" minHeight={56} />
      </Field>
      {errors.taskCompleted && <ErrorText>This field is required.</ErrorText>}

      <div style={{ height: 16 }} />
      <Field label="Concepts covered">
        <TextArea value={conceptsCovered} onChange={setConceptsCovered} placeholder="What did you learn?" minHeight={56} />
      </Field>

      <div style={{ height: 16 }} />
      <Field label="Practical task">
        <TextArea value={practicalTask} onChange={setPracticalTask} placeholder="What did you build or practice?" minHeight={56} />
      </Field>

      <div style={{ height: 16 }} />
      <Field label="Status" required>
        <Select value={status} onChange={setStatus} options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))} />
      </Field>

      <div style={{ height: 16 }} />
      <div className="responsive-grid" style={{ display: 'grid', '--cols': '1fr 1fr', gap: 16 }}>
        <Field label="No. of videos completed">
          <TextInput type="number" value={videosCompleted} onChange={setVideosCompleted} placeholder="0" />
        </Field>
        <Field label="Video link">
          <TextInput value={videoLink} onChange={setVideoLink} placeholder="training.internal/..." />
        </Field>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={saving}>{editingId ? 'Save changes' : 'Submit update'}</Button>
      </div>
    </Modal>
  );
}

function ErrorText({ children }) {
  return <div style={{ marginTop: 6, fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--amber-text)' }}>{children}</div>;
}

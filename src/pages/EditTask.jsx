import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { ROLES, PRIORITY, CATEGORIES, STATUS } from '../data/mockData.js';
import { Card, SectionLabel, Field, TextInput, TextArea, Select, Button, Modal, Avatar } from '../components/ui.jsx';
import { roleHome } from '../utils.js';

export default function EditTask() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { currentUser, users, tasks, updateTask, showToast, TODAY } = useApp();

  const task = tasks.find((t) => t.id === taskId);
  const canManage = task && (currentUser.id === task.createdBy || currentUser.role === ROLES.ADMIN);

  useEffect(() => {
    if (task && !canManage) {
      showToast('You do not have permission to edit this task');
      navigate(`/tasks/${taskId}`);
    }
    if (!task) {
      showToast('That task could not be found');
      navigate(roleHome(currentUser.role));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, canManage]);

  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [category, setCategory] = useState(task?.category || CATEGORIES[0]);
  const [subtasks, setSubtasks] = useState(task?.subtasks || []);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [priority, setPriority] = useState(task?.priority || PRIORITY.MEDIUM);
  const [estimatedEffort, setEstimatedEffort] = useState(task?.estimatedEffort || '');
  const [startDate, setStartDate] = useState(task?.startDate || '');
  const [dueDate, setDueDate] = useState(task?.dueDate || '');
  const [instructions, setInstructions] = useState(task?.instructions || '');
  const [errors, setErrors] = useState({});
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const pristine = useMemo(() => JSON.stringify({
    title: task?.title || '', description: task?.description || '', category: task?.category || CATEGORIES[0],
    subtasks: task?.subtasks || [], priority: task?.priority || PRIORITY.MEDIUM, estimatedEffort: task?.estimatedEffort || '',
    startDate: task?.startDate || '', dueDate: task?.dueDate || '', instructions: task?.instructions || '',
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [taskId]);

  const isDirty = pristine !== JSON.stringify({ title, description, category, subtasks, priority, estimatedEffort, startDate, dueDate, instructions });

  if (!task || !canManage) return null;

  const assignee = users.find((u) => u.id === task.assigneeId);

  const addSubtask = () => {
    if (!subtaskDraft.trim()) return;
    setSubtasks((prev) => [...prev, { id: `st-${Date.now()}`, title: subtaskDraft.trim(), done: false }]);
    setSubtaskDraft('');
  };

  const removeSubtask = (id) => setSubtasks((prev) => prev.filter((s) => s.id !== id));
  const toggleSubtaskDone = (id) => setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s)));

  const validate = () => {
    const e = {};
    if (!title.trim()) e.title = true;
    if (!description.trim()) e.description = true;
    if (!startDate) e.startDate = true;
    if (!dueDate) e.dueDate = true;
    if (startDate && startDate < TODAY) e.startInPast = true;
    if (startDate && dueDate && dueDate < startDate) e.dateRange = true;
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      showToast(e.dateRange ? "Due date can't be before the start date" : e.startInPast ? "Start date can't be in the past" : 'Fill in the required fields first');
      return;
    }
    try {
      await updateTask(task.id, {
        title: title.trim(), description: description.trim(), category, priority, estimatedEffort, startDate, dueDate,
        instructions: instructions.trim(), subtasks,
      });
      navigate(`/tasks/${task.id}`);
    } catch {
      // context already surfaced a toast for the failure
    }
  };

  const handleCancelClick = () => {
    if (isDirty) setShowDiscardConfirm(true);
    else navigate(`/tasks/${task.id}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>Edit task</div>
        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
          Update the details — the assignee stays fixed once a task is live.
        </div>
      </div>

      <Card style={{ padding: '8px 32px 28px', maxWidth: 880 }}>
        <SectionLabel first>Task basics</SectionLabel>

        <Field label="Task title" required>
          <TextInput value={title} onChange={setTitle} placeholder="e.g. Implement Login API" />
        </Field>
        {errors.title && <ErrorText>Task title is required.</ErrorText>}

        <div style={{ height: 18 }} />
        <Field label="Description" required>
          <TextArea value={description} onChange={setDescription} placeholder="What needs to be done?" minHeight={64} />
        </Field>
        {errors.description && <ErrorText>Description is required.</ErrorText>}

        <div style={{ height: 18 }} />
        <Field label="Milestone">
          <Select value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
        </Field>

        <SectionLabel>Assignment &amp; priority</SectionLabel>
        <div className="responsive-grid" style={{ display: 'grid', '--cols': '1fr 1fr 1fr', gap: 22 }}>
          <Field label="Assigned to">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 15px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--field-bg)' }}>
              <Avatar initial={assignee?.initial} size={20} />
              <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>{assignee?.name}</span>
            </div>
          </Field>
          <Field label="Priority" required>
            <Select value={priority} onChange={setPriority} options={Object.values(PRIORITY).map((p) => ({ value: p, label: p }))} />
          </Field>
          <Field label="Estimated effort">
            <TextInput value={estimatedEffort} onChange={setEstimatedEffort} placeholder="e.g. 6 hours" />
          </Field>
        </div>

        <SectionLabel>Schedule</SectionLabel>
        <div className="responsive-grid" style={{ display: 'grid', '--cols': '1fr 1fr', gap: 22 }}>
          <Field label="Start date" required>
            <TextInput type="date" value={startDate} onChange={setStartDate} min={TODAY} />
          </Field>
          <Field label="Due date" required>
            <TextInput type="date" value={dueDate} onChange={setDueDate} min={startDate || TODAY} />
          </Field>
        </div>
        {errors.startInPast && <ErrorText>Start date can't be in the past.</ErrorText>}
        {errors.dateRange && <ErrorText>Due date can't be before the start date.</ErrorText>}

        <SectionLabel>Additional details</SectionLabel>
        <Field label="Instructions">
          <TextArea value={instructions} onChange={setInstructions} placeholder="Anything the assignee should know" minHeight={50} />
        </Field>

        <div style={{ height: 18 }} />
        <Field label="Subtasks">
          <div style={{ border: '1px solid var(--border)', borderRadius: 9, background: '#FFFFFF', padding: subtasks.length ? '4px 15px' : 0 }}>
            {subtasks.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <input type="checkbox" checked={s.done} onChange={() => toggleSubtaskDone(s.id)} style={{ width: 15, height: 15, accentColor: 'var(--accent)' }} />
                <span style={{ flex: 1, fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-primary)' }}>{s.title}</span>
                <span onClick={() => removeSubtask(s.id)} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>Remove</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: subtasks.length ? 10 : 0 }}>
            <div style={{ flex: 1 }}>
              <TextInput value={subtaskDraft} onChange={setSubtaskDraft} placeholder="Add a subtask..." />
            </div>
            <Button variant="secondary" onClick={addSubtask}>Add</Button>
          </div>
        </Field>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 26 }}>
          <Button variant="secondary" onClick={handleCancelClick}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Save changes</Button>
        </div>
      </Card>

      {showDiscardConfirm && (
        <Modal title="Discard changes?" onClose={() => setShowDiscardConfirm(false)}>
          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            You have unsaved changes on this task. If you leave now, they'll be lost.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={() => setShowDiscardConfirm(false)}>Continue Editing</Button>
            <Button variant="danger" onClick={() => navigate(`/tasks/${task.id}`)}>Discard</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ErrorText({ children }) {
  return <div style={{ marginTop: 6, fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{children}</div>;
}

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { ROLES, PRIORITY, CATEGORIES } from '../data/mockData.js';
import { Modal, Field, TextInput, TextArea, Select, Button } from './ui.jsx';

const OTHER_CATEGORY = '__other__';

// The common "create a fresh task" path, as a popup from the Tasks page —
// draft save/resume stays a full-page flow (via /tasks/new and Drafts),
// this covers the everyday case of filling it in once and sending it off.
export default function CreateTaskModal({ onClose }) {
  const { currentUser, users, tasks, createTask, TODAY, showToast } = useApp();
  const navigate = useNavigate();

  const needsApproval = currentUser.role === ROLES.TEAM_LEAD || currentUser.role === ROLES.EMPLOYEE;

  const assignableUsers = users.filter((u) => {
    if (u.role !== ROLES.EMPLOYEE) return false;
    if (currentUser.role === ROLES.TEAM_LEAD) return u.teamId === currentUser.teamId;
    if (currentUser.role === ROLES.MANAGER) return u.departmentId === currentUser.departmentId;
    if (currentUser.role === ROLES.EMPLOYEE) return u.id === currentUser.id;
    return false;
  });

  const allCategories = useMemo(
    () => [...new Set([...CATEGORIES, ...tasks.map((t) => t.category).filter(Boolean)])],
    [tasks],
  );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categorySelection, setCategorySelection] = useState(CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const category = categorySelection === OTHER_CATEGORY ? customCategory.trim() : categorySelection;
  const [subtasks, setSubtasks] = useState([]);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [assigneeId, setAssigneeId] = useState(assignableUsers[0]?.id || '');
  const [priority, setPriority] = useState(PRIORITY.MEDIUM);
  const [estimatedEffort, setEstimatedEffort] = useState('');
  const [startDate, setStartDate] = useState(TODAY);
  const [dueDate, setDueDate] = useState('');
  const [instructions, setInstructions] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const addSubtask = () => {
    if (!subtaskDraft.trim()) return;
    setSubtasks((prev) => [...prev, { id: `st-${Date.now()}`, title: subtaskDraft.trim(), done: false }]);
    setSubtaskDraft('');
  };
  const removeSubtask = (id) => setSubtasks((prev) => prev.filter((s) => s.id !== id));

  const resolveTeamId = () => {
    const assignee = users.find((u) => u.id === assigneeId);
    return currentUser.teamId || assignee?.teamId;
  };

  const validate = () => {
    const e = {};
    if (!title.trim()) e.title = true;
    if (!description.trim()) e.description = true;
    if (!assigneeId) e.assigneeId = true;
    if (!startDate) e.startDate = true;
    if (!dueDate) e.dueDate = true;
    if (startDate && startDate < TODAY) e.startInPast = true;
    if (startDate && dueDate && dueDate < startDate) e.dateRange = true;
    if (categorySelection === OTHER_CATEGORY && !customCategory.trim()) e.category = true;
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      showToast(e.dateRange ? "Due date can't be before the start date" : e.startInPast ? "Start date can't be in the past" : 'Fill in the required fields first');
      return;
    }
    setSaving(true);
    try {
      const task = await createTask({
        title: title.trim(), description: description.trim(), category, teamId: resolveTeamId(),
        assigneeId, priority, estimatedEffort, startDate, dueDate, subtasks, instructions: instructions.trim(),
        createdBy: currentUser.id,
      });
      onClose();
      navigate(`/tasks/${task.id}`);
    } catch {
      // context already surfaced a toast for the failure
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Create task" onClose={onClose} maxWidth={640}>
      <Field label="Task title" required>
        <TextInput value={title} onChange={setTitle} placeholder="e.g. Implement Login API" />
      </Field>
      {errors.title && <ErrorText>Task title is required.</ErrorText>}

      <div style={{ height: 16 }} />
      <Field label="Description" required>
        <TextArea value={description} onChange={setDescription} placeholder="What needs to be done?" minHeight={56} />
      </Field>
      {errors.description && <ErrorText>Description is required.</ErrorText>}

      <div style={{ height: 16 }} />
      <Field label="Milestone">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Select
            value={categorySelection}
            onChange={setCategorySelection}
            options={[...allCategories.map((c) => ({ value: c, label: c })), { value: OTHER_CATEGORY, label: 'Other — type your own' }]}
          />
          {categorySelection === OTHER_CATEGORY && (
            <TextInput value={customCategory} onChange={setCustomCategory} placeholder="Enter a milestone" />
          )}
        </div>
      </Field>
      {errors.category && <ErrorText>Enter a milestone, or pick one from the list.</ErrorText>}

      <div style={{ height: 16 }} />
      <div className="responsive-grid" style={{ display: 'grid', '--cols': currentUser.role === ROLES.EMPLOYEE ? '1fr 1fr' : '1fr 1fr 1fr', gap: 16 }}>
        {currentUser.role !== ROLES.EMPLOYEE && (
          <Field label="Assign to" required>
            <div style={{ ...(errors.assigneeId ? { borderRadius: 9, border: '1px solid var(--amber-fill)' } : {}) }}>
              <Select value={assigneeId} onChange={setAssigneeId} options={assignableUsers.map((u) => ({ value: u.id, label: `${u.name} · ${u.title}` }))} />
            </div>
          </Field>
        )}
        <Field label="Priority" required>
          <Select value={priority} onChange={setPriority} options={Object.values(PRIORITY).map((p) => ({ value: p, label: p }))} />
        </Field>
        <Field label="Estimated effort">
          <TextInput value={estimatedEffort} onChange={setEstimatedEffort} placeholder="e.g. 6 hours" />
        </Field>
      </div>

      <div style={{ height: 16 }} />
      <div className="responsive-grid" style={{ display: 'grid', '--cols': '1fr 1fr', gap: 16 }}>
        <Field label="Start date" required>
          <TextInput type="date" value={startDate} onChange={setStartDate} min={TODAY} />
        </Field>
        <Field label="Due date" required>
          <TextInput type="date" value={dueDate} onChange={setDueDate} min={startDate || TODAY} />
        </Field>
      </div>
      {errors.startInPast && <ErrorText>Start date can't be in the past.</ErrorText>}
      {errors.dateRange && <ErrorText>Due date can't be before the start date.</ErrorText>}

      <div style={{ height: 16 }} />
      <Field label="Instructions">
        <TextArea value={instructions} onChange={setInstructions} placeholder="Anything the assignee should know" minHeight={44} />
      </Field>

      <div style={{ height: 16 }} />
      <Field label="Subtasks">
        <div style={{ border: '1px solid var(--border)', borderRadius: 9, background: '#FFFFFF', padding: subtasks.length ? '4px 15px' : 0 }}>
          {subtasks.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={saving}>{needsApproval ? 'Submit for approval' : 'Assign task'}</Button>
      </div>
    </Modal>
  );
}

function ErrorText({ children }) {
  return <div style={{ marginTop: 6, fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{children}</div>;
}

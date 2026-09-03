import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { ROLES, PRIORITY, CATEGORIES, STATUS } from '../data/mockData.js';
import { Card, SectionLabel, Field, TextInput, TextArea, Select, Button, Modal } from '../components/ui.jsx';
import { roleHome } from '../utils.js';

const OTHER_CATEGORY = '__other__';

export default function CreateTask() {
  const { currentUser, users, tasks, createTask, updateTask, TODAY, showToast } = useApp();
  const navigate = useNavigate();
  const { draftId } = useParams();

  const draft = draftId ? tasks.find((t) => t.id === draftId && t.status === STATUS.DRAFT && t.createdBy === currentUser.id) : null;
  const isEditingDraft = Boolean(draftId);

  const canCreate = currentUser.role === ROLES.TEAM_LEAD || currentUser.role === ROLES.MANAGER || currentUser.role === ROLES.EMPLOYEE;
  // A Team Lead's or Employee's own task creation needs their manager's
  // sign-off before it becomes actionable — a Manager creating one directly
  // doesn't, since nobody above them needs to check it.
  const needsApproval = currentUser.role === ROLES.TEAM_LEAD || currentUser.role === ROLES.EMPLOYEE;

  useEffect(() => {
    if (!canCreate) {
      showToast('Only Team Leads, Managers, and Employees can create tasks');
      navigate(roleHome(currentUser.role));
    }
  }, [canCreate]);

  useEffect(() => {
    if (isEditingDraft && !draft) {
      showToast('That draft could not be found');
      navigate('/drafts');
    }
  }, [isEditingDraft, draft]);

  // Team Leads only ever see their own team; the Manager sees every
  // employee/intern across the department but never another Team Lead —
  // task assignment stays inside the reporting line. An Employee can only
  // ever create a task for themselves.
  const assignableUsers = users.filter((u) => {
    if (u.role !== ROLES.EMPLOYEE) return false;
    if (currentUser.role === ROLES.TEAM_LEAD) return u.teamId === currentUser.teamId;
    if (currentUser.role === ROLES.MANAGER) return u.departmentId === currentUser.departmentId;
    if (currentUser.role === ROLES.EMPLOYEE) return u.id === currentUser.id;
    return false;
  });

  // The fixed list plus any custom category someone already typed in on a
  // past task, so a one-off "Other" entry becomes pickable again later
  // instead of needing to be retyped every time.
  const allCategories = useMemo(
    () => [...new Set([...CATEGORIES, ...tasks.map((t) => t.category).filter(Boolean)])],
    [tasks],
  );

  const [title, setTitle] = useState(draft?.title || '');
  const [description, setDescription] = useState(draft?.description || '');
  const draftCategoryIsCustom = draft?.category && !allCategories.includes(draft.category);
  const [categorySelection, setCategorySelection] = useState(
    draftCategoryIsCustom ? OTHER_CATEGORY : (draft?.category || CATEGORIES[0]),
  );
  const [customCategory, setCustomCategory] = useState(draftCategoryIsCustom ? draft.category : '');
  const category = categorySelection === OTHER_CATEGORY ? customCategory.trim() : categorySelection;
  const [subtasks, setSubtasks] = useState(draft?.subtasks || []);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [assigneeId, setAssigneeId] = useState(draft?.assigneeId || assignableUsers[0]?.id || '');
  const [priority, setPriority] = useState(draft?.priority || PRIORITY.MEDIUM);
  const [estimatedEffort, setEstimatedEffort] = useState(draft?.estimatedEffort || '');
  const [startDate, setStartDate] = useState(draft?.startDate || TODAY);
  const [dueDate, setDueDate] = useState(draft?.dueDate || '');
  const [instructions, setInstructions] = useState(draft?.instructions || '');
  const [errors, setErrors] = useState({});
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Snapshot of the form as it was loaded, so Cancel can tell whether the
  // user actually changed anything before showing the discard confirmation.
  const pristine = useMemo(() => JSON.stringify({
    title: draft?.title || '', description: draft?.description || '', category: draft?.category || CATEGORIES[0],
    subtasks: draft?.subtasks || [], assigneeId: draft?.assigneeId || assignableUsers[0]?.id || '',
    priority: draft?.priority || PRIORITY.MEDIUM, estimatedEffort: draft?.estimatedEffort || '',
    startDate: draft?.startDate || TODAY, dueDate: draft?.dueDate || '', instructions: draft?.instructions || '',
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [draftId]);

  const isDirty = pristine !== JSON.stringify({ title, description, category, subtasks, assigneeId, priority, estimatedEffort, startDate, dueDate, instructions });

  if (!canCreate) return null;
  if (isEditingDraft && !draft) return null;

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

  const buildPayload = () => ({
    title: title.trim(),
    description: description.trim(),
    category,
    teamId: resolveTeamId(),
    assigneeId,
    priority,
    estimatedEffort,
    startDate,
    dueDate,
    subtasks,
    instructions: instructions.trim(),
    createdBy: currentUser.id,
  });

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

  const handleSaveDraft = async () => {
    if (!title.trim()) {
      setErrors({ title: true });
      return;
    }
    try {
      if (isEditingDraft) {
        await updateTask(draft.id, buildPayload());
      } else {
        await createTask({ ...buildPayload(), isDraft: true });
      }
      navigate('/drafts');
    } catch {
      // context already surfaced a toast for the failure
    }
  };

  const handleAssign = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      showToast(e.dateRange ? "Due date can't be before the start date" : e.startInPast ? "Start date can't be in the past" : 'Fill in the required fields first');
      return;
    }
    try {
      if (isEditingDraft) {
        await updateTask(draft.id, { ...buildPayload(), status: STATUS.TODO });
        navigate(`/tasks/${draft.id}`);
      } else {
        const task = await createTask(buildPayload());
        navigate(`/tasks/${task.id}`);
      }
    } catch {
      // context already surfaced a toast for the failure
    }
  };

  const cancelDestination = isEditingDraft ? '/drafts' : roleHome(currentUser.role);

  const handleCancelClick = () => {
    if (isDirty) setShowDiscardConfirm(true);
    else navigate(cancelDestination);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>
          {isEditingDraft ? 'Edit draft' : 'Create new task'}
        </div>
        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
          {isEditingDraft
            ? 'Continue where you left off, then assign it or save it again.'
            : (currentUser.role === ROLES.EMPLOYEE ? 'Create a task for yourself — your team lead or manager will need to approve it first' : 'Assign a task to a member of your team')}
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

        <SectionLabel>Assignment &amp; priority</SectionLabel>
        <div className="responsive-grid" style={{ display: 'grid', '--cols': currentUser.role === ROLES.EMPLOYEE ? '1fr 1fr' : '1fr 1fr 1fr', gap: 22 }}>
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

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, flexWrap: 'wrap', gap: 10 }}>
          <span onClick={() => navigate('/drafts')} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--accent-dark)', cursor: 'pointer' }}>
            View drafts
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={handleCancelClick}>Cancel</Button>
            <Button variant="accentOutline" onClick={handleSaveDraft}>Save draft</Button>
            <Button variant="primary" onClick={handleAssign}>{needsApproval ? 'Submit for approval' : 'Assign task'}</Button>
          </div>
        </div>
      </Card>

      {showDiscardConfirm && (
        <Modal title="Discard changes?" onClose={() => setShowDiscardConfirm(false)}>
          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            You have unsaved changes on this task. If you leave now, they'll be lost.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={() => setShowDiscardConfirm(false)}>Continue Editing</Button>
            <Button variant="danger" onClick={() => navigate(cancelDestination)}>Discard</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ErrorText({ children }) {
  return <div style={{ marginTop: 6, fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{children}</div>;
}

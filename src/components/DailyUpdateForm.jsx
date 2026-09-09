import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { DAILY_MILESTONES, DAILY_UPDATE_STATUSES, BLOCKER_STATUS } from '../data/mockData.js';
import { Modal, Field, TextInput, TextArea, Select, Button } from './ui.jsx';
import DatePicker from './DatePicker.jsx';
const OPEN_BLOCKER_STATUSES = [BLOCKER_STATUS.RESOLVED, BLOCKER_STATUS.CLOSED];
const friendlyBlockerId = (b) => `BLK-${String(b.seq).padStart(4, '0')}`;

// Always today's entry — if one already exists it opens pre-filled for
// editing (still gated server-side to the same day), otherwise it opens
// blank. Closes itself (via onClose) as soon as the save succeeds.
//
// Second revision of the field set (Task ID/Department/Project/Milestone/
// Task/Deliverable/Assignee/Priority/Start Date/Due Date/Status/Actual
// Close Date/Blocker/Resources) — but Department, Assignee, Priority, and
// Start Date are deliberately absent from this form entirely, not just
// auto-filled: Department/Assignee still come from the session server-side
// (same as userId always has), while Priority/Start Date are snapshotted
// server-side FROM the linked task (see routes/dailyUpdates.js) rather than
// asked for here at all — with no task linked, they simply stay blank.
// Task ID and Actual Close Date likewise have nothing to show pre-save (a
// sequence number and a status-driven timestamp). All of the above still
// show up correctly in DailyUpdateHistory's own columns.
export default function DailyUpdateForm({ onClose }) {
  const { currentUser, dailyUpdates, blockers, scopedTasks, addDailyUpdate, editDailyUpdate, TODAY, showToast } = useApp();

  const myTasks = scopedTasks(currentUser);
  const todaysUpdate = dailyUpdates.find((u) => u.userId === currentUser.id && u.date === TODAY);
  const editingId = todaysUpdate?.id || null;

  const [taskId, setTaskId] = useState(todaysUpdate?.taskId || '');
  const linkedTask = myTasks.find((t) => t.id === taskId) || null;

  const milestoneIsCustom = todaysUpdate?.milestone && !DAILY_MILESTONES.includes(todaysUpdate.milestone);
  const [milestoneSelection, setMilestoneSelection] = useState(
    milestoneIsCustom ? 'Other' : (todaysUpdate?.milestone || DAILY_MILESTONES[0]),
  );
  const [customMilestone, setCustomMilestone] = useState(milestoneIsCustom ? todaysUpdate.milestone : '');
  const milestone = milestoneSelection === 'Other' ? customMilestone.trim() : milestoneSelection;

  const [project, setProject] = useState(todaysUpdate?.project || '');
  const [taskCompleted, setTaskCompleted] = useState(todaysUpdate?.taskCompleted || '');
  const [deliverables, setDeliverables] = useState(todaysUpdate?.deliverables || '');
  const [dueDate, setDueDate] = useState(todaysUpdate?.dueDate || '');
  const [status, setStatus] = useState(todaysUpdate?.status || 'Completed');
  const [resources, setResources] = useState(todaysUpdate?.resources || '');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // A blocker "belongs" to this entry if it's raised against the same linked
  // task and still active — mirrors BlockerRegisterModal's own open/closed
  // split, read here rather than typed in.
  const linkedBlocker = taskId
    ? blockers.find((b) => b.linkedTaskId === taskId && !OPEN_BLOCKER_STATUSES.includes(b.status))
    : null;

  const handleSubmit = async () => {
    const e = {};
    if (!taskCompleted.trim()) e.taskCompleted = true;
    if (milestoneSelection === 'Other' && !customMilestone.trim()) e.milestone = true;
    if (Object.keys(e).length > 0) {
      setErrors(e);
      showToast('Fill in the required fields first');
      return;
    }
    const payload = {
      taskId: linkedTask?.id || null, taskTitle: linkedTask?.title || '', status, taskCompleted: taskCompleted.trim(),
      milestone, project: project.trim(), deliverables: deliverables.trim(),
      dueDate: dueDate || null, resources: resources.trim(),
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
    <Modal title={editingId ? "Edit today's update" : "Today's update"} onClose={onClose} maxWidth={500}>
      <Field label="Linked task">
        <Select value={taskId} onChange={setTaskId} options={[{ value: '', label: '— None —' }, ...myTasks.map((t) => ({ value: t.id, label: t.title }))]} />
      </Field>

      <div style={{ height: 16 }} />
      <div className="responsive-grid" style={{ display: 'grid', '--cols': '1fr 1fr', gap: 16 }}>
        <Field label="Milestone" required>
          <Select value={milestoneSelection} onChange={setMilestoneSelection} options={DAILY_MILESTONES.map((m) => ({ value: m, label: m }))} />
        </Field>
        <Field label="Project">
          <TextInput value={project} onChange={setProject} placeholder="e.g. Login App" />
        </Field>
      </div>
      {milestoneSelection === 'Other' && (
        <>
          <div style={{ height: 12 }} />
          <Field label="Describe the milestone" required>
            <TextInput value={customMilestone} onChange={setCustomMilestone} placeholder="e.g. Deployment" />
          </Field>
        </>
      )}
      {errors.milestone && <ErrorText>Describe the milestone.</ErrorText>}

      <div style={{ height: 16 }} />
      <Field label="Task" required>
        <TextArea value={taskCompleted} onChange={setTaskCompleted} placeholder="What did you finish today?" minHeight={56} />
      </Field>
      {errors.taskCompleted && <ErrorText>This field is required.</ErrorText>}

      <div style={{ height: 16 }} />
      <Field label="Deliverable">
        <TextInput value={deliverables} onChange={setDeliverables} placeholder="What did this produce? e.g. a page, a link, a doc" />
      </Field>

      <div style={{ height: 16 }} />
      <div className="responsive-grid" style={{ display: 'grid', '--cols': '1fr 1fr', gap: 16 }}>
        <Field label="Due date">
          <DatePicker value={dueDate} onChange={setDueDate} min={TODAY} />
        </Field>
        <Field label="Status" required>
          <Select value={status} onChange={setStatus} options={DAILY_UPDATE_STATUSES.map((s) => ({ value: s, label: s }))} />
        </Field>
      </div>

      <div style={{ height: 16 }} />
      <AutoField label="Blocker" value={linkedBlocker ? friendlyBlockerId(linkedBlocker) : '— none'} tag={linkedBlocker ? 'From linked task' : undefined} />

      <div style={{ height: 16 }} />
      <Field label="Resources">
        <TextInput value={resources} onChange={setResources} placeholder="Link to code, deployed site, demo video..." />
      </Field>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={saving}>{editingId ? 'Save changes' : 'Submit update'}</Button>
      </div>
    </Modal>
  );
}

// A read-only value the person can't edit — the linked task's Blocker (if
// it has an open one) is derived from context rather than typed in.
function AutoField({ label, value, tag }) {
  return (
    <Field label={label}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        padding: '12px 15px', border: '1px dashed var(--border)', borderRadius: 9, background: 'var(--neutral-bg)',
      }}>
        <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 13.5, color: 'var(--text-secondary)' }}>{value}</span>
        {tag && (
          <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{tag}</span>
        )}
      </div>
    </Field>
  );
}

function ErrorText({ children }) {
  return <div style={{ marginTop: 6, fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{children}</div>;
}

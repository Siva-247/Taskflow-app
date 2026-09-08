import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { BLOCKER_STATUS, BLOCKER_CATEGORIES, ESCALATION_LEVELS } from '../data/mockData.js';
import { Modal, Field, TextInput, TextArea, Select, Button } from './ui.jsx';
import DatePicker from './DatePicker.jsx';

const CLOSED_STATUSES = [BLOCKER_STATUS.RESOLVED, BLOCKER_STATUS.CLOSED];
// 'Other' in the fixed list acts as a sentinel, same as CreateTask.jsx's
// OTHER_CATEGORY handling for a task's milestone — picking it reveals a text
// box, and whatever's typed there becomes the actual stored category, not
// the literal word "Other".
const isKnownCategory = (c) => BLOCKER_CATEGORIES.includes(c);

// One component, two modes: raising a brand-new blocker (no `blocker` prop)
// or editing/resolving an existing one (`blocker` passed in) — mirrors
// CreateTaskModal's validate/handleSubmit/saving shape. Status, Closed Date,
// and Resolution Note only make sense once a blocker already exists, so
// they're edit-mode-only fields.
export default function RaiseBlockerModal({ onClose, blocker }) {
  const { currentUser, departments, scopedTasks, blockerDirectory, addBlocker, editBlocker, TODAY, showToast } = useApp();
  const isEdit = Boolean(blocker);

  const myDepartment = departments.find((d) => d.id === currentUser.departmentId);
  const linkableTasks = scopedTasks(currentUser).filter((t) => t.status !== 'Draft');

  const [linkedTaskId, setLinkedTaskId] = useState(blocker?.linkedTaskId || '');
  const [project, setProject] = useState(blocker?.project || myDepartment?.name || '');
  const [raisedDate] = useState(blocker?.raisedDate || TODAY);
  // A stored category outside the fixed list (an earlier custom "Other"
  // entry) reopens as "Other" with that text pre-filled, so it stays visible
  // and editable rather than silently falling back to the first option.
  const blockerHasCustomCategory = blocker && !isKnownCategory(blocker.category);
  const [categorySelection, setCategorySelection] = useState(
    blockerHasCustomCategory ? 'Other' : (blocker?.category || BLOCKER_CATEGORIES[0]),
  );
  const [customCategory, setCustomCategory] = useState(blockerHasCustomCategory ? blocker.category : '');
  const category = categorySelection === 'Other' ? customCategory.trim() : categorySelection;
  const [description, setDescription] = useState(blocker?.description || '');
  const [blockingWhat, setBlockingWhat] = useState(blocker?.blockingWhat || '');
  const [ownerToResolveId, setOwnerToResolveId] = useState(blocker?.ownerToResolveId || '');
  const [targetResolution, setTargetResolution] = useState(blocker?.targetResolution || '');
  const [escalationLevel, setEscalationLevel] = useState(blocker?.escalationLevel || ESCALATION_LEVELS[0]);
  const [status, setStatus] = useState(blocker?.status || BLOCKER_STATUS.OPEN);
  const [closedDate, setClosedDate] = useState(blocker?.closedDate || '');
  const [resolutionNote, setResolutionNote] = useState(blocker?.resolutionNote || '');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const showClosureFields = isEdit && CLOSED_STATUSES.includes(status);

  const validate = () => {
    const e = {};
    if (!description.trim()) e.description = true;
    if (!blockingWhat.trim()) e.blockingWhat = true;
    if (!category) e.category = true;
    if (!escalationLevel) e.escalationLevel = true;
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      showToast('Fill in the required fields first');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        linkedTaskId: linkedTaskId || null,
        project: project.trim(),
        raisedDate,
        category,
        description: description.trim(),
        blockingWhat: blockingWhat.trim(),
        ownerToResolveId: ownerToResolveId || null,
        targetResolution: targetResolution || null,
        escalationLevel,
      };
      if (isEdit) {
        Object.assign(payload, {
          status,
          closedDate: showClosureFields ? (closedDate || TODAY) : null,
          resolutionNote: resolutionNote.trim(),
        });
        await editBlocker(blocker.id, payload);
      } else {
        await addBlocker(payload);
      }
      onClose();
    } catch {
      // context already surfaced a toast for the failure
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Update blocker' : 'Raise a blocker'} onClose={onClose} maxWidth={640}>
      <Field label="Description" required>
        <TextArea value={description} onChange={setDescription} placeholder="What's blocked, and why?" minHeight={56} />
      </Field>
      {errors.description && <ErrorText>Description is required.</ErrorText>}

      <div style={{ height: 16 }} />
      <Field label="Blocking what" required>
        <TextArea value={blockingWhat} onChange={setBlockingWhat} placeholder="What work can't move forward until this is resolved?" minHeight={44} />
      </Field>
      {errors.blockingWhat && <ErrorText>Blocking what is required.</ErrorText>}

      <div style={{ height: 16 }} />
      <div className="responsive-grid" style={{ display: 'grid', '--cols': '1fr 1fr', gap: 16 }}>
        <Field label="Category" required>
          <Select value={categorySelection} onChange={setCategorySelection} options={BLOCKER_CATEGORIES.map((c) => ({ value: c, label: c }))} />
        </Field>
        <Field label="Escalation level" required>
          <Select value={escalationLevel} onChange={setEscalationLevel} options={ESCALATION_LEVELS.map((l) => ({ value: l, label: l }))} />
        </Field>
      </div>
      {categorySelection === 'Other' && (
        <>
          <div style={{ height: 12 }} />
          <Field label="Describe the category" required>
            <TextInput value={customCategory} onChange={setCustomCategory} placeholder="e.g. Vendor delay" />
          </Field>
        </>
      )}
      {errors.category && <ErrorText>Category is required.</ErrorText>}

      <div style={{ height: 16 }} />
      <div className="responsive-grid" style={{ display: 'grid', '--cols': '1fr 1fr', gap: 16 }}>
        <Field label="Project">
          <TextInput value={project} onChange={setProject} placeholder="e.g. AI Department" />
        </Field>
        <Field label="Linked task">
          <Select
            value={linkedTaskId}
            onChange={setLinkedTaskId}
            options={[{ value: '', label: '— None —' }, ...linkableTasks.map((t) => ({ value: t.id, label: t.title }))]}
          />
        </Field>
      </div>

      <div style={{ height: 16 }} />
      <div className="responsive-grid" style={{ display: 'grid', '--cols': '1fr 1fr', gap: 16 }}>
        <Field label="Owner to resolve">
          <Select
            value={ownerToResolveId}
            onChange={setOwnerToResolveId}
            options={[{ value: '', label: '— Not assigned yet —' }, ...blockerDirectory.map((u) => ({ value: u.id, label: u.name }))]}
          />
        </Field>
        <Field label="Target resolution">
          <DatePicker value={targetResolution} onChange={setTargetResolution} min={raisedDate} />
        </Field>
      </div>

      {isEdit && (
        <>
          <div style={{ height: 16 }} />
          <Field label="Status">
            <Select value={status} onChange={setStatus} options={Object.values(BLOCKER_STATUS).map((s) => ({ value: s, label: s }))} />
          </Field>

          {showClosureFields && (
            <>
              <div style={{ height: 16 }} />
              <div className="responsive-grid" style={{ display: 'grid', '--cols': '1fr 1fr', gap: 16 }}>
                <Field label="Closed date">
                  <DatePicker value={closedDate} onChange={setClosedDate} min={raisedDate} />
                </Field>
              </div>
              <div style={{ height: 16 }} />
              <Field label="Resolution note">
                <TextArea value={resolutionNote} onChange={setResolutionNote} placeholder="How was this resolved?" minHeight={44} />
              </Field>
            </>
          )}
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={saving}>{isEdit ? 'Save changes' : 'Raise blocker'}</Button>
      </div>
    </Modal>
  );
}

function ErrorText({ children }) {
  return <div style={{ marginTop: 6, fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{children}</div>;
}

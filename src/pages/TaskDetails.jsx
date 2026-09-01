import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { STATUS, ROLES, teamById } from '../data/mockData.js';
import { Card, Avatar, StatusBadge, PriorityBadge, Button, Select, TextArea, TextInput, Modal } from '../components/ui.jsx';
import { IconCheck } from '../components/icons.jsx';
import { formatDate } from '../utils.js';

export default function TaskDetails() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const {
    currentUser, users, departments, tasks, scopedTasks, refreshTask,
    setTaskProgress, setTaskStatus, requestChanges, submitForReview, approveTask,
    approveTaskCreation, rejectTaskCreation, reassignTask,
    requestExtension, approveExtension, rejectExtension, setTaskMarks, toggleSubtask,
    addComment, editComment, deleteComment, deleteTask,
  } = useApp();

  // Someone else (a reviewer, a team lead) may have changed this task since
  // the bulk load at login — always pull the current version on open.
  useEffect(() => {
    if (taskId) refreshTask(taskId);
  }, [taskId, refreshTask]);

  const [commentDraft, setCommentDraft] = useState('');
  const [progressDraft, setProgressDraft] = useState(null);
  const [submissionNoteDraft, setSubmissionNoteDraft] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentDraft, setEditCommentDraft] = useState('');
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState(null);
  const [showDeleteTask, setShowDeleteTask] = useState(false);
  const [marksDraft, setMarksDraft] = useState('');
  const [editingMarks, setEditingMarks] = useState(false);
  const [showExtensionForm, setShowExtensionForm] = useState(false);
  const [extensionDate, setExtensionDate] = useState('');
  const [extensionReason, setExtensionReason] = useState('');
  const [showReassignForm, setShowReassignForm] = useState(false);
  const [reassignTo, setReassignTo] = useState('');

  const task = tasks.find((t) => t.id === taskId);
  const visible = scopedTasks(currentUser);
  const hasAccess = task && visible.some((t) => t.id === task.id);

  if (!task || !hasAccess) {
    return (
      <Card>
        <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 16, color: 'var(--heading)' }}>Task not found</div>
        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 8 }}>
          It may not exist, or it's outside what your role can see.
        </div>
        <Button variant="secondary" onClick={() => navigate(-1)} style={{ marginTop: 16 }}>Go back</Button>
      </Card>
    );
  }

  const assignee = users.find((u) => u.id === task.assigneeId);
  const assignedBy = users.find((u) => u.id === task.createdBy);
  const team = teamById(task.teamId);
  const department = departments.find((d) => d.id === team?.departmentId) || null;
  const isAssignee = currentUser.id === task.assigneeId;
  const canManageTask = currentUser.id === task.createdBy || currentUser.role === ROLES.ADMIN;
  const isReviewer = currentUser.role === ROLES.ADMIN
    || (currentUser.role === ROLES.TEAM_LEAD && task.teamId === currentUser.teamId)
    || (currentUser.role === ROLES.MANAGER && team?.departmentId === currentUser.departmentId);
  const canApprove = task.status === STATUS.IN_REVIEW && isReviewer;
  // Grading only makes sense once there's submitted work to look at.
  const canGiveMarks = isReviewer && (task.status === STATUS.IN_REVIEW || task.status === STATUS.COMPLETED);
  const hasPendingExtension = Boolean(task.requestedDueDate);
  const isPendingCreationApproval = task.status === STATUS.PENDING_APPROVAL;
  // Deliberately NOT the team lead — a team lead's own task creations are
  // exactly what this gate checks, so only the department manager (or admin)
  // clears it, mirroring the backend's userCanApproveCreation rule exactly.
  const canApproveCreation = isPendingCreationApproval
    && (currentUser.role === ROLES.ADMIN || (currentUser.role === ROLES.MANAGER && team?.departmentId === currentUser.departmentId));
  const canRequestExtension = isAssignee && !hasPendingExtension && !isPendingCreationApproval && task.status !== STATUS.IN_REVIEW && task.status !== STATUS.COMPLETED;
  // Same authority as reviewing the task (helpers.js userCanReview mirrored
  // exactly) — reassignment is a management action, never an assignee one.
  const canReassign = isReviewer && task.status !== STATUS.COMPLETED;
  const reassignCandidates = users.filter((u) => {
    if (u.role !== ROLES.EMPLOYEE || u.id === task.assigneeId) return false;
    if (currentUser.role === ROLES.TEAM_LEAD) return u.teamId === currentUser.teamId;
    if (currentUser.role === ROLES.MANAGER) return u.departmentId === currentUser.departmentId;
    return true; // admin
  });

  const progress = progressDraft === null ? task.progress : progressDraft;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <span onClick={() => navigate(-1)} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--accent-dark)', cursor: 'pointer' }}>← Back</span>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 8, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>{task.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              <PriorityBadge priority={task.priority} />
              <StatusBadge status={task.status} />
              <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-muted)' }}>{team?.name} · Due {formatDate(task.dueDate)}</span>
            </div>
          </div>
          {canManageTask && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button variant="secondary" style={{ padding: '8px 16px', fontSize: 12.5 }} onClick={() => navigate(`/tasks/${task.id}/edit`)}>Edit</Button>
              <Button variant="danger" style={{ padding: '8px 16px', fontSize: 12.5 }} onClick={() => setShowDeleteTask(true)}>Delete</Button>
            </div>
          )}
        </div>
      </div>

      <div className="responsive-grid" style={{ display: 'grid', '--cols': '1.5fr 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card>
            <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>Description</div>
            <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.6, marginTop: 10 }}>
              {task.description || 'No description provided.'}
            </div>
            {task.instructions && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Instructions</div>
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.6, marginTop: 6 }}>{task.instructions}</div>
              </div>
            )}
          </Card>

          {task.subtasks.length > 0 && (
            <Card>
              <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)', marginBottom: 12 }}>Subtasks</div>
              {!isAssignee && (
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>View only — only {assignee?.name} can check these off.</div>
              )}
              {task.subtasks.map((s) => (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', cursor: isAssignee ? 'pointer' : 'default' }}>
                  <input
                    type="checkbox"
                    checked={s.done}
                    disabled={!isAssignee}
                    onChange={() => toggleSubtask(task.id, s.id)}
                    style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: isAssignee ? 'pointer' : 'not-allowed' }}
                  />
                  <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: s.done ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: s.done ? 'line-through' : 'none' }}>{s.title}</span>
                </label>
              ))}
            </Card>
          )}

          <Card>
            <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)', marginBottom: 12 }}>Activity timeline</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {task.activityLog.slice().reverse().map((ev) => (
                <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderTop: '1px solid var(--border)' }}>
                  <IconCheck size={13} color="var(--accent-dark)" />
                  <div>
                    <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-primary)' }}>{ev.text}</div>
                    <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>{formatDate(ev.at)}</div>
                  </div>
                </div>
              ))}
              {task.activityLog.length === 0 && (
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)', padding: '9px 0' }}>No activity yet.</div>
              )}
            </div>
          </Card>

          <Card>
            <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>Comments</div>
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
              {task.comments.map((c) => {
                const author = users.find((u) => u.id === c.authorId);
                const isOwnComment = c.authorId === currentUser.id;
                const canModerate = !isOwnComment && (currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.MANAGER);
                const isEditing = editingCommentId === c.id;
                return (
                  <div key={c.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: '1px solid var(--border)' }}>
                    <Avatar initial={author?.initial} size={28} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{author?.name} <span style={{ fontWeight: 500, color: 'var(--text-muted)', marginLeft: 6, fontSize: 12 }}>{formatDate(c.createdAt)}</span></div>
                        {(isOwnComment || canModerate) && !isEditing && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {isOwnComment && (
                              <span
                                onClick={() => { setEditingCommentId(c.id); setEditCommentDraft(c.text); }}
                                style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 11.5, color: 'var(--accent-dark)', cursor: 'pointer' }}
                              >
                                Edit
                              </span>
                            )}
                            <span
                              onClick={() => setPendingDeleteCommentId(c.id)}
                              style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 11.5, color: 'var(--amber-text)', cursor: 'pointer' }}
                            >
                              Delete
                            </span>
                          </div>
                        )}
                      </div>
                      {isEditing ? (
                        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <TextArea value={editCommentDraft} onChange={setEditCommentDraft} minHeight={44} />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <Button
                              variant="primary" style={{ padding: '6px 16px', fontSize: 12 }}
                              disabled={!editCommentDraft.trim()}
                              onClick={() => { editComment(task.id, c.id, editCommentDraft); setEditingCommentId(null); }}
                            >
                              Save
                            </Button>
                            <Button variant="secondary" style={{ padding: '6px 16px', fontSize: 12 }} onClick={() => setEditingCommentId(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-primary)', marginTop: 3 }}>{c.text}</div>
                      )}
                    </div>
                  </div>
                );
              })}
              {task.comments.length === 0 && (
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)', padding: '10px 0' }}>No comments yet.</div>
              )}
            </div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <TextArea value={commentDraft} onChange={setCommentDraft} placeholder="Add a comment..." minHeight={54} />
              <div>
                <Button
                  variant="secondary"
                  onClick={() => { addComment(task.id, currentUser.id, commentDraft); setCommentDraft(''); }}
                  disabled={!commentDraft.trim()}
                >
                  Post comment
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card>
            <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>Details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              <DetailRow label="Assigned to">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar initial={assignee?.initial} size={22} />
                  <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{assignee?.name}</span>
                </div>
              </DetailRow>
              {canReassign && !showReassignForm && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <span onClick={() => setShowReassignForm(true)} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--accent-dark)', cursor: 'pointer' }}>
                    Reassign
                  </span>
                </div>
              )}
              {canReassign && showReassignForm && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', background: 'var(--field-bg)', borderRadius: 9 }}>
                  <Select
                    value={reassignTo}
                    onChange={setReassignTo}
                    options={[{ value: '', label: 'Choose a new assignee' }, ...reassignCandidates.map((u) => ({ value: u.id, label: `${u.name} · ${u.title}` }))]}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      variant="primary" style={{ flex: 1, justifyContent: 'center', padding: '7px 0', fontSize: 12.5 }}
                      disabled={!reassignTo}
                      onClick={() => { reassignTask(task.id, reassignTo); setShowReassignForm(false); setReassignTo(''); }}
                    >
                      Confirm
                    </Button>
                    <Button variant="secondary" style={{ flex: 1, justifyContent: 'center', padding: '7px 0', fontSize: 12.5 }} onClick={() => { setShowReassignForm(false); setReassignTo(''); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              <DetailRow label="Assigned by"><Value>{assignedBy?.name || '—'}</Value></DetailRow>
              <DetailRow label="Department"><Value>{department?.name}</Value></DetailRow>
              <DetailRow label="Team"><Value>{team?.name}</Value></DetailRow>
              <DetailRow label="Category"><Value>{task.category}</Value></DetailRow>
              <DetailRow label="Start date"><Value>{formatDate(task.startDate)}</Value></DetailRow>
              <DetailRow label="Due date"><Value>{formatDate(task.dueDate)}</Value></DetailRow>
              {task.estimatedEffort && <DetailRow label="Estimated effort"><Value>{task.estimatedEffort}</Value></DetailRow>}
            </div>
          </Card>

          <Card>
            <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>Progress</div>
            <div style={{ marginTop: 10 }}>
              <span style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 28, color: 'var(--heading)' }}>{progress}%</span>
            </div>
            {isAssignee && !isPendingCreationApproval && task.status !== STATUS.COMPLETED && task.status !== STATUS.IN_REVIEW && (
              <>
                <input
                  type="range" min="0" max="100" step="5" value={progress}
                  onChange={(e) => setProgressDraft(Number(e.target.value))}
                  style={{ width: '100%', marginTop: 12, accentColor: 'var(--accent)' }}
                />
                <Button
                  variant="secondary" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}
                  disabled={progressDraft === null || progressDraft === task.progress}
                  onClick={() => { setTaskProgress(task.id, progressDraft); setProgressDraft(null); }}
                >
                  Save progress
                </Button>
              </>
            )}
          </Card>

          <Card>
            <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)', marginBottom: 12 }}>Status &amp; Review</div>
            {isPendingCreationApproval && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-secondary)' }}>
                  {canApproveCreation ? `${assignedBy?.name} created this for ${assignee?.name} — review and approve it to make it active.` : "Waiting on your manager's approval before work can start."}
                </div>
                {canApproveCreation && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => approveTaskCreation(task.id)}>Approve</Button>
                    <Button variant="secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => rejectTaskCreation(task.id)}>Send back</Button>
                  </div>
                )}
              </div>
            )}
            {isAssignee && !isPendingCreationApproval && task.status !== STATUS.IN_REVIEW && task.status !== STATUS.COMPLETED && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Select
                  value={task.status}
                  onChange={(v) => setTaskStatus(task.id, v)}
                  options={[STATUS.TODO, STATUS.IN_PROGRESS].map((s) => ({ value: s, label: s }))}
                />
                <div>
                  <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                    Notes for your reviewer (optional)
                  </div>
                  <TextArea
                    value={submissionNoteDraft}
                    onChange={setSubmissionNoteDraft}
                    placeholder="What did you do? Add a deployed site link, a demo video, anything your reviewer should check."
                    minHeight={60}
                  />
                </div>
                <Button variant="primary" style={{ justifyContent: 'center' }} onClick={() => submitForReview(task.id, submissionNoteDraft)}>Submit for review</Button>
              </div>
            )}
            {isAssignee && task.status === STATUS.IN_REVIEW && (
              <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-secondary)' }}>Waiting on your reviewer's approval.</div>
            )}
            {task.status === STATUS.COMPLETED && (
              <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-secondary)' }}>This task is complete.</div>
            )}
            {!isAssignee && !canApprove && !canGiveMarks && !isPendingCreationApproval && !(isReviewer && hasPendingExtension) && (
              <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)' }}>Only the assignee can update this task.</div>
            )}
            {task.submissionNote && (task.status === STATUS.IN_REVIEW || task.status === STATUS.COMPLETED) && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Notes from {assignee?.name}
                </div>
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.6, marginTop: 6, whiteSpace: 'pre-wrap' }}>
                  <Linkified text={task.submissionNote} />
                </div>
              </div>
            )}

            {hasPendingExtension && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Extension requested</div>
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)', marginTop: 6 }}>
                  New due date: {formatDate(task.requestedDueDate)}
                </div>
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                  {task.extensionReason}
                </div>
                {isReviewer ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <Button variant="primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => approveExtension(task.id)}>Approve extension</Button>
                    <Button variant="secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => rejectExtension(task.id)}>Decline</Button>
                  </div>
                ) : (
                  <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 12.5, color: 'var(--text-muted)', marginTop: 8 }}>Awaiting your reviewer's decision.</div>
                )}
              </div>
            )}

            {canRequestExtension && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                {!showExtensionForm ? (
                  <span
                    onClick={() => setShowExtensionForm(true)}
                    style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--accent-dark)', cursor: 'pointer' }}
                  >
                    Request a due date extension
                  </span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>New due date</div>
                    <TextInput type="date" value={extensionDate} onChange={setExtensionDate} />
                    <TextArea value={extensionReason} onChange={setExtensionReason} placeholder="Why do you need more time?" minHeight={44} />
                    {extensionDate && task.dueDate && extensionDate <= task.dueDate && (
                      <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>
                        The new date must be after the current due date ({formatDate(task.dueDate)}).
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button
                        variant="primary" style={{ flex: 1, justifyContent: 'center' }}
                        disabled={!extensionDate || !extensionReason.trim() || (task.dueDate && extensionDate <= task.dueDate)}
                        onClick={() => {
                          requestExtension(task.id, extensionDate, extensionReason);
                          setShowExtensionForm(false); setExtensionDate(''); setExtensionReason('');
                        }}
                      >
                        Send request
                      </Button>
                      <Button variant="secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowExtensionForm(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Marks live in the same review moment as Approve/Request changes,
                rather than a separate card — grading is part of reviewing. */}
            {(canGiveMarks || task.marks != null) && (
              <div style={{ marginTop: (isAssignee || canApprove || canGiveMarks) ? 14 : 0, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--text-muted)' }}>Marks</span>
                  {task.marks != null && (
                    <span style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--accent-dark)' }}>{task.marks}%</span>
                  )}
                </div>
                {task.marks == null && <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Not graded yet.</div>}

                {canGiveMarks && !editingMarks && (
                  <Button
                    variant="secondary" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}
                    onClick={() => { setMarksDraft(task.marks != null ? String(task.marks) : ''); setEditingMarks(true); }}
                  >
                    {task.marks != null ? 'Update marks' : 'Give marks'}
                  </Button>
                )}
                {canGiveMarks && editingMarks && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <input
                      type="number" min="0" max="100" value={marksDraft}
                      onChange={(e) => setMarksDraft(e.target.value)}
                      placeholder="0 - 100"
                      style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 9, fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button
                        variant="primary" style={{ flex: 1, justifyContent: 'center' }}
                        disabled={marksDraft === '' || Number(marksDraft) < 0 || Number(marksDraft) > 100 || !Number.isInteger(Number(marksDraft))}
                        onClick={() => { setTaskMarks(task.id, Number(marksDraft)); setEditingMarks(false); }}
                      >
                        Save
                      </Button>
                      <Button variant="secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setEditingMarks(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {canApprove && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <Button variant="primary" style={{ justifyContent: 'center' }} onClick={() => approveTask(task.id)}>Approve</Button>
                <Button variant="secondary" style={{ justifyContent: 'center' }} onClick={() => requestChanges(task.id)}>Request changes</Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      {showDeleteTask && (
        <Modal title="Delete this task?" onClose={() => setShowDeleteTask(false)}>
          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            This can't be undone. The task, its subtasks, comments, and activity history will be permanently removed.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={() => setShowDeleteTask(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => { deleteTask(task.id); navigate(-1); }}>Delete task</Button>
          </div>
        </Modal>
      )}

      {pendingDeleteCommentId && (
        <Modal title="Delete this comment?" onClose={() => setPendingDeleteCommentId(null)}>
          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            This can't be undone.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={() => setPendingDeleteCommentId(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { deleteComment(task.id, pendingDeleteCommentId); setPendingDeleteCommentId(null); }}>Delete comment</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DetailRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--text-muted)' }}>{label}</span>
      {children}
    </div>
  );
}

function Value({ children }) {
  return <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{children}</span>;
}

// Turns a bare URL sitting in plain text (e.g. a pasted deployed-site link)
// into an actual clickable link, without needing the person writing the note
// to know any markdown/HTML — they just paste the link as-is. Splitting on a
// capturing group interleaves the matched URLs into the result at odd
// indices, so no separate (and stateful, error-prone) regex test is needed
// to tell a URL segment apart from a plain-text one.
const URL_RE = /(https?:\/\/[^\s]+)/g;
function Linkified({ text }) {
  const parts = text.split(URL_RE);
  return parts.map((part, i) => (
    i % 2 === 1
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-dark)', wordBreak: 'break-all' }}>{part}</a>
      : <React.Fragment key={i}>{part}</React.Fragment>
  ));
}

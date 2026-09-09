import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { STATUS, BLOCKER_STATUS, ROLES, teamById } from '../data/mockData.js';
import { canAccessTeamScope, assignableTargets } from '../data/hierarchy.js';
import { Card, Avatar, StatusBadge, PriorityBadge, ProgressBar, SectionLabel, Button, Select, TextArea, TextInput, Modal } from '../components/ui.jsx';
import DatePicker from '../components/DatePicker.jsx';
import {
  IconCheck, IconUser, IconUsersGroup, IconBuilding, IconClipboard, IconCalendar,
  IconClock, IconAlertTriangle, IconCheckCircle, IconBlock, IconEye, IconPlusCircle,
  IconArrowRight, IconBarChart, IconEdit, IconTrash,
} from '../components/icons.jsx';
import { formatDate, isOverdue } from '../utils.js';

export default function TaskDetails() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const {
    currentUser, users, departments, tasks, blockers, scopedTasks, refreshTask, TODAY,
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
  // Editing authority is narrower than review authority — a Team Lead can
  // review/approve a task but never directly edit it, same distinction as
  // before; Assistant Manager gets the same edit rights as Manager (one
  // rung up from Team Lead), matching hierarchy.canManageTask on the backend.
  const canManageTask = currentUser.id === task.createdBy
    || currentUser.role === ROLES.SUPER_ADMIN || currentUser.role === ROLES.ADMIN
    || (currentUser.role === ROLES.MANAGER && team?.departmentId === currentUser.departmentId)
    || (currentUser.role === ROLES.ASSISTANT_MANAGER && team?.id === currentUser.teamId);
  // Mirrors hierarchy.canReviewTask exactly — same rank+scope shape used for
  // viewing/reviewing/approving/reassigning/moderating this task.
  const isReviewer = canAccessTeamScope(currentUser, team);
  const canApprove = task.status === STATUS.IN_REVIEW && isReviewer;
  // Grading only makes sense once there's submitted work to look at.
  const canGiveMarks = isReviewer && (task.status === STATUS.IN_REVIEW || task.status === STATUS.COMPLETED);
  const hasPendingExtension = Boolean(task.requestedDueDate);
  const isPendingCreationApproval = task.status === STATUS.PENDING_APPROVAL;
  // Nobody approves their own task creation — generalized from the old
  // team-lead-only self-check, mirroring hierarchy.canApproveCreationTask.
  const canApproveCreation = isPendingCreationApproval && task.createdBy !== currentUser.id && isReviewer;
  const canRequestExtension = isAssignee && !hasPendingExtension && !isPendingCreationApproval && task.status !== STATUS.IN_REVIEW && task.status !== STATUS.COMPLETED;
  // Same authority as reviewing the task (hierarchy.canReviewTask mirrored
  // exactly) — reassignment is a management action, never an assignee one.
  const canReassign = isReviewer && task.status !== STATUS.COMPLETED;
  // Anyone strictly below the viewer's rank, in their scope — mirrors the
  // backend's broadened validateAssignee, so a Team Lead or Assistant
  // Manager is now a valid reassignment target too, not just an Employee.
  const reassignCandidates = assignableTargets(currentUser, users).filter((u) => u.id !== task.assigneeId);

  const progress = progressDraft === null ? task.progress : progressDraft;
  const overdue = isOverdue(task.dueDate, TODAY, task.status);
  const health = taskHealth(task, blockers, TODAY);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card className="td-card" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, var(--accent-mid), var(--accent), var(--accent-dark))' }} />
        <span onClick={() => navigate(-1)} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--accent-dark)', cursor: 'pointer' }}>← Back</span>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>{task.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
              <MetaItem icon={<IconUsersGroup size={13} color="var(--text-muted)" />}>{team?.name}</MetaItem>
              <MetaItem icon={<IconCalendar size={13} color={overdue ? 'var(--amber-text)' : 'var(--text-muted)'} />} warn={overdue}>
                {overdue ? 'Overdue — ' : 'Due '}{formatDate(task.dueDate)}
              </MetaItem>
            </div>
          </div>
          {canManageTask && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button className="td-btn" variant="secondary" style={{ padding: '8px 16px', fontSize: 12.5 }} onClick={() => navigate(`/tasks/${task.id}/edit`)}>
                <IconEdit size={13} color="var(--text-secondary)" /> Edit
              </Button>
              <Button className="td-btn" variant="danger" style={{ padding: '8px 16px', fontSize: 12.5 }} onClick={() => setShowDeleteTask(true)}>
                <IconTrash size={13} color="#FFFFFF" /> Delete
              </Button>
            </div>
          )}
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
            <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Overall progress
            </span>
            <span style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--heading)' }}>{progress}%</span>
          </div>
          <ProgressBar value={progress} height={9} />
        </div>
      </Card>

      <Card className="td-card" style={{ padding: '18px 24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
          <SummaryChip icon={<IconUser size={16} color="var(--accent-dark)" />} label="Assignee" value={assignee?.name} />
          <SummaryChip icon={<IconBuilding size={16} color="var(--accent-dark)" />} label="Department" value={department?.name} />
          <SummaryChip icon={<IconUsersGroup size={16} color="var(--accent-dark)" />} label="Team" value={team?.name} />
          <SummaryChip icon={<IconClipboard size={16} color="var(--accent-dark)" />} label="Milestone" value={task.category} />
        </div>
      </Card>

      <div className="responsive-grid" style={{ display: 'grid', '--cols': '1.5fr 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card className="td-card">
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
            <Card className="td-card">
              <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)', marginBottom: 12 }}>Subtasks</div>
              {!isAssignee && (
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>View only — only {assignee?.name} can check these off.</div>
              )}
              {task.subtasks.map((s) => (
                <label key={s.id} className="td-chip" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px', borderRadius: 9, cursor: isAssignee ? 'pointer' : 'default' }}>
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

          <Card className="td-card">
            <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)', marginBottom: 14 }}>Activity timeline</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {task.activityLog.slice().reverse().map((ev, i, arr) => {
                const { Icon, color } = activityIcon(ev.text);
                const isLast = i === arr.length - 1;
                return (
                  <div key={ev.id} className="td-timeline-row" style={{ display: 'flex', gap: 14, paddingBottom: isLast ? 0 : 18 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div className="td-timeline-node" style={{
                        width: 30, height: 30, borderRadius: 999, background: '#FFFFFF', border: `1.5px solid ${color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1,
                      }}>
                        <Icon size={14} color={color} />
                      </div>
                      {!isLast && <div style={{ width: 2, flex: 1, background: 'var(--border)', marginTop: 2 }} />}
                    </div>
                    <div style={{ flex: 1, paddingTop: 5, paddingBottom: 4 }}>
                      <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{ev.text}</div>
                      <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{formatDate(ev.at)}</div>
                    </div>
                  </div>
                );
              })}
              {task.activityLog.length === 0 && (
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)', padding: '9px 0' }}>No activity yet.</div>
              )}
            </div>
          </Card>

          <Card className="td-card">
            <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>Comments</div>
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
              {task.comments.map((c) => {
                const author = users.find((u) => u.id === c.authorId);
                const isOwnComment = c.authorId === currentUser.id;
                // Mirrors backend/routes/tasks.js's isModerator: anyone who
                // can review this task can moderate its comments too.
                const canModerate = !isOwnComment && isReviewer;
                const isEditing = editingCommentId === c.id;
                return (
                  <div key={c.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: '1px solid var(--border)' }}>
                    <Avatar initial={author?.initial} size={28} gradient />
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
          {health && (
            <Card className="td-card">
              <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>Task health</div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14, marginTop: 14,
                padding: '14px 16px', borderRadius: 12, background: health.tone.bg,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 11, background: 'rgba(255,255,255,0.6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <health.Icon size={19} color={health.tone.fg} />
                </div>
                <div>
                  <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 14.5, color: health.tone.fg }}>{health.label}</div>
                  <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12, color: health.tone.fg, opacity: 0.85, marginTop: 2 }}>{health.detail}</div>
                </div>
              </div>
            </Card>
          )}

          <Card className="td-card">
            <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>Details</div>

            <SectionLabel first icon={<IconUser size={12} color="var(--accent-dark)" />}>Assignment</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <DetailRow label="Assigned to">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar initial={assignee?.initial} size={22} gradient />
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
            </div>

            <SectionLabel icon={<IconBuilding size={12} color="var(--accent-dark)" />}>Organization</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <DetailRow label="Department"><Value>{department?.name}</Value></DetailRow>
              <DetailRow label="Team"><Value>{team?.name}</Value></DetailRow>
              <DetailRow label="Milestone"><Value>{task.category}</Value></DetailRow>
            </div>

            <SectionLabel icon={<IconCalendar size={12} color="var(--accent-dark)" />}>Schedule</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <DetailRow label="Start date"><Value>{formatDate(task.startDate)}</Value></DetailRow>
              <DetailRow label="Due date"><Value>{formatDate(task.dueDate)}</Value></DetailRow>
              {task.estimatedEffort && <DetailRow label="Estimated effort"><Value>{task.estimatedEffort}</Value></DetailRow>}
            </div>
          </Card>

          <Card className="td-card">
            <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>Progress</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 14 }}>
              <ProgressRing value={progress} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 13.5, color: 'var(--heading)' }}>
                  {completionLabel(task.status, progress)}
                </div>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <MiniRow label="Start" value={formatDate(task.startDate)} />
                  <MiniRow label="Due" value={formatDate(task.dueDate)} />
                </div>
              </div>
            </div>
            {isAssignee && !isPendingCreationApproval && task.status !== STATUS.COMPLETED && task.status !== STATUS.IN_REVIEW && (
              <>
                <input
                  type="range" min="0" max="100" step="5" value={progress}
                  onChange={(e) => setProgressDraft(Number(e.target.value))}
                  style={{ width: '100%', marginTop: 16, accentColor: 'var(--accent)' }}
                />
                <Button
                  className="td-btn"
                  variant="secondary" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}
                  disabled={progressDraft === null || progressDraft === task.progress}
                  onClick={() => { setTaskProgress(task.id, progressDraft); setProgressDraft(null); }}
                >
                  Save progress
                </Button>
              </>
            )}
          </Card>

          <Card className="td-card">
            <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)', marginBottom: 12 }}>Status &amp; Review</div>
            {isPendingCreationApproval && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-secondary)' }}>
                  {canApproveCreation ? `${assignedBy?.name} created this for ${assignee?.name} — review and approve it to make it active.` : "Waiting on your team lead's or manager's approval before work can start."}
                </div>
                {canApproveCreation && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button className="td-btn" variant="primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => approveTaskCreation(task.id)}>Approve</Button>
                    <Button className="td-btn" variant="secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => rejectTaskCreation(task.id)}>Send back</Button>
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
                <Button className="td-btn" variant="primary" style={{ justifyContent: 'center' }} onClick={() => submitForReview(task.id, submissionNoteDraft)}>Submit for review</Button>
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
                    <Button className="td-btn" variant="primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => approveExtension(task.id)}>Approve extension</Button>
                    <Button className="td-btn" variant="secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => rejectExtension(task.id)}>Decline</Button>
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
                    <DatePicker value={extensionDate} onChange={setExtensionDate} />
                    <TextArea value={extensionReason} onChange={setExtensionReason} placeholder="Why do you need more time?" minHeight={44} />
                    {extensionDate && task.dueDate && extensionDate <= task.dueDate && (
                      <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>
                        The new date must be after the current due date ({formatDate(task.dueDate)}).
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button
                        className="td-btn"
                        variant="primary" style={{ flex: 1, justifyContent: 'center' }}
                        disabled={!extensionDate || !extensionReason.trim() || (task.dueDate && extensionDate <= task.dueDate)}
                        onClick={() => {
                          requestExtension(task.id, extensionDate, extensionReason);
                          setShowExtensionForm(false); setExtensionDate(''); setExtensionReason('');
                        }}
                      >
                        Send request
                      </Button>
                      <Button className="td-btn" variant="secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowExtensionForm(false)}>Cancel</Button>
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
                    className="td-btn"
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
                        className="td-btn"
                        variant="primary" style={{ flex: 1, justifyContent: 'center' }}
                        disabled={marksDraft === '' || Number(marksDraft) < 0 || Number(marksDraft) > 100 || !Number.isInteger(Number(marksDraft))}
                        onClick={() => { setTaskMarks(task.id, Number(marksDraft)); setEditingMarks(false); }}
                      >
                        Save
                      </Button>
                      <Button className="td-btn" variant="secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setEditingMarks(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {canApprove && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <Button className="td-btn" variant="primary" style={{ justifyContent: 'center' }} onClick={() => approveTask(task.id)}>Approve</Button>
                <Button className="td-btn" variant="secondary" style={{ justifyContent: 'center' }} onClick={() => requestChanges(task.id)}>Request changes</Button>
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

function MiniRow({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 11.5, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 12, color: 'var(--text-primary)' }}>{value || '—'}</span>
    </div>
  );
}

function MetaItem({ icon, children, warn }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5,
      color: warn ? 'var(--amber-text)' : 'var(--text-secondary)',
    }}>
      {icon}{children}
    </span>
  );
}

function SummaryChip({ icon, label, value }) {
  if (!value) return null;
  return (
    <div className="td-chip" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 150, padding: '4px 8px', borderRadius: 10 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)', marginTop: 1 }}>{value}</div>
      </div>
    </div>
  );
}

// Same rotated-circle SVG technique as the dashboard's Donut chart, scaled
// down to a single ring for one task's completion percentage.
function ProgressRing({ value, size = 92 }) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(100, Math.max(0, value)) / 100);
  const c = size / 2;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--track-bg)" strokeWidth={stroke} />
        <circle
          cx={c} cy={c} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${c} ${c})`}
          style={{ transition: 'stroke-dashoffset .25s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 19, color: 'var(--heading)' }}>{value}%</span>
      </div>
    </div>
  );
}

function completionLabel(status, progress) {
  if (status === STATUS.COMPLETED) return 'Complete';
  if (status === STATUS.IN_REVIEW) return 'Submitted — awaiting review';
  if (status === STATUS.PENDING_APPROVAL) return 'Awaiting approval to start';
  if (progress === 0) return 'Not started';
  return 'In progress';
}

const HEALTH_TONES = {
  ontrack: { bg: 'var(--accent-soft)', fg: 'var(--accent-dark)' },
  review: { bg: 'var(--neutral-bg)', fg: 'var(--text-secondary)' },
  risk: { bg: 'var(--amber-bg)', fg: 'var(--amber-text)' },
  blocked: { bg: 'var(--amber-fill)', fg: '#FFFFFF' },
};

// Purely a client-side read of data the page already has (task status, its
// linked blockers, its due date) — no new backend field, no change to what
// gets stored. A Completed task has nothing left to signal, so it opts out
// of the health read entirely rather than being forced into one of the four
// states.
function taskHealth(task, blockers, today) {
  if (task.status === STATUS.COMPLETED) return null;

  const openBlockers = blockers.filter((b) => b.linkedTaskId === task.id && b.status !== BLOCKER_STATUS.RESOLVED && b.status !== BLOCKER_STATUS.CLOSED).length;
  if (openBlockers > 0) {
    return { key: 'blocked', label: 'Blocked', detail: `Linked to ${openBlockers} open blocker${openBlockers > 1 ? 's' : ''}.`, Icon: IconBlock, tone: HEALTH_TONES.blocked };
  }

  if (task.status === STATUS.IN_REVIEW || task.status === STATUS.PENDING_APPROVAL || task.requestedDueDate) {
    const detail = task.requestedDueDate ? 'A due date extension is awaiting a decision.'
      : task.status === STATUS.PENDING_APPROVAL ? "Awaiting a manager's or team lead's approval."
        : "Submitted — awaiting the reviewer's decision.";
    return { key: 'review', label: 'Under Review', detail, Icon: IconEye, tone: HEALTH_TONES.review };
  }

  const overdue = isOverdue(task.dueDate, today, task.status);
  const daysLeft = task.dueDate ? Math.round((new Date(`${task.dueDate}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000) : null;
  if (overdue) {
    return { key: 'risk', label: 'At Risk', detail: 'Past its due date.', Icon: IconAlertTriangle, tone: HEALTH_TONES.risk };
  }
  if (daysLeft !== null && daysLeft <= 2 && task.progress < 70) {
    const dueText = daysLeft <= 0 ? 'today' : `in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`;
    return { key: 'risk', label: 'At Risk', detail: `Due ${dueText}, with progress behind.`, Icon: IconAlertTriangle, tone: HEALTH_TONES.risk };
  }

  return { key: 'ontrack', label: 'On Track', detail: 'Progressing normally toward its due date.', Icon: IconCheckCircle, tone: HEALTH_TONES.ontrack };
}

// The per-task activity log only stores free text (see
// backend/database/helpers.js's insertTaskEvent) — no structured event
// type — so the icon is inferred from the exact phrasing routes/tasks.js
// generates. Order matters: more specific phrases (e.g. "reassigned",
// which also contains "assigned") are checked before their broader cousins.
function activityIcon(text) {
  const t = text.toLowerCase();
  if (t.includes('reassigned')) return { Icon: IconArrowRight, color: 'var(--accent-mid)' };
  if (t.includes('created')) return { Icon: IconPlusCircle, color: 'var(--accent)' };
  if (t.includes('sent this back') || t.includes('requested changes') || t.includes('declined')) return { Icon: IconAlertTriangle, color: 'var(--amber-text)' };
  if (t.includes('approved') || t.includes('completed')) return { Icon: IconCheckCircle, color: 'var(--accent-dark)' };
  if (t.includes('progress updated')) return { Icon: IconBarChart, color: 'var(--accent)' };
  if (t.includes('submitted for review')) return { Icon: IconEye, color: 'var(--accent-dark)' };
  if (t.includes('status changed')) return { Icon: IconClock, color: 'var(--accent-mid)' };
  if (t.includes('extension') || t.includes('due date')) return { Icon: IconCalendar, color: 'var(--amber-text)' };
  if (t.includes('marked')) return { Icon: IconCheck, color: 'var(--accent-dark)' };
  if (t.includes('assigned')) return { Icon: IconUser, color: 'var(--accent)' };
  return { Icon: IconCheck, color: 'var(--text-muted)' };
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

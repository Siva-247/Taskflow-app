export const STATUS = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'Submitted for Review',
  COMPLETED: 'Completed',
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
};

// The real current date (server's local time). Built from
// getFullYear/Month/Date rather than toISOString() so it reflects the
// server's local calendar day, not UTC's.
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Exported as `let`, not `const` — ES module imports are live bindings, so
// every file doing `import { TODAY } from './constants.js'` automatically
// sees the update the moment it happens below, with no changes needed on
// their end. Without this, a server process that stays alive across
// midnight (Render's free tier restarts often enough to avoid it in
// practice, but a paid always-on plan wouldn't) would keep reporting
// yesterday's date until its next restart.
export let TODAY = localToday();
setInterval(() => {
  const fresh = localToday();
  if (fresh !== TODAY) TODAY = fresh;
}, 60 * 1000);

export const STATUS = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'Submitted for Review',
  COMPLETED: 'Completed',
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
};

// The real current date (server's local time), computed once at process
// start — mirrors src/data/mockData.js on the frontend, which recomputes it
// on every page load. Built from getFullYear/Month/Date rather than
// toISOString() so it reflects the server's local calendar day, not UTC's.
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const TODAY = localToday();

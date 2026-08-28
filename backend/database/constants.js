export const STATUS = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'Submitted for Review',
  COMPLETED: 'Completed',
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
};

// Fixed "today" for the demo, mirrors src/data/mockData.js on the frontend so
// overdue/due-today math stays consistent across both sides.
export const TODAY = '2026-08-25';

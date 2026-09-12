// The explicit AI-department roster the manager's KPI spreadsheet tracks —
// deliberately NOT "everyone with role X in dept-ai": the app's real AI
// department has more employees than the spreadsheet covers (e.g.
// Sivakavitha, Lokesh, Vishal, Yathish, Pooja, Sanjay, Dhasarathy), and the
// KPI scorecard feature is scoped to match the spreadsheet's own 8 people
// exactly, not generalized to the whole department. Adding a 9th person
// later means adding one entry here, not a schema change.
//
// `reports` (Team Lead only) is who their Team-lead-scoped Auto metrics
// aggregate over — taken verbatim from the spreadsheet's KPI TARGETS sheet,
// section A's "Reports To" column, inverted (lead -> their reports).
export const KPI_ROSTER = [
  { userId: 'thamilarasu', kpiRole: 'manager', reports: ['hari', 'santhosh', 'dhivakar', 'yuvaraj', 'chandraprakash', 'muthupandi', 'dhinesh'] },
  { userId: 'hari', kpiRole: 'team_lead', reports: ['dhivakar', 'yuvaraj', 'muthupandi'] },
  { userId: 'santhosh', kpiRole: 'team_lead', reports: ['chandraprakash', 'dhinesh'] },
  { userId: 'dhivakar', kpiRole: 'junior_developer', reports: [] },
  { userId: 'yuvaraj', kpiRole: 'junior_developer', reports: [] },
  { userId: 'chandraprakash', kpiRole: 'junior_developer', reports: [] },
  { userId: 'muthupandi', kpiRole: 'junior_developer', reports: [] },
  { userId: 'dhinesh', kpiRole: 'junior_developer', reports: [] },
];

export function kpiRosterEntry(userId) {
  return KPI_ROSTER.find((r) => r.userId === userId) || null;
}

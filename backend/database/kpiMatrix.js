// The AI department's role-based weighted KPI matrix — ported verbatim from
// the manager's spreadsheet's `KPI TARGETS` sheet (section C), one array per
// role. Weights split 70% Critical / 30% Key evenly within each role, same
// as the source. `compute` says how each metric gets its `actual` value:
//   - 'auto'        computed from tasks/daily_updates/blockers (see
//                    tactical.js's computeAutoMetric)
//   - 'manual'      typed in by a reviewer, stored in kpi_manual_entries
//   - 'unavailable' no data source or manual-entry field exists yet — shown
//                    as "Not yet trackable", never fabricated, never
//                    silently scored as zero.
export const KPI_MATRIX = {
  manager: [
    { type: 'Critical', key: 'project_milestone_achievement', label: 'Project / Milestone Achievement', weight: 0.14, epiTarget: '≥95%', mpiRange: '85–94%', lpiRange: '<85%', formula: 'Completed + accepted milestones ÷ planned milestones × 100', compute: 'auto' },
    { type: 'Critical', key: 'on_time_delivery', label: 'On-Time Delivery', weight: 0.14, epiTarget: '≥95%', mpiRange: '85–94%', lpiRange: '<85%', formula: 'On-time completed ÷ total completed × 100', compute: 'auto' },
    { type: 'Critical', key: 'project_quality_acceptance', label: 'Project Quality / Acceptance', weight: 0.14, epiTarget: '≥95%', mpiRange: '85–94%', lpiRange: '<85%', formula: 'Mean of Code Review %, Test Case %, Docs %, Prod Response %', compute: 'manual' },
    { type: 'Critical', key: 'team_milestone_achievement', label: 'Team Milestone Achievement', weight: 0.14, epiTarget: '≥90%', mpiRange: '80–89%', lpiRange: '<80%', formula: 'Completed assigned milestones ÷ planned assigned × 100', compute: 'auto' },
    { type: 'Critical', key: 'risk_blocker_closure', label: 'Risk / Blocker Closure', weight: 0.14, epiTarget: '≥90%', mpiRange: '75–89%', lpiRange: '<75%', formula: 'Closed within target date ÷ blockers due × 100', compute: 'auto' },
    { type: 'Key', key: 'resource_utilization', label: 'Resource Utilization / Workload', weight: 0.10, epiTarget: '85–100%', mpiRange: '70–84% or 101–110%', lpiRange: '<70% or >110%', formula: 'Assigned workload units ÷ available capacity units × 100', compute: 'unavailable' },
    { type: 'Key', key: 'sop_governance_compliance', label: 'SOP / Governance Compliance', weight: 0.10, epiTarget: '≥95%', mpiRange: '85–94%', lpiRange: '<85%', formula: 'Completed mandatory checkpoints ÷ applicable checkpoints × 100', compute: 'unavailable' },
    { type: 'Key', key: 'project_impact_productivity', label: 'Project Impact / Productivity Improvement', weight: 0.10, epiTarget: '≥90%', mpiRange: '75–89%', lpiRange: '<75%', formula: 'Verified improvements meeting expected outcome ÷ total × 100', compute: 'unavailable' },
  ],
  team_lead: [
    { type: 'Critical', key: 'team_milestone_achievement', label: 'Team Milestone Achievement', weight: 0.14, epiTarget: '≥95%', mpiRange: '85–94%', lpiRange: '<85%', formula: 'Completed team milestones ÷ planned team milestones × 100', compute: 'auto' },
    { type: 'Critical', key: 'team_on_time_delivery', label: 'Team On-Time Delivery', weight: 0.14, epiTarget: '≥95%', mpiRange: '85–94%', lpiRange: '<85%', formula: 'On-time team deliverables ÷ completed team deliverables × 100', compute: 'auto' },
    { type: 'Critical', key: 'team_quality', label: 'Team Quality', weight: 0.14, epiTarget: '≥95%', mpiRange: '85–94%', lpiRange: '<85%', formula: 'Team mean of Code Review, Testing, Docs, Prod Response', compute: 'manual' },
    { type: 'Critical', key: 'blocker_resolution', label: 'Blocker Resolution', weight: 0.14, epiTarget: '≥90%', mpiRange: '75–89%', lpiRange: '<75%', formula: 'Blockers resolved within target date ÷ blockers due × 100', compute: 'auto' },
    { type: 'Critical', key: 'requirement_deliverable_accuracy', label: 'Requirement / Deliverable Accuracy', weight: 0.14, epiTarget: '≥95%', mpiRange: '85–94%', lpiRange: '<85%', formula: 'Accepted deliverables ÷ submitted deliverables × 100', compute: 'manual' },
    { type: 'Key', key: 'code_review_completion', label: 'Code Review Completion', weight: 0.075, epiTarget: '≥95%', mpiRange: '85–94%', lpiRange: '<85%', formula: 'Completed required reviews ÷ reviews due × 100', compute: 'manual' },
    { type: 'Key', key: 'team_task_completion', label: 'Team Task Completion', weight: 0.075, epiTarget: '≥95%', mpiRange: '85–94%', lpiRange: '<85%', formula: 'Completed accepted tasks ÷ assigned tasks × 100', compute: 'auto' },
    { type: 'Key', key: 'estimation_planning_accuracy', label: 'Estimation / Planning Accuracy', weight: 0.075, epiTarget: '≥85%', mpiRange: '70–84%', lpiRange: '<70%', formula: 'Items completed within planned date ÷ items completed × 100', compute: 'auto' },
    { type: 'Key', key: 'mentoring_capability_improvement', label: 'Mentoring / Capability Improvement', weight: 0.075, epiTarget: '≥90%', mpiRange: '75–89%', lpiRange: '<75%', formula: 'Supported members meeting improvement criteria ÷ members under support × 100', compute: 'unavailable' },
  ],
  senior_developer: [
    { type: 'Critical', key: 'assigned_deliverable_completion', label: 'Assigned Deliverable Completion', weight: 0.14, epiTarget: '≥95%', mpiRange: '85–94%', lpiRange: '<85%', formula: 'Completed accepted assigned deliverables ÷ assigned × 100', compute: 'auto' },
    { type: 'Critical', key: 'on_time_delivery', label: 'On-Time Delivery', weight: 0.14, epiTarget: '≥95%', mpiRange: '85–94%', lpiRange: '<85%', formula: 'On-time assigned ÷ completed assigned × 100', compute: 'auto' },
    { type: 'Critical', key: 'code_quality', label: 'Code Quality', weight: 0.14, epiTarget: '≥90%', mpiRange: '80–89%', lpiRange: '<80%', formula: 'Code Review Score ÷ 5 × 100', compute: 'manual' },
    { type: 'Critical', key: 'post_release_defect_control', label: 'Post-Release Defect Control', weight: 0.14, epiTarget: 'Target met', mpiRange: 'Minor deviation', lpiRange: 'Target breached', formula: 'Critical bugs = 0 and High bugs ≤2 per month', compute: 'manual' },
    { type: 'Critical', key: 'testing_completion', label: 'Testing Completion', weight: 0.14, epiTarget: '100%', mpiRange: '90–99%', lpiRange: '<90%', formula: 'Required testing completed before deployment ÷ required × 100', compute: 'manual' },
    { type: 'Key', key: 'production_issue_response', label: 'Production Issue Response', weight: 0.075, epiTarget: '≥95%', mpiRange: '85–94%', lpiRange: '<85%', formula: 'Issues meeting SLA ÷ applicable issues × 100', compute: 'manual' },
    { type: 'Key', key: 'technical_documentation', label: 'Technical Documentation', weight: 0.075, epiTarget: '100%', mpiRange: '90–99%', lpiRange: '<90%', formula: 'Required documentation completed ÷ required × 100', compute: 'manual' },
    { type: 'Key', key: 'blocker_resolution_escalation', label: 'Blocker Resolution / Escalation', weight: 0.075, epiTarget: '≥90%', mpiRange: '75–89%', lpiRange: '<75%', formula: 'Own blockers resolved or escalated within SLA ÷ own due × 100', compute: 'auto' },
    { type: 'Key', key: 'task_planning_accuracy', label: 'Task Planning Accuracy', weight: 0.075, epiTarget: '≥85%', mpiRange: '70–84%', lpiRange: '<70%', formula: 'Tasks completed within planned date ÷ completed planned × 100', compute: 'auto' },
  ],
  junior_developer: [
    { type: 'Critical', key: 'assigned_task_deliverable_completion', label: 'Assigned Task / Deliverable Completion', weight: 0.14, epiTarget: '≥95%', mpiRange: '85–94%', lpiRange: '<85%', formula: 'Completed accepted assigned tasks ÷ assigned tasks × 100', compute: 'auto' },
    { type: 'Critical', key: 'on_time_delivery', label: 'On-Time Delivery', weight: 0.14, epiTarget: '≥90%', mpiRange: '80–89%', lpiRange: '<80%', formula: 'On-time assigned tasks ÷ completed assigned tasks × 100', compute: 'auto' },
    { type: 'Critical', key: 'functional_accuracy', label: 'Functional Accuracy', weight: 0.14, epiTarget: '≥95%', mpiRange: '85–94%', lpiRange: '<85%', formula: 'Accepted / working deliverables ÷ submitted × 100', compute: 'manual' },
    { type: 'Critical', key: 'bug_rework_control', label: 'Bug / Rework Control', weight: 0.14, epiTarget: '≤5%', mpiRange: '6–10%', lpiRange: '>10%', formula: 'Rework or defect items ÷ submitted deliverables × 100', compute: 'manual' },
    { type: 'Critical', key: 'testing_completion', label: 'Testing Completion', weight: 0.14, epiTarget: '≥90%', mpiRange: '75–89%', lpiRange: '<75%', formula: 'Required tests completed before handover ÷ required × 100', compute: 'manual' },
    { type: 'Key', key: 'production_issue_response', label: 'Production Issue Response', weight: 0.075, epiTarget: '≥85%', mpiRange: '70–84%', lpiRange: '<70%', formula: 'Applicable issues meeting SLA ÷ total applicable × 100', compute: 'manual' },
    { type: 'Key', key: 'technical_documentation', label: 'Technical Documentation', weight: 0.075, epiTarget: '≥90%', mpiRange: '75–89%', lpiRange: '<75%', formula: 'Required documentation completed ÷ required × 100', compute: 'manual' },
    { type: 'Key', key: 'blocker_escalation', label: 'Blocker Escalation', weight: 0.075, epiTarget: '≥90%', mpiRange: '75–89%', lpiRange: '<75%', formula: 'Own blockers escalated or updated within SLA ÷ own due × 100', compute: 'auto' },
    { type: 'Key', key: 'technical_learning_application', label: 'Technical Learning Application', weight: 0.075, epiTarget: '≥90%', mpiRange: '75–89%', lpiRange: '<75%', formula: 'Learning items completed and applied ÷ planned learning items × 100', compute: 'unavailable' },
  ],
};

export function kpiMatrixFor(kpiRole) {
  return KPI_MATRIX[kpiRole] || [];
}

export interface WorkflowSharedState {
  taskTitle: string;
  taskDescription: string;
  worktreePath: string;
}

export interface WorkflowStepSummary {
  summary: string;
}

export interface WorkflowExecutionContext {
  cancelled: boolean;
  proc: unknown;
  worktreePath: string;
}

interface StepSnapshot {
  stepId: string;
  name: string;
  status: string;
  summary: string | null;
}

interface WorkflowNotificationEvent {
  type: 'SUSPENDED' | 'COMPLETED' | 'FAILED';
  runId: number;
  taskId: number;
  taskTitle: string;
  steps: StepSnapshot[];
  currentStepId: string | null;
  suspendInfo?: {
    reason: string;
    summary?: string | null;
    askUserQuestion?: Record<string, unknown> | null;
  };
  errorMessage?: string;
}

export { StepSnapshot, WorkflowNotificationEvent };

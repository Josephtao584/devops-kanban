interface WorkflowNotificationEvent {
  type: 'SUSPENDED' | 'COMPLETED' | 'FAILED';
  runId: number;
  taskId: number;
  taskTitle: string;
}

export { WorkflowNotificationEvent };

import { EventEmitter } from 'events';

interface WorkflowNotificationEvent {
  type: 'SUSPENDED' | 'COMPLETED' | 'FAILED';
  runId: number;
  taskId: number;
  taskTitle: string;
}

const notificationEvents = new EventEmitter();
notificationEvents.setMaxListeners(50);

export { notificationEvents, WorkflowNotificationEvent };

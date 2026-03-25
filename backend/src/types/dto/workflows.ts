import type { WorkflowTemplateEntity } from '../entities.ts';

export interface StartWorkflowBody {
  task_id?: string | number;
  workflow_template_id?: string;
  workflow_template_snapshot?: WorkflowTemplateEntity;
}

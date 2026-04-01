export interface WorkflowTemplateStepInput {
  id: string;
  name: string;
  instructionPrompt: string;
  agentId: number;
  // Suspend/resume configuration
  requiresConfirmation?: boolean;
}

export interface CreateWorkflowTemplateInput {
  template_id: string;
  name: string;
  steps: WorkflowTemplateStepInput[];
}

export interface UpdateWorkflowTemplateInput {
  template_id: string;
  name: string;
  steps: WorkflowTemplateStepInput[];
}

export interface ReorderWorkflowTemplatesInput {
  updates: Array<{ id: number; order: number }>;
}

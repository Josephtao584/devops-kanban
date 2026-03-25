export interface WorkflowTemplateStepInput {
  id: string;
  name: string;
  instructionPrompt: string;
  agentId: number;
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

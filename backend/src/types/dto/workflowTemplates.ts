export interface WorkflowTemplateStepInput {
  id: string;
  name: string;
  instructionPrompt: string;
  agentId: number | null;
}

export interface UpdateWorkflowTemplateInput {
  template_id: string;
  name: string;
  steps: WorkflowTemplateStepInput[];
}

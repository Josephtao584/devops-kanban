export interface WorkflowTemplateExecutorInput {
  type: string;
  commandOverride: string | null;
  args: string[];
  env: Record<string, string>;
}

export interface WorkflowTemplateStepInput {
  id: string;
  name: string;
  instructionPrompt: string;
  executor: WorkflowTemplateExecutorInput;
}

export interface UpdateWorkflowTemplateInput {
  template_id: string;
  name: string;
  steps: WorkflowTemplateStepInput[];
}

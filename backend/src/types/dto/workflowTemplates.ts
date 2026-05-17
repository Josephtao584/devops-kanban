export interface WorkflowTemplateStepInput {
  id: string;
  name: string;
  instructionPrompt: string;
  agentId: number;
  // Suspend/resume configuration
  requiresConfirmation?: boolean;
  // Loop-back configuration
  onFailureLoopTo?: string | null;
}

export interface CreateWorkflowTemplateInput {
  template_id: string;
  name: string;
  steps: WorkflowTemplateStepInput[];
  tags?: string[];
  maxLoops?: number;
}

export interface UpdateWorkflowTemplateInput {
  template_id: string;
  name: string;
  steps: WorkflowTemplateStepInput[];
  tags?: string[];
  maxLoops?: number;
}

export interface ReorderWorkflowTemplatesInput {
  updates: Array<{ id: number; order: number }>;
}

// Export/Import types

export interface ExportedWorkflowStep {
  id: string;
  name: string;
  instructionPrompt: string;
  agentName: string;
  requiresConfirmation?: boolean;
  canEarlyExit?: boolean;
  type?: string;
  maxRetries?: number;
}

export interface ExportedWorkflowTemplate {
  template_id: string;
  name: string;
  tags?: string[];
  steps: ExportedWorkflowStep[];
}

export interface ExportFile {
  version: string;
  exportedAt: string;
  templates: ExportedWorkflowTemplate[];
}

export interface ImportPreview {
  templates: ExportedWorkflowTemplate[];
  existingTemplateIds: string[];
  unmatchedAgentNames: string[];
}

export interface ImportConfirmInput {
  templates: ExportedWorkflowTemplate[];
  strategy: 'skip' | 'overwrite' | 'copy';
  agentMappings: Record<string, number>;
}

// MCP Server Export/Import types

export interface ExportedMcpServer {
  name: string;
  description?: string;
  server_type: 'stdio' | 'http';
  config: Record<string, unknown>;
  auto_install: number;
  install_command?: string;
}

export interface McpServerExportFile {
  version: string;
  exportedAt: string;
  servers: ExportedMcpServer[];
}

export interface McpServerImportPreview {
  servers: ExportedMcpServer[];
  existingServerNames: string[];
}

export interface McpServerImportConfirmInput {
  servers: ExportedMcpServer[];
  strategy: 'skip' | 'overwrite' | 'copy';
  nameMappings: Record<string, string>;
}

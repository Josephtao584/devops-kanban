import type { ExportedWorkflowTemplate, ExportedMcpServer } from './workflowTemplates.js';

export interface ExportedAgent {
  name: string;
  executorType: string;
  role: string;
  description?: string;
  enabled: boolean;
  skillNames: string[];
  mcpServerNames: string[];
}

export interface ExportedSkill {
  identifier: string;
  name: string;
  description?: string;
}

export interface BundleExportFile {
  version: string;
  exportedAt: string;
  templates: ExportedWorkflowTemplate[];
  agents: ExportedAgent[];
  skills: ExportedSkill[];
  mcpServers: ExportedMcpServer[];
}

export interface BundleResolveResult {
  templates: { template_id: string; name: string; stepCount: number }[];
  agents: ExportedAgent[];
  skills: ExportedSkill[];
  mcpServers: { name: string; server_type: string }[];
}

export interface BundleImportPreview {
  templates: ExportedWorkflowTemplate[];
  agents: ExportedAgent[];
  skills: ExportedSkill[];
  mcpServers: ExportedMcpServer[];
  conflicts: {
    templateIds: string[];
    agentNames: string[];
    skillIdentifiers: string[];
    mcpServerNames: string[];
  };
}

export interface BundleImportConfirmInput {
  templates: ExportedWorkflowTemplate[];
  agents: ExportedAgent[];
  skills: ExportedSkill[];
  mcpServers: ExportedMcpServer[];
  strategy: 'skip' | 'overwrite' | 'copy';
}

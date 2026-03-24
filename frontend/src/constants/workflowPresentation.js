export const agentConfig = {
  CLAUDE: { color: '#8B5CF6', icon: 'Monitor', name: 'Claude' },
  CODEX: { color: '#10B981', icon: 'VideoPlay', name: 'Codex' },
  CURSOR: { color: '#F59E0B', icon: 'Edit', name: 'Cursor' },
  GEMINI: { color: '#3B82F6', icon: 'Cpu', name: 'Gemini' }
}

export const roleConfig = {
  '架构师': { icon: '🧔', color: '#8B5CF6', level: 1 },
  '技术负责人': { icon: '👨‍🦳', color: '#F59E0B', level: 2 },
  '后端开发': { icon: '🧑‍💻', color: '#10B981', level: 3 },
  '前端开发': { icon: '👩‍🏫', color: '#3B82F6', level: 3 },
  '测试工程师': { icon: '👩‍🔬', color: '#EC4899', level: 4 },
  DBA: { icon: '👴', color: '#6366F1', level: 3 },
  '产品经理': { icon: '🧑‍💼', color: '#14B8A6', level: 1 },
  'Tech Lead': { icon: '👨‍🦳', color: '#DC2626', level: 2 },
  Committer: { icon: '🧑‍💻', color: '#7C3AED', level: 1 },
  Reviewer: { icon: '🕵️', color: '#059669', level: 4 },
  'Security Engineer': { icon: '🕵️', color: '#DC2626', level: 2 },
  'DevOps Engineer': { icon: '🧑‍🔧', color: '#EA580C', level: 3 },
  'Release Manager': { icon: '🧑‍💼', color: '#0284C7', level: 1 }
}

export const nodeStatusConfig = {
  DONE: { color: '#10B981', icon: '✓' },
  IN_PROGRESS: { color: '#3B82F6', icon: '▶' },
  PENDING: { color: '#6B7280', icon: '○' },
  FAILED: { color: '#DC2626', icon: '✗' },
  REJECTED: { color: '#F59E0B', icon: '↩' },
  CANCELLED: { color: '#6B7280', icon: '⊘' }
}

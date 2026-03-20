export async function parseStepResult({ stdout = '' }) {
  return { summary: stdout.trim() };
}

export function validateStepResult(result) {
  if (!result?.summary || !result.summary.trim()) {
    throw new Error('summary is required');
  }

  return {
    summary: result.summary.trim(),
  };
}

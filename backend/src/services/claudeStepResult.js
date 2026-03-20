export async function parseStepResult({ resultFileContent, stdout = '' }) {
  if (resultFileContent) {
    return JSON.parse(resultFileContent);
  }

  const marker = stdout
    .trim()
    .split('\n')
    .reverse()
    .find((line) => line.startsWith('__STEP_RESULT__'));

  if (!marker) {
    throw new Error('Missing __STEP_RESULT__ marker');
  }

  return JSON.parse(marker.slice('__STEP_RESULT__'.length));
}

export function validateStepResult(result) {
  if (!result || !Array.isArray(result.changedFiles) || result.changedFiles.length === 0) {
    throw new Error('changedFiles must be a non-empty array');
  }

  if (!result.summary || !result.summary.trim()) {
    throw new Error('summary is required');
  }

  return result;
}

function extractResultFromStreamJson(stdout: string): string {
  let lastResult: string | null = null;
  let lastAssistantText: string | null = null;

  const lines = stdout.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const json = JSON.parse(line);

      // result event has the final response
      if (json.type === 'result' && typeof json.result === 'string') {
        lastResult = json.result;
      }

      // assistant text block (fallback if no result event)
      if (json.type === 'assistant') {
        const content = json.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block?.type === 'text' && typeof block.text === 'string') {
              lastAssistantText = block.text;
            }
          }
        }
      }
    } catch {
      // Not valid JSON, ignore
    }
  }

  return lastResult || lastAssistantText || '';
}

export async function parseStepResult({ stdout = '' }: { stdout?: string }) {
  // For stream-json format, extract only the final result
  const summary = extractResultFromStreamJson(stdout);
  // Fallback to raw stdout if no result found (non-stream-json format)
  return { summary: summary || stdout.trim() };
}

export function validateStepResult(result: { summary?: string } | null | undefined) {
  if (!result?.summary || !result.summary.trim()) {
    throw new Error('summary is required');
  }

  return {
    summary: result.summary.trim(),
  };
}

function extractResultFromStreamJson(stdout: string): string {
  const assistantTextParts: string[] = [];

  const lines = stdout.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const json = JSON.parse(line);

      // assistant event: collect text blocks
      if (json.type === 'assistant') {
        const message = json.message as Record<string, unknown> | undefined;
        const content = message?.content as unknown[] | undefined;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block && typeof block === 'object' && (block as Record<string, unknown>).type === 'text') {
              const text = (block as Record<string, unknown>).text;
              if (typeof text === 'string') {
                assistantTextParts.push(text);
              }
            }
          }
        }
      }
    } catch {
      // Not valid JSON, ignore
    }
  }

  return assistantTextParts.join('\n');
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

/**
 * Extract result from JSON stream output.
 * Supports both OpenCode standard format and nga custom format.
 */
function extractResultFromStreamJson(stdout: string): string {
  let lastResult: string | null = null;
  let lastAssistantText: string | null = null;
  let lastTextEvent: string | null = null;

  const lines = stdout.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const json = JSON.parse(line);

      // OpenCode standard: result event has the final response
      if (json.type === 'result' && typeof json.result === 'string') {
        lastResult = json.result;
      }

      // OpenCode standard: assistant message with content array
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

      // Text event: content is in part.text
      if (json.type === 'text') {
        const part = json.part as Record<string, unknown> | undefined;
        if (typeof part?.text === 'string') {
          lastTextEvent = part.text;
        }
      }

      // NGA custom format: step_finish with summary
      if (json.type === 'step_finish' && json.part?.text) {
        lastResult = json.part.text;
      }
    } catch {
      // Not valid JSON, ignore
    }
  }

  // Priority: result > assistant text > nga text event > raw stdout
  return lastResult || lastAssistantText || lastTextEvent || '';
}

export async function parseStepResult({ stdout = '' }: { stdout?: string }) {
  const summary = extractResultFromStreamJson(stdout);
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

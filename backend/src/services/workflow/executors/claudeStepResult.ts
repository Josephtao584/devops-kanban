import type { EarlyExitDecision } from '../../../types/executors.js';

const EARLY_EXIT_JSON_REGEX = /\{[^{}]*"decision"\s*:\s*"(?:SUCCESS_EXIT|FAIL_EXIT|CONTINUE)"[^{}]*\}/g;

export function extractEarlyExitSignal(summary: string): { signal: { decision: EarlyExitDecision; reason?: string } | null; cleanSummary: string } {
  const matches = summary.match(EARLY_EXIT_JSON_REGEX);
  if (!matches) {
    return { signal: null, cleanSummary: summary };
  }

  for (const candidate of matches) {
    try {
      const parsed = JSON.parse(candidate);
      if (['SUCCESS_EXIT', 'FAIL_EXIT', 'CONTINUE'].includes(parsed.decision)) {
        const signal = {
          decision: parsed.decision as EarlyExitDecision,
          reason: typeof parsed.reason === 'string' ? parsed.reason : undefined,
        };
        const cleanSummary = summary.replace(candidate, '').trim();
        return { signal, cleanSummary };
      }
    } catch {
      // Not valid JSON, try next match
    }
  }

  return { signal: null, cleanSummary: summary };
}

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

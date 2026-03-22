function splitCommand(commandString: string) {
  return commandString.trim().split(/\s+/).filter(Boolean);
}

export function resolveCommand({
  defaultCommand,
  executorConfig,
  processEnv = process.env,
}: {
  defaultCommand: string[];
  executorConfig?: {
    commandOverride?: string | null;
    args?: string[];
    env?: Record<string, string>;
  };
  processEnv?: NodeJS.ProcessEnv;
}) {
  const baseParts = executorConfig?.commandOverride
    ? splitCommand(executorConfig.commandOverride)
    : defaultCommand;

  if (!Array.isArray(baseParts) || baseParts.length === 0) {
    throw new Error('Command must contain at least one part');
  }

  const [command, ...args] = baseParts;

  return {
    command,
    args: [...args, ...(executorConfig?.args || [])],
    env: {
      ...processEnv,
      ...(executorConfig?.env || {}),
    },
  };
}

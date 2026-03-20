function splitCommand(commandString) {
  return commandString.trim().split(/\s+/).filter(Boolean);
}

export function resolveCommand({ defaultCommand, executorConfig, processEnv = process.env }) {
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

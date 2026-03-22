class CodexExecutor {
  runImpl: ((input: unknown) => Promise<{ summary: string }> | { summary: string }) | undefined;

  constructor({ runImpl }: { runImpl?: (input: unknown) => Promise<{ summary: string }> | { summary: string } } = {}) {
    this.runImpl = runImpl;
  }

  async execute(input: unknown) {
    if (!this.runImpl) {
      throw new Error('Codex executor is not implemented');
    }

    return {
      exitCode: 0,
      stdout: '',
      stderr: '',
      proc: null,
      rawResult: await this.runImpl(input),
    };
  }
}

export { CodexExecutor };

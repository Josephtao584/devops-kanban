class OpenCodeExecutor {
  constructor({ runImpl } = {}) {
    this.runImpl = runImpl;
  }

  async execute(input) {
    if (!this.runImpl) {
      throw new Error('OpenCode executor is not implemented');
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

export { OpenCodeExecutor };

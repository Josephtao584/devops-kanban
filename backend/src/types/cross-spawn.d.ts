declare module 'cross-spawn' {
  interface SpawnedProcess {
    stdout?: {
      on(event: 'data', listener: (data: Buffer | string) => void): void;
    };
    stderr?: {
      on(event: 'data', listener: (data: Buffer | string) => void): void;
    };
    on(event: 'error', listener: (error: Error) => void): void;
    on(event: 'close', listener: (exitCode: number | null) => void): void;
  }

  export default function crossSpawn(command: string, args: string[], options: Record<string, unknown>): SpawnedProcess;
}

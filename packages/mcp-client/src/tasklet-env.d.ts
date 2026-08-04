// Tasklet preview bridge APIs required by the MCP transport.

interface TaskletApi {
  readonly writeFileToDisk: (filePath: string, content: string) => Promise<{ readonly ok: true }>;
  readonly runCommand: (
    command: string,
    timeout?: number,
  ) => Promise<{ readonly log: string; readonly exitCode: number }>;
}

interface Window {
  readonly tasklet: TaskletApi;
}

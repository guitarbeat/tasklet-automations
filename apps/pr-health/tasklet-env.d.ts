// Tasklet preview bridge APIs used by the PR Health app.

interface TaskletApi {
  readonly sendMessageToAgent: (message: string) => Promise<{ readonly status: string } | null>;
  readonly runTool: (toolName: string, args: unknown) => Promise<unknown>;
  readonly sqlQuery: (query: string) => Promise<ReadonlyArray<Record<string, unknown>>>;
  readonly sqlExec: (query: string) => Promise<{ readonly rowsAffected: number }>;
}

interface Window {
  readonly tasklet: TaskletApi;
}

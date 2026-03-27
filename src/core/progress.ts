export type ProgressUpdate = {
  label?: string;
  completed?: number;
  total?: number;
};

export type ProgressReporter = (update: ProgressUpdate) => void;

export type ProgressHandle = {
  setLabel: (label: string) => void;
  update?: (update: ProgressUpdate) => void;
  done: () => void;
};

export function createCliProgress(_opts: {
  label: string;
  indeterminate?: boolean;
  enabled?: boolean;
  fallback?: "none" | "text";
}): ProgressHandle {
  return {
    setLabel: () => {},
    update: () => {},
    done: () => {},
  };
}

export async function withProgress<T>(
  _opts: {
    label: string;
    indeterminate?: boolean;
    enabled?: boolean;
  },
  run: () => Promise<T>,
): Promise<T> {
  return await run();
}

export async function withProgressTotals<T>(
  _opts: {
    label: string;
    indeterminate?: boolean;
    enabled?: boolean;
  },
  run: (update: ProgressReporter) => Promise<T>,
): Promise<T> {
  return await run(() => {});
}

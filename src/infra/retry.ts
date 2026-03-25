import { computeBackoff, sleepWithAbort, type BackoffPolicy } from "./backoff.js";

export type RetryPolicy = BackoffPolicy & {
  maxRetries: number;
};

export type RetryAttemptInfo = {
  attempt: number;
  retryCount: number;
  maxRetries: number;
  delayMs: number;
  error: unknown;
  context?: string;
  status?: number;
};

export type RetryOptions = {
  context?: string;
  label?: string;
  attempts?: number;
  maxRetries?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  jitter?: number;
  policy?: Partial<BackoffPolicy>;
  abortSignal?: AbortSignal;
  shouldRetry?: (err: unknown) => boolean;
  onRetry?: (info: RetryAttemptInfo) => void;
};

const DEFAULT_POLICY: RetryPolicy = {
  initialMs: 500,
  maxMs: 8_000,
  factor: 2,
  jitter: 0.2,
  maxRetries: 3,
};

const defaultShouldRetry = () => true;

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const requestedMaxRetries =
    opts.maxRetries ?? (typeof opts.attempts === 'number' ? Math.max(opts.attempts - 1, 0) : DEFAULT_POLICY.maxRetries);
  const maxRetries = Math.max(requestedMaxRetries, 3);
  const policy: BackoffPolicy = {
    initialMs: opts.policy?.initialMs ?? opts.minDelayMs ?? DEFAULT_POLICY.initialMs,
    maxMs: opts.policy?.maxMs ?? opts.maxDelayMs ?? DEFAULT_POLICY.maxMs,
    factor: opts.policy?.factor ?? opts.factor ?? DEFAULT_POLICY.factor,
    jitter: opts.policy?.jitter ?? opts.jitter ?? DEFAULT_POLICY.jitter,
  };
  const shouldRetry = opts.shouldRetry ?? defaultShouldRetry;
  let attempt = 0;

  while (true) {
    attempt += 1;
    try {
      return await fn(attempt);
    } catch (err) {
      const retryCount = attempt - 1;
      const canRetry = retryCount < maxRetries && shouldRetry(err);
      if (!canRetry) {
        throw err;
      }
      const delayMs = computeBackoff(policy, retryCount + 1);
      opts.onRetry?.({
        attempt,
        retryCount,
        maxRetries,
        delayMs,
        error: err,
        context: opts.context ?? opts.label,
      });
      await sleepWithAbort(delayMs, opts.abortSignal);
    }
  }
}

export const retryAsync = withRetry;

type FetchRetryOptions = RetryOptions & {
  fetchImpl?: typeof fetch;
  retryOnStatuses?: number[];
};

function getRetryStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") {
    return undefined;
  }
  const status = (err as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function createRetryableFetchError(status: number, statusText: string, context?: string) {
  const message = context
    ? `fetch failed (${status} ${statusText}) for ${context}`
    : `fetch failed (${status} ${statusText})`;
  const error = new Error(message);
  (error as { status?: number }).status = status;
  return error;
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  opts: FetchRetryOptions = {},
): Promise<Response> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new Error("fetch is not available in this runtime");
  }
  const retryOnStatuses = opts.retryOnStatuses ?? [429, 500, 502, 503, 504];

  return await withRetry(
    async () => {
      const response = await fetchImpl(input, init);
      if (retryOnStatuses.includes(response.status)) {
        throw createRetryableFetchError(response.status, response.statusText, opts.context);
      }
      return response;
    },
    {
      ...opts,
      shouldRetry: (err) => {
        const status = getRetryStatus(err);
        if (status !== undefined) {
          return retryOnStatuses.includes(status);
        }
        return true;
      },
      onRetry: (info) => {
        const status = getRetryStatus(info.error);
        const context = info.context ? ` (${info.context})` : "";
        const statusInfo = status ? ` status=${status}` : "";
        console.warn(
          `[retry] attempt ${info.retryCount + 1}/${info.maxRetries}${context}${statusInfo} - retrying in ${info.delayMs}ms`,
        );
        opts.onRetry?.({ ...info, status });
      },
    },
  );
}


const DEFAULT_TIMEOUT_MS = 15_000;

export class ApiHttpError extends Error {
  status: number;
  bodyText?: string;

  constructor(status: number, message: string, bodyText?: string) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
    this.bodyText = bodyText;
  }
}

export class ApiTimeoutError extends Error {
  constructor(message = 'Request timeout') {
    super(message);
    this.name = 'ApiTimeoutError';
  }
}

export const readResponseTextSafe = async (
  response: Response
): Promise<string | undefined> => {
  try {
    const text = await response.text();
    return text.length > 0 ? text : undefined;
  } catch {
    return undefined;
  }
};

export const fetchWithTimeout = async (
  input: RequestInfo,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> => {
  const controller = new AbortController();
  let didTimeout = false;

  const abortFromUpstream = () => {
    controller.abort();
  };

  if (init.signal) {
    if (init.signal.aborted) {
      controller.abort();
    } else {
      init.signal.addEventListener('abort', abortFromUpstream, { once: true });
    }
  }

  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (didTimeout) {
      throw new ApiTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    if (init.signal) {
      init.signal.removeEventListener('abort', abortFromUpstream);
    }
  }
};

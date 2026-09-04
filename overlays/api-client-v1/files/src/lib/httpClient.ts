export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export type ApiOk<T> = { ok: true; data: T; response: Response };
export type ApiFail = { ok: false; error: ApiError };
export type ApiResult<T> = ApiOk<T> | ApiFail;

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function errorMessage(status: number, body: unknown): string {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  if (typeof body === "string" && body.trim()) return body;
  return `HTTP ${status}`;
}

/**
 * Domain-neutral JSON HTTP helper.
 * Returns a result object so callers can branch without try/catch for HTTP failures.
 * Network failures (offline, abort) still throw.
 */
export async function requestJson<T>(options: {
  url: string;
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}): Promise<ApiResult<T>> {
  const method = options.method ?? (options.body === undefined ? "GET" : "POST");
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...options.headers,
  };
  let body: string | undefined;
  if (options.body !== undefined) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
    body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }

  const response = await fetch(options.url, {
    method,
    headers,
    body,
    signal: options.signal,
  });
  const parsed = await readBody(response);
  if (!response.ok) {
    return {
      ok: false,
      error: new ApiError(errorMessage(response.status, parsed), response.status, parsed),
    };
  }
  return { ok: true, data: parsed as T, response };
}

export function getJson<T>(
  url: string,
  options?: Omit<Parameters<typeof requestJson<T>>[0], "url" | "method" | "body">,
): Promise<ApiResult<T>> {
  return requestJson<T>({ ...options, url, method: "GET" });
}

export function postJson<T>(
  url: string,
  body?: unknown,
  options?: Omit<Parameters<typeof requestJson<T>>[0], "url" | "method" | "body">,
): Promise<ApiResult<T>> {
  return requestJson<T>({ ...options, url, method: "POST", body });
}

export function putJson<T>(
  url: string,
  body?: unknown,
  options?: Omit<Parameters<typeof requestJson<T>>[0], "url" | "method" | "body">,
): Promise<ApiResult<T>> {
  return requestJson<T>({ ...options, url, method: "PUT", body });
}

export function patchJson<T>(
  url: string,
  body?: unknown,
  options?: Omit<Parameters<typeof requestJson<T>>[0], "url" | "method" | "body">,
): Promise<ApiResult<T>> {
  return requestJson<T>({ ...options, url, method: "PATCH", body });
}

export function deleteJson<T>(
  url: string,
  options?: Omit<Parameters<typeof requestJson<T>>[0], "url" | "method" | "body">,
): Promise<ApiResult<T>> {
  return requestJson<T>({ ...options, url, method: "DELETE" });
}

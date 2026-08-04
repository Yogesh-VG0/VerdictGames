const RAWG_BASE_URL = "https://api.rawg.io/api";

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const DEFAULT_TIMEOUT_MS = positiveInteger(process.env.RAWG_TIMEOUT_MS, 30_000);
const DEFAULT_ATTEMPTS = positiveInteger(process.env.RAWG_MAX_ATTEMPTS, 3);
const MAX_CONCURRENCY = positiveInteger(process.env.RAWG_MAX_CONCURRENCY, 4);
const CIRCUIT_FAILURE_LIMIT = positiveInteger(process.env.RAWG_CIRCUIT_FAILURES, 4);

let activeRequests = 0;
const requestQueue = [];
let consecutiveFailures = 0;
let circuitOpenedAt = 0;

export class RawgRequestError extends Error {
  constructor(message, { status = null, retryable = false, endpoint = null, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "RawgRequestError";
    this.status = status;
    this.retryable = retryable;
    this.endpoint = endpoint;
  }
}

function getApiKey() {
  const key = process.env.RAWG_API_KEY;
  if (!key) {
    throw new RawgRequestError("Missing RAWG_API_KEY", { retryable: false });
  }
  return key;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function retryDelayMs(response, attempt) {
  const retryAfter = response?.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number.parseFloat(retryAfter);
    if (Number.isFinite(seconds)) return Math.min(30_000, Math.max(0, seconds * 1000));
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.min(30_000, Math.max(0, date - Date.now()));
  }

  const base = Math.min(8_000, 1000 * 2 ** (attempt - 1));
  return base + Math.floor(Math.random() * 500);
}

function circuitIsOpen() {
  return circuitOpenedAt !== 0;
}

function recordFailure() {
  consecutiveFailures++;
  if (consecutiveFailures >= CIRCUIT_FAILURE_LIMIT) {
    circuitOpenedAt = Date.now();
  }
}

function recordSuccess() {
  if (circuitOpenedAt) return;
  consecutiveFailures = 0;
}

function drainQueue() {
  while (activeRequests < MAX_CONCURRENCY && requestQueue.length > 0) {
    const next = requestQueue.shift();
    activeRequests++;
    Promise.resolve()
      .then(next.task)
      .then(next.resolve, next.reject)
      .finally(() => {
        activeRequests--;
        drainQueue();
      });
  }
}

function withConcurrencyLimit(task) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ task, resolve, reject });
    drainQueue();
  });
}

export async function rawgFetchJson(
  endpoint,
  { params = {}, timeoutMs = DEFAULT_TIMEOUT_MS, attempts = DEFAULT_ATTEMPTS } = {},
) {
  return withConcurrencyLimit(async () => {
    if (circuitIsOpen()) {
      throw new RawgRequestError(`RAWG circuit is open for ${endpoint}`, {
        retryable: true,
        endpoint,
      });
    }

    const url = new URL(`${RAWG_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`);
    url.searchParams.set("key", getApiKey());
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    let lastError = null;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      let response = null;
      const startedAt = Date.now();
      try {
        response = await fetch(url, {
          headers: {
            Accept: "application/json",
            "User-Agent": "VerdictGames-Scheduler/1.0",
          },
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (response.ok) {
          const data = await response.json();
          recordSuccess();
          return data;
        }

        const retryable = isRetryableStatus(response.status);
        lastError = new RawgRequestError(`RAWG ${endpoint} returned HTTP ${response.status}`, {
          status: response.status,
          retryable,
          endpoint,
        });
        if (!retryable) throw lastError;
      } catch (error) {
        if (error instanceof RawgRequestError && !error.retryable) throw error;
        lastError = error instanceof RawgRequestError
          ? error
          : new RawgRequestError(`RAWG ${endpoint} request failed: ${error.message}`, {
              retryable: true,
              endpoint,
              cause: error,
            });
      }

      const elapsedMs = Date.now() - startedAt;
      console.warn(
        `[RAWG] ${endpoint} attempt ${attempt}/${attempts} failed after ${elapsedMs}ms: ${lastError.message}`,
      );
      if (attempt < attempts) {
        await sleep(retryDelayMs(response, attempt));
      }
    }

    recordFailure();
    throw lastError ?? new RawgRequestError(`RAWG ${endpoint} failed`, {
      retryable: true,
      endpoint,
    });
  });
}

export function isRetryableRawgError(error) {
  return error instanceof RawgRequestError && error.retryable;
}

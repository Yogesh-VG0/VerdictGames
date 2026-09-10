import { describe, expect, it, vi } from "vitest";
import {
  acquireLock,
  checkMinInterval,
  isInfrastructureDbError,
  retryInfrastructureDbOperation,
} from "../../scripts/lib/scheduler-logger.mjs";

describe("isInfrastructureDbError", () => {
  it.each([
    "Failed to connect to database: {:error, :timeout}",
    "connect timeout",
    "connection refused",
    "MaxClientsInSessionMode",
    "(EAUTHQUERY) auth_query secret check timed out",
  ])("recognizes transient database failures: %s", (message) => {
    expect(isInfrastructureDbError(new Error(message))).toBe(true);
  });

  it.each(["ETIMEDOUT", "ECONNRESET", "EAI_AGAIN"])(
    "recognizes infrastructure error code %s",
    (code) => {
      expect(isInfrastructureDbError({ code, message: "request failed" })).toBe(true);
    },
  );

  it("does not classify SQL errors as infrastructure failures", () => {
    expect(isInfrastructureDbError({ code: "42P01", message: "relation does not exist" })).toBe(false);
  });
});

describe("retryInfrastructureDbOperation", () => {
  it("retries infrastructure failures until the operation succeeds", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const operation = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("timed out"), { code: "ETIMEDOUT" }))
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockResolvedValue("ok");

    await expect(retryInfrastructureDbOperation("test query", operation, {
      attempts: 3,
      initialDelayMs: 0,
    })).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(3);
    expect(warning).toHaveBeenCalledTimes(2);
    warning.mockRestore();
  });

  it("throws after infrastructure retries are exhausted", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = Object.assign(new Error("database connection refused"), { code: "ECONNREFUSED" });
    const operation = vi.fn().mockRejectedValue(error);

    await expect(retryInfrastructureDbOperation("test query", operation, {
      attempts: 3,
      initialDelayMs: 0,
    })).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(3);
    warning.mockRestore();
  });

  it("does not retry non-infrastructure failures", async () => {
    const error = Object.assign(new Error("relation does not exist"), { code: "42P01" });
    const operation = vi.fn().mockRejectedValue(error);

    await expect(retryInfrastructureDbOperation("test query", operation, {
      attempts: 3,
      initialDelayMs: 0,
    })).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});

describe("scheduler skip guards", () => {
  it("returns false for genuine advisory-lock contention", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const reserved = vi.fn().mockResolvedValue([{ acquired: false }]) as ReturnType<typeof vi.fn> & { release: ReturnType<typeof vi.fn> };
    reserved.release = vi.fn();
    const sql = { reserve: vi.fn().mockResolvedValue(reserved) };

    await expect(acquireLock(sql, "test-job")).resolves.toBe(false);
    expect(sql.reserve).toHaveBeenCalledTimes(1);
    expect(reserved.release).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });

  it("returns false when the last successful run is too recent", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const sql = vi.fn().mockResolvedValue([{ completed_at: new Date().toISOString() }]);

    await expect(checkMinInterval(sql, "test-job", 5)).resolves.toBe(false);
    expect(sql).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });
});

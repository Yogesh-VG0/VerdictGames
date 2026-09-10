import { describe, expect, it } from "vitest";
import { isInfrastructureDbError } from "../../scripts/lib/scheduler-logger.mjs";

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

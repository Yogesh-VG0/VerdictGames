export type RelatedStage = "game-resolution" | "candidate-lookup";
type RelatedReason = "database-transport-timeout" | "database-query-cancelled" | "database-unavailable" | "provider-failure";

export class RelatedDependencyError extends Error {
  constructor(readonly reason: RelatedReason) {
    super(reason);
  }
}

export function relatedFailureReason(stage: RelatedStage, error: unknown) {
  if (error instanceof RelatedDependencyError) return error.reason;
  if (error instanceof Error && error.name === "TimeoutError") return `${stage}-timeout`;
  return "unexpected";
}

export function relatedDatabaseError(error: unknown, transport: AbortSignal, overall?: AbortSignal) {
  if (overall?.aborted) return overall.reason;
  const code = typeof error === "object" && error && "code" in error ? error.code : undefined;
  if (transport.aborted || (error instanceof Error && error.name === "TimeoutError")) {
    return new RelatedDependencyError("database-transport-timeout");
  }
  return new RelatedDependencyError(code === "57014" ? "database-query-cancelled" : "database-unavailable");
}

/**
 * Stable error codes for MCP tools.
 *
 * A chat host decides what to tell the user, and whether to retry, from these —
 * so they are a contract, not prose. The message is for the model to relay; the
 * code is for it to branch on. Neither may carry database or provider detail.
 */
export type McpErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "VERSION_CONFLICT"
  | "QUOTA_EXCEEDED"
  | "RUN_EXPIRED"
  | "STEP_IN_PROGRESS"
  | "MODEL_UNAVAILABLE"
  | "INTERNAL";

export interface McpErrorBody {
  code: McpErrorCode;
  message: string;
  /** Seconds to wait before retrying, when retrying can help. */
  retryAfter?: number;
}

export function toolError(code: McpErrorCode, message: string, retryAfter?: number) {
  const body: McpErrorBody = { code, message, ...(retryAfter ? { retryAfter } : {}) };
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: `${code}: ${message}` }],
    structuredContent: { error: body } as Record<string, unknown>,
  };
}

/** Map the project-access failure reasons onto codes. */
export function accessError(reason: string | null) {
  if (reason === "not-found") return toolError("NOT_FOUND", "No such project.");
  // "forbidden" and "unauthenticated" read the same to the caller on purpose:
  // distinguishing them would confirm that a project id exists.
  return toolError("FORBIDDEN", "You do not have access to that project.");
}

/**
 * Classify a thrown error from a model step. Provider failures are free text, so
 * this is a best-effort match on the failure modes users can actually fix —
 * everything else is reported as INTERNAL rather than guessed at.
 */
export function classifyStepError(message: string): McpErrorCode {
  if (/credit|quota|billing|insufficient|rate.?limit|429|api key|unauthor|forbidden|not found|no model|overloaded|unavailable/i.test(message)) {
    return "MODEL_UNAVAILABLE";
  }
  return "INTERNAL";
}

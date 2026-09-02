import { ZodError } from "zod";
import { AdminForbiddenError, AdminUnauthorizedError } from "./session";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export class ActionError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ActionError";
  }
}

export function fieldErrorsOf(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/**
 * Wraps a Server Action body so permission failures, validation failures and
 * unexpected errors all come back as a plain result the client can render.
 */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data } as ActionResult<T>;
  } catch (err) {
    if (err instanceof AdminUnauthorizedError) {
      return { ok: false, error: "Your session expired. Sign in again." };
    }
    if (err instanceof AdminForbiddenError) {
      return { ok: false, error: "Your role does not allow that." };
    }
    if (err instanceof ActionError) {
      return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
    }
    if (err instanceof ZodError) {
      return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsOf(err) };
    }
    // Next uses thrown objects for redirect() and notFound(); let those through.
    if (err && typeof err === "object" && "digest" in err && typeof err.digest === "string") throw err;
    console.error("admin action failed", err);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

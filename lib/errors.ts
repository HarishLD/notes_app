export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(readonly fields: Record<string, string[]>) {
    super("Please check your input and try again.", 400, "VALIDATION_ERROR");
  }
}
export class UnauthorizedError extends AppError {
  // Covers an expired/invalid/missing session (jwt.ts, session.ts) — the
  // one caller with a different story, a failed signin, passes its own
  // message rather than branching in the UI on which case this is.
  constructor(message = "Your session has expired. Please sign in again.") {
    super(message, 401, "UNAUTHORIZED");
  }
}
export class ForbiddenError extends AppError {
  constructor() {
    super("Not allowed", 403, "FORBIDDEN");
  }
}
export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404, "NOT_FOUND");
  }
}
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

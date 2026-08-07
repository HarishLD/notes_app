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
    super("Invalid input", 400, "VALIDATION_ERROR");
  }
}
export class UnauthorizedError extends AppError {
  constructor() {
    super("Not authenticated", 401, "UNAUTHORIZED");
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

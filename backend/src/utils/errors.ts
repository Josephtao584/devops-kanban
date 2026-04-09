interface AppErrorOptions {
  statusCode: number;
  code: string;
  userMessage: string;
  internalMessage: string;
  context?: Record<string, unknown> | undefined;
}

export class AppError extends Error {
  statusCode: number;
  code: string;
  userMessage: string;
  internalMessage: string;
  context: Record<string, unknown>;

  constructor(options: AppErrorOptions) {
    super(options.internalMessage);
    this.name = this.constructor.name;
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.userMessage = options.userMessage;
    this.internalMessage = options.internalMessage;
    this.context = options.context ?? {};
  }
}

export class ValidationError extends AppError {
  constructor(userMessage: string, internalMessage: string, context?: Record<string, unknown>) {
    super({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      userMessage,
      internalMessage,
      context,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(userMessage: string, internalMessage: string, context?: Record<string, unknown>) {
    super({
      statusCode: 404,
      code: 'NOT_FOUND',
      userMessage,
      internalMessage,
      context,
    });
  }
}

export class ConflictError extends AppError {
  constructor(userMessage: string, internalMessage: string, context?: Record<string, unknown>) {
    super({
      statusCode: 409,
      code: 'CONFLICT',
      userMessage,
      internalMessage,
      context,
    });
  }
}

export class BusinessError extends AppError {
  constructor(userMessage: string, internalMessage: string, context?: Record<string, unknown>) {
    super({
      statusCode: 400,
      code: 'BUSINESS_RULE',
      userMessage,
      internalMessage,
      context,
    });
  }
}

export class InternalError extends AppError {
  constructor(userMessage: string, internalMessage: string, context?: Record<string, unknown>) {
    super({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      userMessage,
      internalMessage,
      context,
    });
  }
}

import { HttpException, HttpStatus } from '@nestjs/common';

/** Errors carry a stable `code` so the web can react without parsing messages. */
export class AppError extends HttpException {
  constructor(status: HttpStatus, code: string, message: string, extra: Record<string, unknown> = {}) {
    super({ statusCode: status, code, message, ...extra }, status);
  }
}

export const unauthenticated = (message = 'Sign in to continue') => new AppError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', message);
export const accessEnded = () => new AppError(HttpStatus.UNAUTHORIZED, 'ACCESS_ENDED', 'Your access has ended. Ask the owner if this looks wrong.');
export const forbidden = (message = 'You do not have access to this') => new AppError(HttpStatus.FORBIDDEN, 'FORBIDDEN', message);
export const notFound = (what: string) => new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', `${what} not found`);
export const conflict = (code: string, message: string) => new AppError(HttpStatus.CONFLICT, code, message);

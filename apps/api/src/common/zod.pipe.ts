import { HttpStatus, PipeTransform } from '@nestjs/common';
import type { ZodTypeAny, z } from 'zod';
import { AppError } from './errors.js';

/** Validates with the same zod schemas the web uses (packages/shared), so the contract cannot drift. */
export class ZodPipe<T extends ZodTypeAny> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value ?? {});
    if (result.success) return result.data;
    const errors = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    throw new AppError(HttpStatus.BAD_REQUEST, 'VALIDATION', errors[0]?.message ?? 'Check the details and try again', { errors });
  }
}

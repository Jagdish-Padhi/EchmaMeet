import { AppError } from '@chaosboard/shared';

export type ModelErrorClass =
  'timeout' | 'transport_error' | 'refusal' | 'malformed_output' | 'schema_mismatch';

export class ModelCallError extends AppError {
  readonly errorClass: ModelErrorClass;

  constructor(errorClass: ModelErrorClass, message: string, cause?: unknown) {
    const kind = errorClass === 'timeout' ? 'timeout' : 'unavailable';
    super(kind, `model_${errorClass}`, message, { cause });
    this.name = 'ModelCallError';
    this.errorClass = errorClass;
  }
}

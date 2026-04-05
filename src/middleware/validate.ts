import { validationResult, type FieldValidationError } from 'express-validator';
import type { Request, Response, NextFunction } from 'express';

export const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors
        .array()
        .filter((e): e is FieldValidationError => e.type === 'field')
        .map((e) => ({ field: e.path, message: e.msg })),
    });
    return;
  }
  next();
};

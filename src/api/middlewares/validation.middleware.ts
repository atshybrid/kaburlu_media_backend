
import { plainToClass } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { Request, Response, NextFunction } from 'express';

export function validationMiddleware<T>(type: any): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const dto = plainToClass(type, req.body);
    validate(dto).then((errors: ValidationError[]) => {
      if (errors.length > 0) {
        const errorMessages = errors.map(error => Object.values(error.constraints || {})).join(', ');
        res.status(400).json({ error: `Validation failed: ${errorMessages}` });
      } else {
        req.body = dto;
        next();
      }
    });
  };
}

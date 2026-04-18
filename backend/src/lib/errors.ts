import type { NextFunction, Request, Response } from 'express';

export type ApiErrorResponse = {
  error: string;
  message: string;
  code: string;
  details?: unknown;
};

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(opts: { status: number; code: string; message: string; details?: unknown }) {
    super(opts.message);
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
  }
}

export function notFound(_req: Request, res: Response) {
  const body: ApiErrorResponse = { error: 'Not Found', message: 'Route not found', code: 'NOT_FOUND' };
  res.status(404).json(body);
}

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    const body: ApiErrorResponse = {
      error: 'Request Error',
      message: err.message,
      code: err.code,
      details: err.details,
    };
    res.status(err.status).json(body);
    return;
  }

  const body: ApiErrorResponse = { error: 'Internal Server Error', message: 'Unexpected error', code: 'INTERNAL' };
  res.status(500).json(body);
}


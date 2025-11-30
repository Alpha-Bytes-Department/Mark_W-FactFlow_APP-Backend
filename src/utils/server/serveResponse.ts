import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export type TPagination = {
  page: number;
  limit: number;
  totalPages: number;
  total: number;
};

export type TServeResponse<T> = {
  success: boolean;
  statusCode: number;
  message: string;
  meta?: Record<string, unknown> & { pagination?: TPagination };
  data?: T;
};

/**
 * Sends a standardized API response with consistent formatting
 * including success status, message, metadata and optional data payload
 */
const serveResponse = <T>(
  res: Response,
  {
    statusCode = StatusCodes.OK,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    success = true,
    message = 'Success',
    meta,
    data,
  }: Partial<TServeResponse<T>> = {},
): void => {
  res.statusMessage = message;

  res.status(statusCode).json(meta ? { meta, data } : data);
};

export default serveResponse;

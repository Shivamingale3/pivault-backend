import winston from 'winston';
import type { ILogger } from './ILogger.js';

export interface WinstonLoggerOptions {
  level: 'debug' | 'info' | 'warn' | 'error';
  /** `pretty` = colourised human-readable lines, `json` = structured for log shippers. */
  format: 'pretty' | 'json';
}

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const prettyFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: time, stack }) => {
    return `${time as string} [${level}]: ${String(stack ?? message)}`;
  }),
);

const jsonFormat = combine(timestamp(), errors({ stack: true }), json());

/** Adapter: exposes winston through the library-agnostic `ILogger` contract. */
export class WinstonLogger implements ILogger {
  private readonly logger: winston.Logger;

  constructor(options: WinstonLoggerOptions) {
    this.logger = winston.createLogger({
      level: options.level,
      format: options.format === 'pretty' ? prettyFormat : jsonFormat,
      transports: [new winston.transports.Console()],
    });
  }

  debug(message: string, ...meta: unknown[]): void {
    this.logger.debug(message, ...meta);
  }

  info(message: string, ...meta: unknown[]): void {
    this.logger.info(message, ...meta);
  }

  warn(message: string, ...meta: unknown[]): void {
    this.logger.warn(message, ...meta);
  }

  error(message: string, ...meta: unknown[]): void {
    this.logger.error(message, ...meta);
  }
}

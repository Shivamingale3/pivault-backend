import type { IErrorMapper, MappedError } from './IErrorMapper.js';

interface BodyParserError {
  type: string;
  status: number;
}

const MESSAGES_BY_TYPE: Readonly<Record<string, string>> = {
  'entity.parse.failed': 'Malformed JSON body',
  'entity.too.large': 'Request body too large',
  'encoding.unsupported': 'Unsupported request body encoding',
  'charset.unsupported': 'Unsupported request body charset',
};

function isBodyParserError(error: unknown): error is BodyParserError {
  return (
    error instanceof Error &&
    'type' in error &&
    typeof error.type === 'string' &&
    'status' in error &&
    typeof error.status === 'number'
  );
}

/**
 * `express.json()` / `express.urlencoded()` failures (malformed JSON, oversized
 * body…) are client errors. Without this mapper they would surface as 500.
 * Messages are fixed strings so parser internals never leak to the client.
 */
export class BodyParserErrorMapper implements IErrorMapper {
  map(error: unknown): MappedError | null {
    if (!isBodyParserError(error) || error.status < 400 || error.status >= 500) return null;
    return {
      statusCode: error.status,
      message: MESSAGES_BY_TYPE[error.type] ?? 'Invalid request body',
    };
  }
}

import { BadRequestError } from '../../core/errors/HttpErrors.js';
import { INVALID_LINK_MESSAGE } from './passwordLink.constants.js';

export class InvalidLinkError extends BadRequestError {
  constructor(options?: ErrorOptions) {
    super(INVALID_LINK_MESSAGE, options);
  }
}

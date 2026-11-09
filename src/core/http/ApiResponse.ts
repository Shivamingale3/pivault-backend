/** Uniform response envelope returned by every endpoint. */
export interface IApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export class ApiResponse<T> implements IApiResponse<T> {
  constructor(
    public success: boolean,
    public message: string,
    public data: T,
  ) {}

  static success<T>(message: string, data: T): ApiResponse<T> {
    return new ApiResponse(true, message, data);
  }

  static error<T>(message: string, data: T): ApiResponse<T> {
    return new ApiResponse(false, message, data);
  }
}

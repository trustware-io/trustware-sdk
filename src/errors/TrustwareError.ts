import { TrustwareErrorCode } from "./errorCodes";

export class TrustwareError extends Error {
  code: TrustwareErrorCode;
  userMessage?: string;
  cause?: unknown;

  constructor(params: {
    code: TrustwareErrorCode;
    message: string;
    userMessage?: string;
    cause?: unknown;
  }) {
    super(params.message);

    this.name = "TrustwareError";
    this.code = params.code;
    this.userMessage = params.userMessage;
    this.cause = params.cause;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
    };
  }
}

declare module "jsonwebtoken" {
  export interface JwtPayload {
    [key: string]: unknown;
    exp?: number;
    iat?: number;
    iss?: string;
    aud?: string | string[];
    sub?: string;
  }

  export type Secret = string | Buffer;

  export interface SignOptions {
    issuer?: string;
    audience?: string | string[];
    subject?: string;
    expiresIn?: string | number;
  }

  export interface VerifyOptions {
    issuer?: string;
    audience?: string | string[];
    ignoreExpiration?: boolean;
  }

  export function sign(
    payload: string | Buffer | object,
    secretOrPrivateKey: Secret,
    options?: SignOptions,
  ): string;

  export function verify(
    token: string,
    secretOrPublicKey: Secret,
    options?: VerifyOptions,
  ): string | JwtPayload;

  const jwt: {
    sign: typeof sign;
    verify: typeof verify;
  };

  export default jwt;
}

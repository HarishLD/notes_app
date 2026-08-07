import { jwtVerify, SignJWT } from "jose";
import { UnauthorizedError } from "@/lib/errors";

const ALGORITHM = "HS256";
const EXPIRY = "7d";

// Fail fast at startup rather than on the first request — a missing secret
// is a deploy-configuration error, not a per-request one.
const secretValue = process.env.JWT_SECRET;
if (!secretValue) {
  throw new Error("JWT_SECRET is not set");
}
const secret = new TextEncoder().encode(secretValue);

export async function signSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<{ sub: string }> {
  // jose throws several distinct error types here (bad signature, malformed
  // compact JWS, expiry) — all of them mean the same thing to a caller: the
  // session isn't valid. Converting them to one typed error is the point.
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [ALGORITHM] });
    if (!payload.sub) {
      throw new UnauthorizedError();
    }
    return { sub: payload.sub };
  } catch {
    throw new UnauthorizedError();
  }
}

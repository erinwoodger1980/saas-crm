import crypto from "crypto";
import bcrypt from "bcrypt";

const DEFAULT_TOKEN_BYTES = 32;
const DEFAULT_SALT_ROUNDS = 12;

export function generateSignupToken(bytes = DEFAULT_TOKEN_BYTES): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function signupTokenExpiresAt(hours = 24): Date {
  const expires = new Date();
  expires.setHours(expires.getHours() + hours);
  return expires;
}

export function addHours(base: Date, hours: number): Date {
  const result = new Date(base);
  result.setHours(result.getHours() + hours);
  return result;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, DEFAULT_SALT_ROUNDS);
}

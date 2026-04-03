import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PASSWORD_SCHEME = "scrypt";
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

export const MIN_PASSWORD_LENGTH = 8;

function hex(buffer: Buffer): string {
  return buffer.toString("hex");
}

function fromHex(input: string): Buffer {
  return Buffer.from(input, "hex");
}

function parseStoredPassword(value: string): {
  salt: Buffer;
  hash: Buffer;
} | null {
  const parts = value.split("$");
  if (
    parts.length !== 6 ||
    parts[0] !== PASSWORD_SCHEME ||
    parts[1] !== String(SCRYPT_N) ||
    parts[2] !== String(SCRYPT_R) ||
    parts[3] !== String(SCRYPT_P)
  ) {
    return null;
  }

  try {
    const salt = fromHex(parts[4]);
    const hash = fromHex(parts[5]);
    if (salt.length === 0 || hash.length === 0) {
      return null;
    }

    return { salt, hash };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P
  });

  return `${PASSWORD_SCHEME}$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${hex(salt)}$${hex(derived)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseStoredPassword(stored);
  if (!parsed) {
    return false;
  }

  const derived = scryptSync(password, parsed.salt, parsed.hash.length, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P
  });

  if (derived.length !== parsed.hash.length) {
    return false;
  }

  return timingSafeEqual(derived, parsed.hash);
}

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Symmetric encryption for user-supplied API keys (BYOK), so provider keys are
 * never stored in plaintext. Uses AES-256-GCM. The key is derived from
 * ENCRYPTION_SECRET via scrypt, so the secret can be any length.
 *
 * Stored format: base64(iv).base64(authTag).base64(ciphertext)
 */

const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // GCM standard nonce length
// Fixed salt: we only derive one key from one secret, so a static salt is fine.
const SALT = "spi-ai.byok.v1";

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error(
      "ENCRYPTION_SECRET is not set. Add a random 32+ char secret to your env to enable BYOK."
    );
  }
  return scryptSync(secret, SALT, 32);
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(".");
}

export function decryptSecret(stored: string): string {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = stored.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted secret");
  }
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Last 4 chars of a key, for display ("••••abcd"). */
export function lastFour(key: string): string {
  return key.slice(-4);
}

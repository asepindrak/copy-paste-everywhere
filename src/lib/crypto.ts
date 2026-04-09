import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const rawKey = process.env.ENCRYPTION_KEY || "your-fallback-32-chars-key-here!!!";
// Ensure key is exactly 32 bytes for AES-256
const ENCRYPTION_KEY = crypto.createHash('sha256').update(rawKey).digest();
const IV_LENGTH = 16;

export function encrypt(text: string): string {
  if (!text) return text;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decrypt(text: string): string {
  if (!text || !text.includes(":")) return text;

  try {
    const textParts = text.split(":");
    const ivHex = textParts.shift();
    if (!ivHex || ivHex.length !== 32) return text; // IV for AES-256-CBC must be 16 bytes (32 hex chars)

    const iv = Buffer.from(ivHex, "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    // If decryption fails, it might be plain text that happens to have a colon and 32-char prefix
    // or it's genuinely corrupted. Returning original text is safer for migration.
    console.error("Decryption failed, returning original text.");
    return text;
  }
}

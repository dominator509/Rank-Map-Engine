import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const CREDENTIALS_AAD = Buffer.from("rankmap.integration_credentials.v1");

type IntegrationCredentialEnvelope = {
  v: 1;
  alg: "aes-256-gcm";
  iv: string;
  tag: string;
  ciphertext: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCredentialEnvelope(value: unknown): value is IntegrationCredentialEnvelope {
  return (
    isRecord(value) &&
    value.v === 1 &&
    value.alg === "aes-256-gcm" &&
    typeof value.iv === "string" &&
    typeof value.tag === "string" &&
    typeof value.ciphertext === "string"
  );
}

export function isEncryptedIntegrationCredentials(value: unknown): boolean {
  return isCredentialEnvelope(value);
}

function normalizeKeyMaterial(raw: string): Buffer {
  const trimmed = raw.trim();

  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  const decoded = Buffer.from(trimmed, "base64");
  if (
    decoded.length === 32 &&
    decoded.toString("base64").replace(/=+$/, "") === trimmed.replace(/=+$/, "")
  ) {
    return decoded;
  }

  return createHash("sha256").update(trimmed).digest();
}

function encryptionKey(): Buffer {
  const material = process.env.INTEGRATION_CREDENTIALS_KEY ?? process.env.SESSION_SECRET;
  if (!material) {
    throw new Error("INTEGRATION_CREDENTIALS_KEY or SESSION_SECRET must be set.");
  }
  return normalizeKeyMaterial(material);
}

export function normalizeIntegrationCredentials(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;

  const normalized: Record<string, string> = {};
  for (const [key, credentialValue] of Object.entries(value)) {
    if (typeof credentialValue !== "string") return null;
    normalized[key] = credentialValue;
  }

  return normalized;
}

export function encryptIntegrationCredentials(
  credentials: Record<string, string>,
): IntegrationCredentialEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(CREDENTIALS_AAD);

  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(credentials), "utf8"),
    cipher.final(),
  ]);

  return {
    v: 1,
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptIntegrationCredentials(value: unknown): Record<string, string> {
  if (!isCredentialEnvelope(value)) {
    return normalizeIntegrationCredentials(value) ?? {};
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(value.iv, "base64"),
  );
  decipher.setAAD(CREDENTIALS_AAD);
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");

  return normalizeIntegrationCredentials(JSON.parse(plaintext)) ?? {};
}

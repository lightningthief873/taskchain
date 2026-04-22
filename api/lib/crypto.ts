import crypto from "crypto";

function getMasterKey(): Buffer {
  const hex = process.env.AGENT_MASTER_KEY;
  if (!hex) throw new Error("AGENT_MASTER_KEY env var is required (32-byte hex string)");
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) throw new Error("AGENT_MASTER_KEY must be exactly 64 hex characters (32 bytes)");
  return buf;
}

interface EncryptedPayload {
  iv: string;
  tag: string;
  data: string;
}

export function encryptPrivateKey(privateKey: string): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(privateKey, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload: EncryptedPayload = {
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    data: encrypted.toString("hex"),
  };
  return JSON.stringify(payload);
}

export function decryptPrivateKey(encryptedJson: string): string {
  const key = getMasterKey();
  const { iv, tag, data } = JSON.parse(encryptedJson) as EncryptedPayload;
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return decipher.update(Buffer.from(data, "hex")).toString("utf8") + decipher.final("utf8");
}

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { getEnv } from "@/server/env";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

const getKey = () =>
  Buffer.from(getEnv().STANDALONE_ENCRYPTION_KEY, "hex");

export const encryptSecret = (plaintext: string) => {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
};

export const decryptSecret = (payload: string) => {
  const [version, ivValue, tagValue, encryptedValue] = payload.split(".");
  if (
    version !== "v1" ||
    !ivValue ||
    !tagValue ||
    encryptedValue === undefined
  ) {
    throw new Error("Invalid encrypted value");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
};

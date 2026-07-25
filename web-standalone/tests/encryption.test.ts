import { beforeEach, describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
} from "@/server/encryption";
import { resetEnvForTests } from "@/server/env";

describe("secret encryption", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "a".repeat(64);
    resetEnvForTests();
  });

  it("round-trips without storing plaintext", () => {
    const encrypted = encryptSecret("provider-secret");
    expect(encrypted).not.toContain("provider-secret");
    expect(decryptSecret(encrypted)).toBe("provider-secret");
  });

  it("rejects modified ciphertext", () => {
    const encrypted = encryptSecret("provider-secret");
    const parts = encrypted.split(".");
    const ciphertext = parts[3]!;
    parts[3] = `${ciphertext[0] === "A" ? "B" : "A"}${ciphertext.slice(1)}`;
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });
});

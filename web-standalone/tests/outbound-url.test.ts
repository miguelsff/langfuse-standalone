import { describe, expect, it } from "vitest";
import {
  isPrivateAddress,
  parseSafeOutboundUrl,
} from "@/server/security/outbound-url";

describe("outbound provider URL validation", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.1.1",
    "192.168.1.1",
    "::1",
    "fd00::1",
  ])("recognizes private address %s", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it("accepts public HTTPS URLs", () => {
    expect(parseSafeOutboundUrl("https://api.openai.com/v1").hostname).toBe(
      "api.openai.com",
    );
  });

  it.each([
    "http://api.example.com",
    "https://localhost/v1",
    "https://127.0.0.1/v1",
    "https://user:password@example.com/v1",
    "https://example.com:8443/v1",
  ])("rejects unsafe URL %s", (url) => {
    expect(() => parseSafeOutboundUrl(url)).toThrow();
  });
});

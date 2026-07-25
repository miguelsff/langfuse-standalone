import dns from "node:dns/promises";
import net from "node:net";

const isPrivateIpv4 = (address: string) => {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some(Number.isNaN)) return true;
  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
};

const isPrivateIpv6 = (address: string) => {
  const normalized = address.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
};

export const isPrivateAddress = (address: string) => {
  const family = net.isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
};

export const parseSafeOutboundUrl = (value: string) => {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("Only HTTPS provider URLs are allowed");
  }
  if (url.username || url.password) {
    throw new Error("Provider URLs cannot contain credentials");
  }
  if (url.port && url.port !== "443") {
    throw new Error("Only the standard HTTPS port is allowed");
  }
  if (
    url.hostname === "localhost" ||
    (net.isIP(url.hostname) !== 0 && isPrivateAddress(url.hostname))
  ) {
    throw new Error("Local and private provider addresses are not allowed");
  }

  return url;
};

export const assertPublicHostname = async (hostname: string) => {
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0) {
    throw new Error("Provider hostname did not resolve");
  }
  if (addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("Provider hostname resolves to a private address");
  }
};

export const assertSafeOutboundUrl = async (value: string) => {
  const url = parseSafeOutboundUrl(value);
  await assertPublicHostname(url.hostname);
  return url;
};

export const safeProviderFetch: typeof fetch = async (input, init) => {
  const initial =
    typeof input === "string" || input instanceof URL
      ? input.toString()
      : input.url;
  let current = await assertSafeOutboundUrl(initial);

  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    await assertPublicHostname(current.hostname);
    const response = await fetch(current, { ...init, redirect: "manual" });
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location || redirectCount === 3) {
      throw new Error("Unsafe or excessive provider redirect");
    }
    current = await assertSafeOutboundUrl(
      new URL(location, current).toString(),
    );
  }

  throw new Error("Provider request failed");
};

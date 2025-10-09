// IPFS and URI helpers extracted from gallery/page.tsx
// Reason: Reduce file size and complexity; provide reusable utilities

// eslint-disable-next-line complexity
export const normalizeUri = (input: any): string => {
  let s = String(input ?? "").trim();
  try {
    if (/%22|%27/.test(s)) {
      const dec = decodeURIComponent(s);
      if (dec) s = dec.trim();
    }
  } catch {}
  for (let i = 0; i < 3; i++) {
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1).trim();
    } else {
      break;
    }
  }
  if (s.includes('\\"')) s = s.replace(/\\"/g, '"');
  if (s.includes("\\'")) s = s.replace(/\\'/g, "'");
  if (s.startsWith("%22") && s.endsWith("%22")) s = s.slice(3, -3).trim();
  if (s.startsWith("%27") && s.endsWith("%27")) s = s.slice(3, -3).trim();
  if (s.startsWith("[") && s.endsWith("]")) {
    s = s.slice(1, -1).trim();
  }
  for (let i = 0; i < 2; i++) {
    if (s.startsWith("[") || s.startsWith("{")) {
      try {
        const parsed: any = JSON.parse(s);
        if (Array.isArray(parsed)) {
          s = String(parsed[0] ?? "");
        } else if (parsed && typeof parsed === "object") {
          s = String(parsed.uri ?? parsed.url ?? parsed.image ?? "");
        } else {
          s = String(parsed);
        }
        s = s.trim();
        continue;
      } catch {}
    }
    break;
  }
  for (let i = 0; i < 2; i++) {
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1).trim();
    }
  }
  while (s && (s[0] === '"' || s[0] === "'" || s[0] === "[" || s[0] === "{" || s[0] === "(")) {
    s = s.slice(1).trim();
  }
  while (s && (s.endsWith('"') || s.endsWith("'") || s.endsWith("]") || s.endsWith(")"))) {
    s = s.slice(0, -1).trim();
  }
  if (s.includes("ipfs://") || s.includes("ipfs:/")) {
    s = s.replace(/ipfs:\/(?!\/)/g, "ipfs://");
    const m = s.match(/ipfs:\/\/[A-Za-z0-9._\-\/]+/);
    if (m && m[0]) {
      s = m[0];
    }
  }
  while (s.endsWith(")") || s.endsWith("]") || s.endsWith("}") || s.endsWith('"') || s.endsWith("'")) {
    s = s.slice(0, -1).trim();
  }
  return s;
};

// Reason: ipfs.io is most reliable, use it as default
export const resolveIpfsToHttp = (uri: string, gatewayHost = "ipfs.io"): string => {
  const s = normalizeUri(uri);
  if (!s) return s;
  
  // Handle gateways that already include /ipfs/ in their path
  const gatewayHasIpfsPath = gatewayHost.includes("/ipfs");
  
  if (/^(bafy[\w]+|Qm[1-9A-HJ-NP-Za-km-z]{44})(\/.+)?$/.test(s)) {
    const path = s.replace(/^\/+/, "");
    if (gatewayHasIpfsPath) {
      return `https://${gatewayHost}/${path}`;
    }
    return `https://${gatewayHost}/ipfs/${path}`;
  }
  const normalizedIpfs = s.replace(/ipfs:\/(?!\/)/g, "ipfs://");
  if (normalizedIpfs.startsWith("ipfs://")) {
    const path = normalizedIpfs.replace(/^ipfs:\/\//, "").replace(/^\/+/, "");
    if (gatewayHasIpfsPath) {
      return `https://${gatewayHost}/${path}`;
    }
    return `https://${gatewayHost}/ipfs/${path}`;
  }
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      u.pathname = u.pathname.replace(/\/{2,}/g, "/");
      return u.toString();
    } catch {
      return s;
    }
  }
  return normalizedIpfs;
};

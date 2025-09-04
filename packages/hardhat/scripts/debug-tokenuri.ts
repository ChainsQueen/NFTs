import { HardhatRuntimeEnvironment } from "hardhat/types";
import hre from "hardhat";

// Minimal IPFS resolution like the frontend
// eslint-disable-next-line complexity
function normalize(input: any): string {
  let s = String(input ?? "").trim();
  // Decode encoded quotes if present
  try {
    if (/%22|%27/.test(s)) {
      const dec = decodeURIComponent(s);
      if (dec) s = dec.trim();
    }
  } catch {}
  // Peel quotes a few times
  for (let i = 0; i < 3; i++) {
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1).trim();
    else break;
  }
  // Strip outer brackets if looks like [value]
  if (s.startsWith("[") && s.endsWith("]")) s = s.slice(1, -1).trim();
  // Extract ipfs:// substring if present anywhere
  if (s.includes("ipfs://") || s.includes("ipfs:/")) {
    s = s.replace(/ipfs:\/(?!\/)/g, "ipfs://");
    const m = s.match(/ipfs:\/\/[A-Za-z0-9._\-\/]+/);
    if (m && m[0]) s = m[0];
  }
  // Remove trailing stray brackets/quotes
  while (s.endsWith(")") || s.endsWith("]") || s.endsWith("}") || s.endsWith('"') || s.endsWith("'"))
    s = s.slice(0, -1).trim();
  // Remove leading stray wrappers
  while (s && (s[0] === '"' || s[0] === "'" || s[0] === "[" || s[0] === "{" || s[0] === "(")) s = s.slice(1).trim();
  return s;
}

function resolveIpfsToHttp(uri: string, gatewayHost = "nftstorage.link"): string {
  const s = normalize(uri);
  if (!s) return s;
  // bare CID (bafy.. or Qm..)
  if (/^(bafy[\w]+|Qm[1-9A-HJ-NP-Za-km-z]{44})(\/.*)?$/.test(s)) {
    const path = s.replace(/^\/+/, "");
    return `https://${gatewayHost}/ipfs/${path}`;
  }
  const normalizedIpfs = s.replace(/ipfs:\/(?!\/)/g, "ipfs://");
  if (normalizedIpfs.startsWith("ipfs://")) {
    const path = normalizedIpfs.replace(/^ipfs:\/\//, "").replace(/^\/+/, "");
    return `https://${gatewayHost}/ipfs/${path}`;
  }
  return s;
}

async function fetchJson(url: string, timeoutMs = 12000): Promise<any> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" as any });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await res.json();
    const txt = await res.text();
    try {
      return JSON.parse(txt);
    } catch {
      throw new Error("Non-JSON response");
    }
  } finally {
    clearTimeout(id);
  }
}

// eslint-disable-next-line complexity
function parseArgs(argv: string[]) {
  const args = {
    tokenId: undefined as number | undefined,
    start: undefined as number | undefined,
    end: undefined as number | undefined,
    fetch: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--fetch" || a === "-f") {
      args.fetch = true;
      continue;
    }
    if (a === "--tokenId" || a === "--tokenid" || a === "-t") {
      args.tokenId = Number(argv[++i]);
      continue;
    }
    if (a === "--start" || a === "-s") {
      args.start = Number(argv[++i]);
      continue;
    }
    if (a === "--end" || a === "-e") {
      args.end = Number(argv[++i]);
      continue;
    }
    if (/^\d+$/.test(a) && args.tokenId === undefined) {
      args.tokenId = Number(a);
      continue;
    }
  }
  // Environment variable fallbacks to avoid Hardhat CLI flag parsing issues
  const envTokenId = process.env.TOKEN_ID || process.env.TOKENID;
  const envStart = process.env.START;
  const envEnd = process.env.END;
  const envFetch = process.env.FETCH;
  if (args.tokenId === undefined && envTokenId && /^\d+$/.test(envTokenId)) args.tokenId = Number(envTokenId);
  if (args.start === undefined && envStart && /^\d+$/.test(envStart)) args.start = Number(envStart);
  if (args.end === undefined && envEnd && /^\d+$/.test(envEnd)) args.end = Number(envEnd);
  if (!args.fetch && envFetch && /^(1|true|yes)$/i.test(envFetch)) args.fetch = true;
  return args;
}

async function loadContract(hre: HardhatRuntimeEnvironment) {
  const { deployments, ethers } = hre as any;
  const overrideAddress = process.env.CONTRACT_ADDRESS || process.env.RELIC_ADDRESS;
  if (overrideAddress) {
    const minimalErc721Abi = [
      "function tokenURI(uint256 tokenId) view returns (string)",
      "function ownerOf(uint256 tokenId) view returns (address)",
    ];
    const contract = await ethers.getContractAt(minimalErc721Abi, overrideAddress);
    return { contract, address: overrideAddress };
  }
  const d = await deployments.get("Kittens");
  const contract = await ethers.getContractAt(d.abi, d.address);
  return { contract, address: d.address };
}

// eslint-disable-next-line complexity
async function inspectToken(contract: any, id: bigint, doFetch: boolean) {
  const out: any = { tokenId: id.toString() };
  try {
    const uri = (await contract.read?.tokenURI?.([id])) ?? (await contract.tokenURI(id));
    out.tokenURI = String(uri);
    out.tokenURI_resolved = resolveIpfsToHttp(String(uri));
  } catch (e: any) {
    out.tokenURI_error = String(e?.message || e);
  }
  try {
    const owner = (await contract.read?.ownerOf?.([id])) ?? (await contract.ownerOf(id));
    out.owner = String(owner);
  } catch (e: any) {
    out.owner_error = String(e?.message || e);
  }
  if (doFetch && out.tokenURI_resolved) {
    const gateways = ["nftstorage.link", "cloudflare-ipfs.com", "ipfs.io", "gateway.pinata.cloud", "dweb.link"];
    const base = out.tokenURI_resolved as string;
    const candidates: string[] = [];
    try {
      // If base is ipfs:// or bare CID, regenerate across gateways
      const s = normalize(out.tokenURI as string);
      const looksCid = /^(bafy[\w]+|Qm[1-9A-HJ-NP-Za-km-z]{44})(\/.*)?$/.test(s) || s.startsWith("ipfs://");
      if (looksCid) for (const g of gateways) candidates.push(resolveIpfsToHttp(s, g));
    } catch {}
    if (candidates.length === 0) candidates.push(base);
    for (const u of candidates) {
      try {
        const meta = await fetchJson(u);
        out.metadata_url = u;
        out.metadata = meta;
        break;
      } catch (e) {
        out.metadata_last_error = String(e);
      }
    }
  }
  return out;
}

async function main() {
  const { tokenId, start, end, fetch } = parseArgs(process.argv);
  if (tokenId === undefined && (start === undefined || end === undefined)) {
    console.log(
      "Usage: yarn hardhat run --network <net> scripts/debug-tokenuri.ts --tokenId 1000001 [--fetch]\n       or: yarn hardhat run --network <net> scripts/debug-tokenuri.ts --start 1000000 --end 1000010 [--fetch]\n       or: TOKEN_ID=1000001 [FETCH=1] yarn hardhat run --network <net> scripts/debug-tokenuri.ts\n       or: START=1000000 END=1000010 [FETCH=1] yarn hardhat run --network <net> scripts/debug-tokenuri.ts\n       (optional) CONTRACT_ADDRESS=0xRelic... to inspect a different ERC721 (e.g. Relic)",
    );
    process.exit(1);
  }
  const net = await hre.getChainId();
  const { contract, address } = await loadContract(hre);
  console.log(JSON.stringify({ network: net, contract: address }, null, 2));

  const ids: bigint[] = [];
  if (tokenId !== undefined) ids.push(BigInt(tokenId));
  if (start !== undefined && end !== undefined) {
    for (let i = start; i <= end; i++) ids.push(BigInt(i));
  }

  for (const id of ids) {
    const res = await inspectToken(contract, id, fetch);
    console.log(JSON.stringify(res, null, 2));
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

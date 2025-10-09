import { NFTMetaData } from "~~/utils/simpleNFT/nftsMetadata";
import { normalizeUri } from "~~/utils/ipfs/uri-utils";
import { normalizeIpfsUrl as dsNormalizeIpfsUrl, resolveToHttp as dsResolveToHttp } from "~~/partials/nft/ipfs-utils";

type AbiLike = Array<{ type?: string; name?: string } | undefined> | undefined;

export const hasFn = (abi: AbiLike, name: string): boolean =>
  Array.isArray(abi) && abi.some((f: any) => f?.type === "function" && f?.name === name);

export const getEligibleEntries = (
  contractsOnChain: Record<string, { address: `0x${string}`; abi: any[] }>,
) =>
  Object.entries(contractsOnChain).filter(([, decl]) => {
    const abi: any[] = (decl as any).abi || [];
    return hasFn(abi, "balanceOf") && hasFn(abi, "tokenURI") && hasFn(abi, "ownerOf");
  }) as [string, { address: `0x${string}`; abi: any[] }][];

export async function buildLabelUpdate(
  publicClient: { readContract: (args: any) => Promise<unknown> },
  entries: [string, { address: `0x${string}`; abi: any[] }][],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [contractName, decl] of entries) {
    const { address, abi } = decl;
    try {
      const hasName = hasFn(abi, "name");
      const hasSymbol = hasFn(abi, "symbol");
      let chainName: string | undefined;
      let chainSymbol: string | undefined;
      if (hasName)
        chainName = (await publicClient.readContract({ address, abi, functionName: "name", args: [] })) as string;
      if (hasSymbol)
        chainSymbol = (await publicClient.readContract({ address, abi, functionName: "symbol", args: [] })) as string;
      const label = [contractName, chainName ? `• ${chainName}` : undefined, chainSymbol ? ` (${chainSymbol})` : undefined]
        .filter(Boolean)
        .join(" ");
      if (label) out[address] = label;
    } catch {
      // ignore label errors
    }
  }
  return out;
}

export function pushCollectible(
  out: Array<any>,
  tokenId: bigint,
  tokenOwner: string,
  contractName: string,
  contractAddress: `0x${string}`,
  rawTokenURI: string,
  resolvedTokenUri: string,
  meta?: NFTMetaData,
) {
  if (meta?.image) meta.image = dsResolveToHttp(normalizeUri(String(meta.image)));
  if (meta) {
    out.push({ id: Number(tokenId), uri: String(rawTokenURI), owner: tokenOwner, contractName, contractAddress, ...meta });
    return;
  }
  const looksLikeImage = /\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?.*)?$/i.test(resolvedTokenUri);
  const fallback: any = {
    id: Number(tokenId),
    uri: String(rawTokenURI),
    owner: tokenOwner,
    contractName,
    contractAddress,
    name: `Token #${Number(tokenId)}`,
    description: "",
  };
  if (looksLikeImage) fallback.image = resolvedTokenUri;
  out.push(fallback);
}

export async function fetchEnumerableForContract(
  publicClient: any,
  address: `0x${string}`,
  abi: any[],
  owner: string,
  contractName: string,
  fetchIpfsJsonWithFallbacks: (uri: string) => Promise<NFTMetaData>,
): Promise<any[]> {
  const out: any[] = [];
  const bal = (await publicClient.readContract({ address, abi, functionName: "balanceOf", args: [owner] })) as bigint;
  const balance = Number(bal);
  for (let i = 0; i < balance; i++) {
    try {
      const tokenId = (await publicClient.readContract({ address, abi, functionName: "tokenOfOwnerByIndex", args: [owner, BigInt(i)] })) as bigint;
      const rawTokenURI = (await publicClient.readContract({ address, abi, functionName: "tokenURI", args: [tokenId] })) as string;
      const resolvedTokenUri = dsNormalizeIpfsUrl(String(normalizeUri(String(rawTokenURI))));
      try {
        const nftMetadata: NFTMetaData = await fetchIpfsJsonWithFallbacks(resolvedTokenUri);
        pushCollectible(out, tokenId, owner, contractName, address, String(rawTokenURI), resolvedTokenUri, nftMetadata);
      } catch {
        pushCollectible(out, tokenId, owner, contractName, address, String(rawTokenURI), resolvedTokenUri);
      }
    } catch {
      // ignore per-token errors
    }
  }
  return out;
}

async function getScanPlan(publicClient: any, address: `0x${string}`, abi: any[]): Promise<{ maxToScan: bigint; useByIndex: boolean }> {
  const canTotalSupply = hasFn(abi, "totalSupply") && hasFn(abi, "tokenByIndex");
  if (canTotalSupply) {
    try {
      const ts = (await publicClient.readContract({ address, abi, functionName: "totalSupply", args: [] })) as bigint;
      return { maxToScan: ts, useByIndex: true };
    } catch {}
  }
  if (hasFn(abi, "totalMinted")) {
    try {
      const tm = (await publicClient.readContract({ address, abi, functionName: "totalMinted", args: [] })) as bigint;
      return { maxToScan: tm, useByIndex: false };
    } catch {}
  }
  return { maxToScan: 0n, useByIndex: false };
}

export async function fetchNonEnumerableForContract(
  publicClient: any,
  address: `0x${string}`,
  abi: any[],
  owner: string,
  contractName: string,
  fetchIpfsJsonWithFallbacks: (uri: string) => Promise<NFTMetaData>,
): Promise<any[]> {
  const out: any[] = [];
  const { maxToScan, useByIndex } = await getScanPlan(publicClient, address, abi);
  const MAX_SCAN = 2000n;
  if (maxToScan <= 0n) return out;
  const upper = maxToScan > MAX_SCAN ? MAX_SCAN : maxToScan;
  for (let t = 0n; t < upper; t++) {
    try {
      const tokenId = useByIndex
        ? ((await publicClient.readContract({ address, abi, functionName: "tokenByIndex", args: [t] })) as bigint)
        : t + 1n;
      const tokenOwner = (await publicClient.readContract({ address, abi, functionName: "ownerOf", args: [tokenId] })) as string;
      if (tokenOwner?.toLowerCase?.() !== (owner || "").toLowerCase()) continue;
      const rawTokenURI = (await publicClient.readContract({ address, abi, functionName: "tokenURI", args: [tokenId] })) as string;
      const resolvedTokenUri = dsNormalizeIpfsUrl(String(normalizeUri(String(rawTokenURI))));
      try {
        const meta: NFTMetaData = await fetchIpfsJsonWithFallbacks(resolvedTokenUri);
        pushCollectible(out, tokenId, tokenOwner, contractName, address, String(rawTokenURI), resolvedTokenUri, meta);
      } catch {
        pushCollectible(out, tokenId, tokenOwner, contractName, address, String(rawTokenURI), resolvedTokenUri);
      }
    } catch {
      // ignore gaps
    }
  }
  return out;
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { useSelectedNetwork } from "~~/hooks/scaffold-eth";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth/useScaffoldWriteContract";
import {
  IPFS_GATEWAYS,
  normalizeIpfsUrl as dsNormalizeIpfsUrl,
  resolveToHttp as dsResolveToHttp,
} from "~~/partials/nft/ipfs-utils";
import { NFTCard } from "~~/partials/nft/nft-card";
import { notification } from "~~/utils/scaffold-eth";
import { contracts as allContracts } from "~~/utils/scaffold-eth/contract";
import { NFTMetaData } from "~~/utils/simpleNFT/nftsMetadata";

export interface Collectible extends Partial<NFTMetaData> {
  id: number;
  uri: string;
  owner: string;
  contractName: string;
  contractAddress: `0x${string}`;
}

export const MyHoldings = () => {
  const { address: connectedAddress } = useAccount();
  const [myAllCollectibles, setMyAllCollectibles] = useState<Collectible[]>([]);
  const [allCollectiblesLoading, setAllCollectiblesLoading] = useState(false);
  const [transferringId, setTransferringId] = useState<number | null>(null);
  const [transferAddr, setTransferAddr] = useState<Record<number, string>>({});
  const [onChainLabelByAddress, setOnChainLabelByAddress] = useState<Record<string, string>>({});

  const selectedNetwork = useSelectedNetwork();
  const publicClient = usePublicClient({ chainId: selectedNetwork.id });

  // optional writer for Kittens (kept for backward compatibility)
  const { writeContractAsync: kittensWriteContractAsync } = useScaffoldWriteContract({
    contractName: "Kittens" as any,
  });

  const normalizeUri = useCallback((input: any): string => {
    let s = String(input ?? "").trim();
    for (let i = 0; i < 3; i++) {
      if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        s = s.slice(1, -1).trim();
      } else {
        break;
      }
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
        } catch {
          // ignore
        }
      }
      break;
    }
    for (let i = 0; i < 2; i++) {
      if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        s = s.slice(1, -1).trim();
      }
    }
    return s;
  }, []);

  // no-op: all IPFS URL resolution uses shared ipfs-utils (dsResolveToHttp/dsNormalizeIpfsUrl)

  const fetchJsonWithTimeout = async (url: string, timeoutMs = 20000) => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as NFTMetaData;
    } finally {
      clearTimeout(id);
    }
  };

  const fetchIpfsJsonWithFallbacks = useCallback(
    async (rawUri: string, timeoutMs = 20000): Promise<NFTMetaData> => {
      const s = normalizeUri(rawUri);
      const isIpfs = s.startsWith("ipfs://");
      let urls: string[] = [];
      if (isIpfs) {
        const path = s.replace("ipfs://", "");
        urls = IPFS_GATEWAYS.map(gw => `${gw}${path}`);
      } else {
        urls = [s];
      }
      console.debug("MyHoldings:metadata urls", { raw: rawUri, urls });
      let lastErr: any;
      for (const u of urls) {
        try {
          return await fetchJsonWithTimeout(u, timeoutMs);
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr || new Error("Failed to fetch metadata");
    },
    [normalizeUri],
  );

  const contractsOnChain = useMemo(() => {
    const c = (allContracts || {}) as Record<number, Record<string, { address: `0x${string}`; abi: any }>>;
    return c?.[selectedNetwork.id] || {};
  }, [selectedNetwork.id]);

  useEffect(() => {
    const updateMyCollectibles = async (): Promise<void> => {
      console.debug("MyHoldings:update start", {
        connectedAddress,
        chainId: selectedNetwork.id,
      });
      if (!connectedAddress || !publicClient) {
        console.debug("MyHoldings:skip - missing deps");
        return;
      }

      setAllCollectiblesLoading(true);
      const collectibleUpdate: Collectible[] = [];
      const labelUpdate: Record<string, string> = {};

      const hasFn = (abi: any[], name: string) =>
        Array.isArray(abi) && abi.some((f: any) => f?.type === "function" && f?.name === name);

      const eligibleEntries = Object.entries(contractsOnChain).filter(([, decl]) => {
        const abi: any[] = (decl as any).abi || [];
        return hasFn(abi, "balanceOf") && hasFn(abi, "tokenURI") && hasFn(abi, "ownerOf");
      }) as [string, { address: `0x${string}`; abi: any[] }][];

      for (const [contractName, decl] of eligibleEntries) {
        const { address, abi } = decl;
        try {
          // prepare on-chain label (name/symbol) if available
          try {
            const hasName = hasFn(abi, "name");
            const hasSymbol = hasFn(abi, "symbol");
            let chainName: string | undefined;
            let chainSymbol: string | undefined;
            if (hasName)
              chainName = (await publicClient.readContract({
                address,
                abi,
                functionName: "name",
                args: [],
              })) as unknown as string;
            if (hasSymbol)
              chainSymbol = (await publicClient.readContract({
                address,
                abi,
                functionName: "symbol",
                args: [],
              })) as unknown as string;
            const label = [
              contractName,
              chainName ? `• ${chainName}` : undefined,
              chainSymbol ? ` (${chainSymbol})` : undefined,
            ]
              .filter(Boolean)
              .join(" ");
            if (label) labelUpdate[address] = label;
          } catch {
            // ignore label errors
          }

          const bal = (await publicClient.readContract({
            address,
            abi,
            functionName: "balanceOf",
            args: [connectedAddress],
          })) as unknown as bigint;
          const balance = Number(bal);
          if (!balance) continue;

          const enumerable = hasFn(abi, "tokenOfOwnerByIndex");
          if (enumerable) {
            for (let i = 0; i < balance; i++) {
              try {
                const tokenId = (await publicClient.readContract({
                  address,
                  abi,
                  functionName: "tokenOfOwnerByIndex",
                  args: [connectedAddress, BigInt(i)],
                })) as unknown as bigint;
                const rawTokenURI = (await publicClient.readContract({
                  address,
                  abi,
                  functionName: "tokenURI",
                  args: [tokenId],
                })) as unknown as string;
                const resolvedTokenUri = dsNormalizeIpfsUrl(String(normalizeUri(String(rawTokenURI))));
                try {
                  const nftMetadata: NFTMetaData = await fetchIpfsJsonWithFallbacks(resolvedTokenUri);
                  if (nftMetadata?.image) {
                    nftMetadata.image = dsResolveToHttp(normalizeUri(String(nftMetadata.image)));
                  }
                  collectibleUpdate.push({
                    id: Number(tokenId),
                    uri: String(rawTokenURI),
                    owner: connectedAddress,
                    contractName,
                    contractAddress: address,
                    ...nftMetadata,
                  });
                } catch {
                  const looksLikeImage = /\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?.*)?$/i.test(resolvedTokenUri);
                  const fallback: Collectible = {
                    id: Number(tokenId),
                    uri: String(rawTokenURI),
                    owner: connectedAddress,
                    contractName,
                    contractAddress: address,
                    name: `Token #${Number(tokenId)}`,
                    description: "",
                  };
                  if (looksLikeImage) fallback.image = resolvedTokenUri;
                  collectibleUpdate.push(fallback);
                }
              } catch (e) {
                console.warn("MyHoldings: enumerable fetch failed", contractName, e);
              }
            }
          } else {
            // fallback: try totalSupply+tokenByIndex, else totalMinted+ownerOf (bounded)
            const canTotalSupply = hasFn(abi, "totalSupply") && hasFn(abi, "tokenByIndex");
            let maxToScan = 0n;
            let useByIndex = false;
            if (canTotalSupply) {
              try {
                const ts = (await publicClient.readContract({
                  address,
                  abi,
                  functionName: "totalSupply",
                  args: [],
                })) as unknown as bigint;
                maxToScan = ts;
                useByIndex = true;
              } catch {}
            }
            if (!useByIndex && hasFn(abi, "totalMinted")) {
              try {
                const tm = (await publicClient.readContract({
                  address,
                  abi,
                  functionName: "totalMinted",
                  args: [],
                })) as unknown as bigint;
                maxToScan = tm;
              } catch {}
            }
            // safety bound to avoid huge scans
            const MAX_SCAN = 2000n;
            if (maxToScan > 0n) {
              const upper = maxToScan > MAX_SCAN ? MAX_SCAN : maxToScan;
              for (let t = 0n; t < upper; t++) {
                try {
                  const tokenId = useByIndex
                    ? ((await publicClient.readContract({
                        address,
                        abi,
                        functionName: "tokenByIndex",
                        args: [t],
                      })) as unknown as bigint)
                    : t + 1n;
                  const owner = (await publicClient.readContract({
                    address,
                    abi,
                    functionName: "ownerOf",
                    args: [tokenId],
                  })) as unknown as string;
                  if (owner?.toLowerCase?.() !== (connectedAddress || "").toLowerCase()) continue;
                  const rawTokenURI = (await publicClient.readContract({
                    address,
                    abi,
                    functionName: "tokenURI",
                    args: [tokenId],
                  })) as unknown as string;
                  const resolvedTokenUri = dsNormalizeIpfsUrl(String(normalizeUri(String(rawTokenURI))));
                  try {
                    const nftMetadata: NFTMetaData = await fetchIpfsJsonWithFallbacks(resolvedTokenUri);
                    if (nftMetadata?.image)
                      nftMetadata.image = dsResolveToHttp(normalizeUri(String(nftMetadata.image)));
                    collectibleUpdate.push({
                      id: Number(tokenId),
                      uri: String(rawTokenURI),
                      owner,
                      contractName,
                      contractAddress: address,
                      ...nftMetadata,
                    });
                  } catch {
                    const looksLikeImage = /\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?.*)?$/i.test(resolvedTokenUri);
                    const fallback: Collectible = {
                      id: Number(tokenId),
                      uri: String(rawTokenURI),
                      owner,
                      contractName,
                      contractAddress: address,
                      name: `Token #${Number(tokenId)}`,
                      description: "",
                    };
                    if (looksLikeImage) fallback.image = resolvedTokenUri;
                    collectibleUpdate.push(fallback);
                  }
                } catch {
                  // ignore gaps/nonexistent
                }
              }
            }
          }
        } catch (e) {
          console.warn("MyHoldings: failed for contract", contractName, e);
        }
      }

      try {
        collectibleUpdate.sort((a, b) => a.id - b.id);
        setMyAllCollectibles(collectibleUpdate);
        if (Object.keys(labelUpdate).length) setOnChainLabelByAddress(prev => ({ ...prev, ...labelUpdate }));
      } catch (e) {
        notification.error("Error fetching collectibles");
        console.error(e);
      } finally {
        setAllCollectiblesLoading(false);
        console.debug("MyHoldings:update end");
      }
    };

    updateMyCollectibles();
  }, [connectedAddress, selectedNetwork.id, publicClient, contractsOnChain, fetchIpfsJsonWithFallbacks]);

  const transferToken = async (tokenId: number) => {
    try {
      if (!connectedAddress) {
        notification.error("Connect your wallet to transfer");
        return;
      }
      const to = (transferAddr[tokenId] || "").trim();
      if (!to) {
        notification.error("Enter a recipient address");
        return;
      }
      if (!to.startsWith("0x") || to.length !== 42) {
        notification.error("Invalid address");
        return;
      }
      setTransferringId(tokenId);
      // Keep transfer wired for Kittens only for now
      await (kittensWriteContractAsync as any)({
        functionName: "safeTransferFrom",
        args: [connectedAddress as `0x${string}`, to as `0x${string}`, BigInt(tokenId)],
        account: connectedAddress as `0x${string}`,
        chainId: 13579,
      } as any);
      notification.success("Transfer submitted");
    } catch (e: any) {
      console.error(e);
      notification.error(e?.shortMessage || e?.message || "Transfer failed");
    } finally {
      setTransferringId(null);
    }
  };

  if (allCollectiblesLoading)
    return (
      <div className="flex justify-center items-center mt-10">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );

  return (
    <>
      {myAllCollectibles.length === 0 ? (
        <div className="flex justify-center items-center mt-10">
          <div className="text-2xl text-neutral-700 dark:text-neutral-200">No NFTs found</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8 my-6 items-stretch mx-auto">
          {myAllCollectibles.map(item => (
            <NFTCard
              key={`${item.contractAddress}-${item.id}`}
              id={item.id}
              name={item.name || `Token #${item.id}`}
              imageUrl={item.image || ""}
              description={item.description || ""}
              owner={item.owner}
              contractLabel={onChainLabelByAddress[item.contractAddress] || item.contractName}
              contractAddress={item.contractAddress}
              mediaAspect="1:1"
              size="md"
              aboveCta={
                <div className="w-full flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="0x recipient address"
                    className="input input-bordered w-full"
                    value={transferAddr[item.id] || ""}
                    onChange={e => setTransferAddr(prev => ({ ...prev, [item.id]: e.target.value }))}
                  />
                </div>
              }
              ctaPrimary={{
                label: "Transfer",
                loading: transferringId === item.id,
                disabled: item.contractName !== "Kittens",
                onClick: () => transferToken(item.id),
              }}
            />
          ))}
        </div>
      )}
    </>
  );
};

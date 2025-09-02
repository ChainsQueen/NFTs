"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useScaffoldContract, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth/useScaffoldWriteContract";
import {
  IPFS_GATEWAYS,
  normalizeIpfsUrl as dsNormalizeIpfsUrl,
  resolveToHttp as dsResolveToHttp,
} from "~~/partials/nft/ipfs-utils";
import { NFTCard } from "~~/partials/nft/nft-card";
import { notification } from "~~/utils/scaffold-eth";
import { NFTMetaData } from "~~/utils/simpleNFT/nftsMetadata";

export interface Collectible extends Partial<NFTMetaData> {
  id: number;
  uri: string;
  owner: string;
}

export const MyHoldings = () => {
  const { address: connectedAddress } = useAccount();
  const [myAllCollectibles, setMyAllCollectibles] = useState<Collectible[]>([]);
  const [allCollectiblesLoading, setAllCollectiblesLoading] = useState(false);
  const [transferringId, setTransferringId] = useState<number | null>(null);
  const [transferAddr, setTransferAddr] = useState<Record<number, string>>({});

  const { data: kittensContract } = useScaffoldContract({
    contractName: "Kittens",
  });

  const { data: myTotalBalance } = useScaffoldReadContract({
    contractName: "Kittens",
    functionName: "balanceOf",
    args: [connectedAddress],
    watch: true,
  });

  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "Kittens" });

  const normalizeUri = (input: any): string => {
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
  };

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

  const fetchIpfsJsonWithFallbacks = async (rawUri: string, timeoutMs = 20000): Promise<NFTMetaData> => {
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
  };

  useEffect(() => {
    const updateMyCollectibles = async (): Promise<void> => {
      console.debug("MyHoldings:update start", {
        connectedAddress,
        contractAddress: kittensContract?.address,
        myTotalBalance: myTotalBalance?.toString?.(),
      });
      if (!connectedAddress || !kittensContract?.address || myTotalBalance === undefined) {
        console.debug("MyHoldings:skip - missing deps");
        return;
      }

      setAllCollectiblesLoading(true);
      const collectibleUpdate: Collectible[] = [];
      try {
        const totalBalance = Number(myTotalBalance);
        console.debug("MyHoldings:balanceOf", { totalBalance });
        for (let tokenIndex = 0; tokenIndex < totalBalance; tokenIndex++) {
          try {
            const tokenId = await kittensContract.read.tokenOfOwnerByIndex([connectedAddress, BigInt(tokenIndex)]);
            console.debug("MyHoldings:tokenOfOwnerByIndex", { tokenIndex, tokenId: tokenId.toString() });
            const rawTokenURI = await kittensContract.read.tokenURI([tokenId]);
            const resolvedTokenUri = dsNormalizeIpfsUrl(String(normalizeUri(String(rawTokenURI))));
            console.debug("MyHoldings:resolvedTokenUri", { tokenId: tokenId.toString(), resolvedTokenUri });
            try {
              const nftMetadata: NFTMetaData = await fetchIpfsJsonWithFallbacks(resolvedTokenUri);
              if (nftMetadata?.image) {
                nftMetadata.image = dsResolveToHttp(normalizeUri(String(nftMetadata.image)));
              }
              collectibleUpdate.push({
                id: Number(tokenId),
                uri: String(rawTokenURI),
                owner: connectedAddress,
                ...nftMetadata,
              });
              console.debug("MyHoldings:pushed collectible", {
                id: Number(tokenId),
                name: nftMetadata?.name,
                image: (nftMetadata as any)?.image,
                descLen: (nftMetadata?.description || "").length,
              });
            } catch (metaErr) {
              console.warn("MyHoldings:metadata fetch failed, using minimal item", metaErr);
              const looksLikeImage = /\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?.*)?$/i.test(resolvedTokenUri);
              const fallback: Collectible = {
                id: Number(tokenId),
                uri: String(rawTokenURI),
                owner: connectedAddress,
                name: `Token #${Number(tokenId)}`,
                description: "",
              };
              if (looksLikeImage) {
                fallback.image = resolvedTokenUri;
                console.debug("MyHoldings:using tokenURI as image fallback");
              }
              collectibleUpdate.push(fallback);
              console.debug("MyHoldings:pushed minimal collectible", {
                id: Number(tokenId),
                hasImage: !!fallback.image,
              });
            }
          } catch (e) {
            console.warn("Failed to fetch token by index", tokenIndex, e);
          }
        }
        console.debug("MyHoldings:collected count before sort", collectibleUpdate.length);
        collectibleUpdate.sort((a, b) => a.id - b.id);
        console.debug("MyHoldings:setting state with", collectibleUpdate.length);
        setMyAllCollectibles(collectibleUpdate);
      } catch (e) {
        notification.error("Error fetching collectibles");
        console.error(e);
      } finally {
        setAllCollectiblesLoading(false);
        console.debug("MyHoldings:update end");
      }
    };

    updateMyCollectibles();
  }, [connectedAddress, kittensContract?.address, myTotalBalance]);

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
      await writeContractAsync({
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
              key={item.id}
              id={item.id}
              name={item.name || `Token #${item.id}`}
              imageUrl={item.image || ""}
              description={item.description || ""}
              owner={item.owner}
              mediaAspect="1:1"
              size="sm"
              aboveCta={
                <div className="w-full flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="0x recipient address"
                    className="input input-bordered input-sm w-full"
                    value={transferAddr[item.id] || ""}
                    onChange={e => setTransferAddr(prev => ({ ...prev, [item.id]: e.target.value }))}
                  />
                </div>
              }
              ctaPrimary={{
                label: "Transfer",
                loading: transferringId === item.id,
                onClick: () => transferToken(item.id),
              }}
            />
          ))}
        </div>
      )}
    </>
  );
};

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { useSelectedNetwork } from "~~/hooks/scaffold-eth";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth/useScaffoldWriteContract";
import { IPFS_GATEWAYS } from "~~/partials/nft/ipfs-utils";
import { NFTCard } from "~~/partials/nft/nft-card";
import { notification } from "~~/utils/scaffold-eth";
import { contracts as allContracts } from "~~/utils/scaffold-eth/contract";
import { NFTMetaData } from "~~/utils/simpleNFT/nftsMetadata";
import { normalizeUri } from "~~/utils/ipfs/uri-utils";

export interface Collectible extends Partial<NFTMetaData> {
  id: number;
  uri: string;
  owner: string;
  contractName: string;
  contractAddress: `0x${string}`;
}

import {
  hasFn,
  getEligibleEntries,
  buildLabelUpdate,
  fetchEnumerableForContract,
  fetchNonEnumerableForContract,
} from "~~/core/nft/holdings-helpers";

export const MyHoldings = () => {
  const { address: connectedAddress } = useAccount();
  const [myAllCollectibles, setMyAllCollectibles] = useState<Collectible[]>([]);
  const [allCollectiblesLoading, setAllCollectiblesLoading] = useState(false);
  const [transferringId, setTransferringId] = useState<number | null>(null);
  const [transferAddr, setTransferAddr] = useState<Record<number, string>>({});
  const [onChainLabelByAddress, setOnChainLabelByAddress] = useState<Record<string, string>>({});

  const selectedNetwork = useSelectedNetwork();
  const publicClient = usePublicClient({ chainId: selectedNetwork.id });

  // writer for KittensV2
  const { writeContractAsync: kittensWriteContractAsync } = useScaffoldWriteContract({
    contractName: "KittensV2" as any,
  });

  // normalizeUri imported from shared utils

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
    [],
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
      const eligibleEntries = getEligibleEntries(contractsOnChain);
      const labelUpdate = await buildLabelUpdate(publicClient, eligibleEntries);

      for (const [contractName, decl] of eligibleEntries) {
        const { address, abi } = decl;
        try {
          const enumerable = hasFn(abi, "tokenOfOwnerByIndex");
          if (!enumerable) {
            const nonEnum = await fetchNonEnumerableForContract(
              publicClient,
              address,
              abi,
              connectedAddress,
              contractName,
              (u: string) => fetchIpfsJsonWithFallbacks(u),
            );
            collectibleUpdate.push(...nonEnum);
          } else {
            const enumRes = await fetchEnumerableForContract(
              publicClient,
              address,
              abi,
              connectedAddress,
              contractName,
              (u: string) => fetchIpfsJsonWithFallbacks(u),
            );
            collectibleUpdate.push(...enumRes);
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
      // Transfer wired for KittensV2
      await (kittensWriteContractAsync as any)({
        functionName: "safeTransferFrom",
        args: [connectedAddress as `0x${string}`, to as `0x${string}`, BigInt(tokenId)],
        account: connectedAddress as `0x${string}`,
        chainId: 13579,
      } as any);
      notification.success("Transfer submitted");
      // Optimistically remove from local holdings and clear input
      setMyAllCollectibles(prev => prev.filter(c => !(c.contractName === "KittensV2" && c.id === tokenId)));
      setTransferAddr(prev => ({ ...prev, [tokenId]: "" }));
    } catch (e: any) {
      console.error(e);
      notification.error(e?.shortMessage || e?.message || "Transfer failed");
    } finally {
      setTransferringId(null);
    }
  };

  // trigger holdings reload
  // setRefreshKey(prev => prev + 1);
  // // clear the recipient input for this token
  // setTransferAddr(prev => ({ ...prev, [tokenId]: "" }));
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
          {myAllCollectibles.map(item => {
            const displayName = item.name || `Token #${item.id}`;
            return (
              <NFTCard
                key={`${item.contractAddress}-${item.id}`}
                id={item.id}
                name={displayName}
                imageUrl={item.image || ""}
                description={item.description || ""}
                owner={undefined}
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
                  disabled: item.contractName !== "KittensV2",
                  onClick: () => transferToken(item.id),
                }}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
;

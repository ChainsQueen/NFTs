"use client";

import React from "react";
import { parseEther } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth/useScaffoldWriteContract";
import { NFTCard } from "./nft-card";

export interface GalleryCardItem {
  id: number;
  uri: string;
  owner?: string;
  name?: string;
  image?: string;
  description?: string;
}

// eslint-disable-next-line complexity
export const GalleryCard: React.FC<{ item: GalleryCardItem }> = ({ item }) => {
  const { address } = useAccount();
  const kittenId = Math.floor(item.id / 1_000_000);

  const { data: deployed } = useDeployedContractInfo({ contractName: "Kittens" as any });
  const { data: saleActive } = useReadContract({
    address: deployed?.address,
    abi: deployed?.abi as any,
    functionName: "saleActive",
  });
  const { data: mintedBn } = useReadContract({
    address: deployed?.address,
    abi: deployed?.abi as any,
    functionName: "mintedPerKitten",
    args: [BigInt(kittenId)],
  });
  const { data: maxPerBn } = useReadContract({
    address: deployed?.address,
    abi: deployed?.abi as any,
    functionName: "maxPerKitten",
    args: [BigInt(kittenId)],
  });
  const { data: defaultMaxBn } = useReadContract({
    address: deployed?.address,
    abi: deployed?.abi as any,
    functionName: "defaultMaxPerKitten",
  });

  const cap = (maxPerBn && maxPerBn !== 0n ? maxPerBn : defaultMaxBn) ?? 0n;
  const minted = mintedBn ?? 0n;
  const isSoldOut = cap !== 0n && minted >= cap;

  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "Kittens" });

  const onMint = async () => {
    if (!address || !saleActive || isSoldOut) return;
    await writeContractAsync({
      functionName: "mintItem",
      args: [address, BigInt(kittenId), item.uri],
      value: parseEther("0.05"),
    });
  };

  const cta = {
    label: isSoldOut ? "Sold out" : "Mint 0.05 TTRUST",
    disabled: !saleActive || isSoldOut || !address,
    loading: isMining,
    onClick: onMint,
  } as const;

  const mintedNum = Number(minted);
  const capNum = cap !== 0n ? Number(cap) : undefined;
  const belowCta = (
    <div className="w-full text-center text-xs text-neutral-500 tabular-nums">
      {capNum ? `Minted ${mintedNum}/${capNum}` : `Minted ${mintedNum}`}
    </div>
  );

  return (
    <NFTCard
      id={item.id}
      name={item.name || `Token #${item.id}`}
      imageUrl={item.image || ""}
      description={item.description || ""}
      owner={item.owner || undefined}
      mediaAspect="1:1"
      ctaPrimary={cta}
      belowCta={belowCta}
    />
  );
};

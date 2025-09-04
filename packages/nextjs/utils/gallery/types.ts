import type { NFTMetaData } from "../../utils/simpleNFT/nftsMetadata";

export interface GalleryItem extends Partial<NFTMetaData> {
  id: number;
  uri: string;
  owner: string;
}

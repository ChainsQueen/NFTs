import { createLogger } from "~~/utils/debug";

const log = createLogger("ipfs-api");

const fetchFromApi = ({ path, method, body }: { path: string; method: string; body?: object }) => {
  log.info("IPFS API request", { path, method, body });
  return fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
    .then(async response => {
      const json = await response.json();
      log.debug("IPFS API response", { path, status: response.status, ok: response.ok, json });
      return json;
    })
    .catch(error => {
      log.error("IPFS API error", { path, error });
      throw error;
    });
};

export const addToIPFS = (yourJSON: object) => fetchFromApi({ path: "/api/ipfs/add", method: "Post", body: yourJSON });

export const getMetadataFromIPFS = (ipfsHash: string) =>
  fetchFromApi({ path: "/api/ipfs/get-metadata", method: "Post", body: { ipfsHash } });

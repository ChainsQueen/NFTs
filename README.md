<h1 align="center">Kitten NFT Gallery</h1>
<p align="center">
  <a href="https://meow.intuition.box/"><img src="https://img.shields.io/website?url=https%3A%2F%2Fmeow.intuition.box%2F&label=Live%20App&logo=vercel" alt="Live App" /></a>
  <a href="https://github.com/ChainsQueenEth/web3dashboard/actions/workflows/ci.yml"><img src="https://github.com/ChainsQueenEth/web3dashboard/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20.18.3-339933?logo=node.js&logoColor=white" alt="Node >=20.18.3" />
  <img src="https://img.shields.io/badge/yarn-3.x-2C8EBB?logo=yarn&logoColor=white" alt="Yarn 3.x" />
</p>



<p align="center">
  <a href="#start-here">🚀 Start here</a> ·
  <a href="#features">✨ Features</a> ·
  <a href="#ui-showcase">🖥️ User Interface</a> ·
  <a href="#tech-stack">🧰 Tech Stack</a> ·
  <a href="#structure">📂 Structure</a> ·
  <a href="#env">🔧 Environment</a> ·
  <a href="#quick-start">⚡ Quick Start</a> ·
  <a href="#usage">📦 Usage & Deployment</a> ·
  <a href="#troubleshooting">🛠️ Troubleshooting</a> ·
  <a href="#glossary">📖 Glossary</a>
</p>



<h2 id="start-here" align="center">🚀 New here? Start here (2 minutes)</h2>

1. [CWD](#glossary-cwd): `/`
   - `yarn install`
   - `yarn chain`
   - `yarn compile && yarn deploy --network hardhat`
   - `yarn start` → open http://localhost:3000
2. To deploy on Intuition later: `yarn deploy --network intuition`
3. Environment file for contracts: `packages/hardhat/.env`
   - `ALCHEMY_API_KEY`,
   - `__RUNTIME_DEPLOYER_PRIVATE_KEY`,
   - `ETHERSCAN_V2_API_KEY` (optional).


<h2 id="features" align="center">✨ Features</h2>

- Modern [ERC‑721](#glossary-erc-721) dApp: Hardhat (contracts) + Next.js (UI)
- Aggregated “My [NFTs](#glossary-nft)” across mapped [ERC‑721](#glossary-erc-721) contracts on the active chain
- [IPFS](#glossary-ipfs) metadata with gateway fallbacks
- Wallet connect and on‑chain reads via wagmi/viem
- Fast local dev (yarn chain · yarn deploy · yarn start)


 <h2 id="ui-showcase" align="center">🖥️ User Interface</h2>
<p align="center" style="margin: 28px 0 36px;">
  <span style="display:inline-block; width:49%; text-align:center; vertical-align:top;">
    <img src="packages/nextjs/public/img/home_page.png" alt="Home page" width="100%" />
    <br />
    <sub>Welcome screen with wallet connect, a featured kitten, and quick links to Gallery and My NFTs.</sub>
  </span>
</p>



<p align="center" style="margin: 28px 0 36px;">
  <span style="display:inline-block; width:49%; text-align:center; vertical-align:top;">
    <img src="packages/nextjs/public/img/gallery_page.png" alt="Gallery page" width="100%" />
    <br />
    <sub>Gallery page with all kittens displayed in a grid layout.</sub>
  </span>
</p>



<h2 id="tech-stack" align="center">🧰 Tech Stack (short)</h2>

- Solidity + Hardhat (OpenZeppelin ERC‑721)
- Next.js (React, Tailwind, DaisyUI)
- wagmi/viem
- TypeScript
- ESLint/Prettier
- Optional: IPFS static export

<h2 id="structure" align="center">📂 Structure (brief)</h2>

- `packages/hardhat/` – Solidity contracts, deploy scripts, deployments
- `packages/nextjs/` – Next.js app (app/, partials/, utils/, contracts/)


<h2 id="env" align="center">🔧 Environment Variables</h2>


| App | File | Variable | Purpose |
|---|---|---|---|
| Hardhat | `packages/hardhat/.env` | `ALCHEMY_API_KEY` | RPC provider for deployments/tests |
| Hardhat | `packages/hardhat/.env` | `ETHERSCAN_V2_API_KEY` | Contract verification |
| Hardhat | `packages/hardhat/.env` | `__RUNTIME_DEPLOYER_PRIVATE_KEY` | Deployer account (keep secret) |
| Next.js | `packages/nextjs/.env` | `NEXT_PUBLIC_*` | Public UI config (chain id, RPC, flags) |

> Security: Never commit `.env` files or private keys. Use a separate deployer account with minimal funds for testnets.


<h2 id="quick-start" align="center">⚡ Quick Start (Yarn)</h2>

1) Requirements
   - Node >= 20.18.3
   - Yarn 3.x (see `"packageManager": "yarn@3.2.3"`)

2) Install

```bash
yarn install
```
3) Run locally

```bash
# Terminal 1
yarn chain

# Terminal 2
yarn compile && yarn deploy

# Terminal 3
yarn start
# Open http://localhost:3000
```

<h2 id="usage" align="center">📦 Usage & Deployment</h2>

<a id="glossary-cwd"></a>
<h3 align="center">Commands</h3>

<h4 align="center">⚙️ Contracts</h4>

<h5 align="center">Contract Setup & Build</h5>

| CWD | Command | Description |
| --- | --- | --- |
| / | `yarn install` | Installs all workspace dependencies. |
| / | `yarn compile` | Compiles Solidity, generates artifacts and TypeChain types. |
| / | `yarn test` | Runs Hardhat tests on the in‑memory Hardhat network. |
| / | `yarn hardhat:flatten` | Creates a single Solidity file by merging a contract and its imports. |

<h5 align="center">Deploy & Verify</h5>

| CWD | Command | Description |
| --- | --- | --- |
| / | `yarn deploy --network intuition` | Deploys contracts to Intuition (via hardhat‑deploy) and generates TS ABIs. |
| / | `yarn verify --network intuition` | Verifies contracts from deployments on the Intuition explorer (if supported). |

<h3 align="center">Accounts & Keys</h3>

| CWD | Command | Description |
| --- | --- | --- |
| / | `yarn account` | Lists the encrypted deployer account and balances across configured networks. |
| / | `yarn account:generate` | Generates a new deployer, encrypts it, and stores `DEPLOYER_PRIVATE_KEY_ENCRYPTED` in `packages/hardhat/.env`. |
| / | `yarn account:import` | Imports your deployer private key into `packages/hardhat/.env` (required to deploy to Intuition). |
| / | `yarn account:reveal-pk` | Reveals the decrypted private key from `DEPLOYER_PRIVATE_KEY_ENCRYPTED` (use with caution). |


<h5 align="center">Network & Console</h5>

| CWD | Command | Description |
| --- | --- | --- |
| / | `yarn chain` | Starts a local Hardhat [JSON‑RPC](#glossary-json-rpc) node. |
| / | `yarn workspace @se-2/hardhat hardhat console --network intuition` | Interactive console to read/write contract state on Intuition. |
| / | `yarn workspace @se-2/hardhat hardhat run scripts/debug-tokenuri.ts --network intuition` | Runs a script against Intuition. |

<a id="glossary-rpc"></a><a id="glossary-json-rpc"></a>

<h4 align="center">🖥️ Frontend</h4>

| CWD | Command | Description |
| --- | --- | --- |
| / | `yarn start` | Starts the Next.js dev server at `http://localhost:3000`. |
| / | `yarn next:build` | Builds the Next.js app for production. |
| / | `yarn next:serve` | Serves the production build locally. |
| / | `yarn ipfs` | Static export and upload to [IPFS](#glossary-ipfs) via bgipfs. |

<h4 align="center">✅ Quality</h4>

| CWD | Command | Description |
| --- | --- | --- |
| / | `yarn lint` | Runs ESLint across frontend and contracts. |
| / | `yarn format` | Formats code with Prettier. |

<h2 id="troubleshooting" align="center">🛠️ Troubleshooting</h2>

<h3 align="center">🔑 Environment</h3>

| Issue | Fix |
| --- | --- |
| Environment not set | Set `__RUNTIME_DEPLOYER_PRIVATE_KEY`. Optional: `ALCHEMY_API_KEY` (not needed for Intuition), `ETHERSCAN_V2_API_KEY` (if explorer supports API verification). |
| Deploy cannot sign | Ensure `__RUNTIME_DEPLOYER_PRIVATE_KEY` is set; then `yarn deploy --network intuition`. |

<h3 align="center">🚀 Deploy & Verify</h3>

| Issue | Fix |
| --- | --- |
| Intuition verification | If `yarn verify --network intuition` fails, use: `yarn workspace @se-2/hardhat hardhat verify --network intuition <address> [args...]`. |

<h3 align="center">🖼️ Metadata</h3>

| Issue | Fix |
| --- | --- |
| Metadata not showing | Run: `CONTRACT_ADDRESS=0x089... TOKEN_ID=1 FETCH=1 yarn workspace @se-2/hardhat hardhat run --network intuition scripts/debug-tokenuri.ts`. |

<h3 align="center">🛠️ Local Dev</h3>

| Issue | Fix |
| --- | --- |
| [CWD](#glossary-cwd) basics | Repo root: `/NFTs`; Hardhat: `/packages/hardhat`; Next.js: `/packages/nextjs`. |
| Port in use / local node issues | Stop any running nodes or change ports; retry `yarn chain`. |
| Stale artifacts or types | `yarn workspace @se-2/hardhat hardhat clean && yarn compile`. |
| Frontend not picking up new contracts | Re-deploy or re-run compile to regenerate TS ABIs. |


<h2 id="glossary" align="center">📖 Glossary</h2>

| Short | Full name | Simple explanation |
| --- | --- | --- |
| RPC | Remote Procedure Call | The endpoint through which an app communicates with a blockchain node. |
| JSON‑RPC | JSON Remote Procedure Call | Standard request/response protocol (HTTP/WebSocket) used by Ethereum nodes. |
| TS ABI | TypeScript ABI types | Generated TypeScript types from the ABI to type contract calls. |
| ERC‑721 | Ethereum NFT standard 721 | Standard for unique (non‑fungible) tokens, e.g., NFTs. |
| IPFS | InterPlanetary File System | Decentralized storage for NFT metadata and images. |
| CWD | Current Working Directory | The folder you execute a command from. |
| .env | Environment variables file | Local file storing secrets and configuration (not committed to git). |
| NFT | Non‑Fungible Token | Unique digital asset on the blockchain. |

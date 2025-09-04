<h1 align="center">Kitten NFT Gallery</h1>
<p align="center">
  <a href="https://meow.intuition.box/"><img src="https://img.shields.io/website?url=https%3A%2F%2Fmeow.intuition.box%2F&label=Live%20App&logo=vercel" alt="Live App" /></a>
  <a href="https://github.com/ChainsQueenEth/web3dashboard/actions/workflows/ci.yml"><img src="https://github.com/ChainsQueenEth/web3dashboard/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20.18.3-339933?logo=node.js&logoColor=white" alt="Node >=20.18.3" />
  <img src="https://img.shields.io/badge/yarn-3.x-2C8EBB?logo=yarn&logoColor=white" alt="Yarn 3.x" />
</p>



<p align="center">
  <a href="#start-here">Start here</a> ·
  <a href="#features">Features</a> ·
  <a href="#ui-showcase">User Interface</a> ·
  <a href="#quick-start">Quick Start (Yarn)</a> ·
  <a href="#contract">Contract</a> ·
  <a href="#structure">Structure</a> ·
  <a href="#troubleshooting">Troubleshooting</a> ·
  <a href="#license">License</a>
</p>



<h2 id="start-here" align="center">New here? Start here (2 minutes)</h2>

1. CWD: `/` (project root)
   - `yarn install`
   - `yarn chain`
   - `yarn compile && yarn deploy --network hardhat`
   - `yarn start` → open http://localhost:3000
2. To deploy on Intuition later: `yarn deploy --network intuition`
3. Environment file for contracts: `packages/hardhat/.env`
   - `ALCHEMY_API_KEY`,
   - `__RUNTIME_DEPLOYER_PRIVATE_KEY`,
   - `ETHERSCAN_V2_API_KEY` (optional).


<h2 id="features" align="center">Features</h2>

- Modern ERC‑721 dApp: Hardhat (contracts) + Next.js (UI)
- Aggregated “My NFTs” across mapped ERC‑721 contracts on the active chain
- IPFS metadata with gateway fallbacks
- Wallet connect and on‑chain reads via wagmi/viem
- Fast local dev (yarn chain · yarn deploy · yarn start)



 <h2 id="ui-showcase" align="center">User Interface</h2>
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



<h2 align="center">Tech Stack (short)</h2>

- Solidity + Hardhat (OpenZeppelin ERC‑721)
- Next.js (React, Tailwind, DaisyUI)
- wagmi/viem
- TypeScript
- ESLint/Prettier
- Optional: IPFS static export

<h2 id="structure" align="center">Structure (brief)</h2>

- `packages/hardhat/` – Solidity contracts, deploy scripts, deployments
- `packages/nextjs/` – Next.js app (app/, partials/, utils/, contracts/)


<h2 align="center">Environment Variables</h2>


| App | File | Variable | Purpose |
|---|---|---|---|
| Hardhat | `packages/hardhat/.env` | `ALCHEMY_API_KEY` | RPC provider for deployments/tests |
| Hardhat | `packages/hardhat/.env` | `ETHERSCAN_V2_API_KEY` | Contract verification |
| Hardhat | `packages/hardhat/.env` | `__RUNTIME_DEPLOYER_PRIVATE_KEY` | Deployer account (keep secret) |
| Next.js | `packages/nextjs/.env` | `NEXT_PUBLIC_*` | Public UI config (chain id, RPC, flags) |

> Security: Never commit `.env` files or private keys. Use a separate deployer account with minimal funds for testnets.


<h2 align="center">Quick Start (Yarn)</h2>

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

<h2 align="center">Contracts quick commands</h2>

- __Compile contracts__

  ```bash
  yarn hardhat:compile
  ```

  Compiles Solidity sources in `packages/hardhat/contracts/` and generates artifacts + typechain types. Run this after changing contracts or on a fresh checkout.

- __Deploy to Intuition testnet__

  ```bash
  yarn hardhat:deploy --network intuition
  ```

  Uses `hardhat-deploy` to execute scripts in `packages/hardhat/deploy/` against the `intuition` network.

  Requirements:
  - `packages/hardhat/.env`: set `__RUNTIME_DEPLOYER_PRIVATE_KEY` (funded test account)
  - `ALCHEMY_API_KEY` or an RPC URL configured for `intuition` in `hardhat.config.ts`

  Output:
  - Writes ABIs and addresses to `packages/hardhat/deployments/`
  - The Next.js app reads these to interact with the deployed contracts


<h2 align="center">Usage & Deployment</h2>

<h3 align="center">Commands</h3>

<p align="center"><sub>Unless noted otherwise, run these commands from the project root: <code>/NFTs</code>.</sub></p>

<table>
  <colgroup>
    <col style="width: 12%" />
    <col style="width: 24%" />
    <col style="width: 52%" />
    <col style="width: 12%" />
  </colgroup>
  <thead>
    <tr>
      <th>CWD</th>
      <th>Command</th>
      <th>Description</th>
      <th>Local Dev</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td></td>
      <td><strong>Contracts</strong></td>
      <td></td>
      <td></td>
    </tr>
    <tr>
      <td>/ (project root)</td>
      <td><code>yarn install</code></td>
      <td>Installs all workspace dependencies.</td>
      <td>Yes</td>
    </tr>
    <tr>
      <td>/ (project root)</td>
      <td><code>yarn chain</code></td>
      <td>Starts a local Hardhat JSON‑RPC node.</td>
      <td>Yes</td>
    </tr>
    <tr>
      <td>/ (project root)</td>
      <td><code>yarn compile</code></td>
      <td>Compiles Solidity, generates artifacts and TypeChain types.</td>
      <td>Yes</td>
    </tr>
    <tr>
      <td>/ (project root)</td>
      <td><code>yarn test</code></td>
      <td>Runs Hardhat tests on the in‑memory Hardhat network.</td>
      <td>Yes</td>
    </tr>
    <tr>
      <td>/ (project root)</td>
      <td><code>yarn deploy --network intuition</code></td>
      <td>Deploys contracts to Intuition (via hardhat‑deploy) and generates TS ABIs.</td>
      <td></td>
    </tr>
    <tr>
      <td>/ (project root)</td>
      <td><code>yarn verify --network intuition</code></td>
      <td>Verifies contracts from deployments on the Intuition explorer (if supported).</td>
      <td></td>
    </tr>
    <tr>
      <td>/ (project root)</td>
      <td><code>yarn workspace @se-2/hardhat hardhat console --network intuition</code></td>
      <td>Interactive console to read/write contract state on Intuition.</td>
      <td></td>
    </tr>
    <tr>
      <td>/ (project root)</td>
      <td><code>yarn hardhat:flatten</code></td>
      <td>Creates a single Solidity file by merging a contract and its imports.</td>
      <td></td>
    </tr>
    <tr>
      <td>/ (project root)</td>
      <td><code>yarn account</code></td>
      <td>Lists the encrypted deployer account and balances across configured networks.</td>
      <td></td>
    </tr>
    <tr>
      <td>/ (project root)</td>
      <td><code>yarn account:generate</code></td>
      <td>Generates a new deployer, encrypts it, and stores <code>DEPLOYER_PRIVATE_KEY_ENCRYPTED</code> in <code>packages/hardhat/.env</code>.</td>
      <td></td>
    </tr>
    <tr>
      <td>/ (project root)</td>
      <td><code>yarn account:import</code></td>
      <td>Imports your deployer private key into <code>packages/hardhat/.env</code> (required to deploy to Intuition).</td>
      <td></td>
    </tr>
    <tr>
      <td>/ (project root)</td>
      <td><code>yarn account:reveal-pk</code></td>
      <td>Reveals the decrypted private key from <code>DEPLOYER_PRIVATE_KEY_ENCRYPTED</code> (use with caution).</td>
      <td></td>
    </tr>
    <tr>
      <td>/ (project root)</td>
      <td><code>yarn workspace @se-2/hardhat hardhat run scripts/debug-tokenuri.ts --network intuition</code></td>
      <td>Runs a script against Intuition.</td>
      <td></td>
    </tr>
    <tr>
      <td>/ (project root)</td>
      <td><code>CONTRACT_ADDRESS=0x0896394eab4c98De3716Dd8fe2AdC4C383091e38 TOKEN_ID=12 FETCH=1 yarn workspace @se-2/hardhat hardhat run --network intuition scripts/debug-tokenuri.ts</code></td>
      <td>Fetches NFT details on Intuition for tokenId 12: prints JSON (network, contract, owner, tokenURI, resolved tokenURI, metadata).</td>
      <td></td>
    </tr>
    <tr>
      <td></td>
      <td><strong>Frontend</strong></td>
      <td></td>
      <td></td>
    </tr>
    <tr>
      <td>/ (project root)</td>
      <td><code>yarn start</code></td>
      <td>Starts the Next.js dev server at <code>http://localhost:3000</code>.</td>
      <td>Yes</td>
    </tr>
    <tr>
      <td>/ (project root)</td>
      <td><code>yarn next:build</code></td>
      <td>Builds the Next.js app for production.</td>
      <td></td>
    </tr>
    <tr>
      <td>/ (project root)</td>
      <td><code>yarn next:serve</code></td>
      <td>Serves the production build locally.</td>
      <td></td>
    </tr>
    <tr>
      <td>/ (project root)</td>
      <td><code>yarn ipfs</code></td>
      <td>Static export and upload to IPFS via bgipfs.</td>
      <td></td>
    </tr>
    <tr>
      <td></td>
      <td><strong>Quality</strong></td>
      <td></td>
      <td></td>
    </tr>
    <tr>
      <td>/ (project root)</td>
      <td><code>yarn lint</code></td>
      <td>Runs ESLint across frontend and contracts.</td>
      <td></td>
    </tr>
    <tr>
      <td>/ (project root)</td>
      <td><code>yarn format</code></td>
      <td>Formats code with Prettier.</td>
      <td></td>
    </tr>
  </tbody>
  </table>


<h3 align="center">Troubleshooting</h3>

- CWD basics
  - "CWD: / (project root)" means the repo root: `/NFTs`.
  - Hardhat package: `/NFTs/packages/hardhat`.
  - Next.js package: `/NFTs/packages/nextjs`.

- Environment not set
  - Required (deploys): `__RUNTIME_DEPLOYER_PRIVATE_KEY` — the deployer wallet private key used to sign transactions.
  - Optional (provider key): `ALCHEMY_API_KEY` (or your provider’s equivalent) — only needed for mainnet forking or when using Alchemy-based RPCs for non‑Intuition networks.
  - Optional (verification): `ETHERSCAN_V2_API_KEY` — only if the target network’s explorer and config support API verification.
  - Note: Intuition RPC (`https://testnet.rpc.intuition.systems`) does not require a provider API key.
  - Without a deployer key, `yarn deploy --network intuition` cannot sign transactions.

- Intuition verification
  - `yarn verify --network intuition` works only if an explorer + API key is supported by the config. If it fails, try manual verify:
    - `yarn workspace @se-2/hardhat hardhat verify --network intuition <address> [args...]`

- Metadata not showing
  - Use the inspection script against Intuition:
    - `TOKEN_ID=1 FETCH=1 yarn workspace @se-2/hardhat hardhat run --network intuition scripts/debug-tokenuri.ts`
  - This resolves `ipfs://` to HTTP via gateways and prints the JSON.

- Port in use / local node issues
  - If `yarn chain` fails, another node may be running. Stop old processes or change ports, then retry.

- Stale artifacts or types
  - Clear cache and artifacts, then recompile:
    - `yarn workspace @se-2/hardhat hardhat clean && yarn compile`

- Frontend not picking up new contracts
  - After deploy, the extended deploy task generates TS ABIs. If ABIs seem missing, run a fresh deploy or re-run compile to regenerate.

<h2 id="contract" align="center">Contract (overview)</h2>

File: `packages/hardhat/contracts/Kittens.sol`
- Constructor: expects an `owner` address (read from `OWNER_ADDRESS` in `.env`), otherwise defaults to the `deployer` named account.
- ERC‑721 Enumerable + URI Storage + Ownable
- Key funcs: `mintItem(address to, string uri)`, `mintBatch(address to, string[] uris)`, transfers via standard `safeTransferFrom/transferFrom`
- Constants: `MAX_SUPPLY = 12`, `MINT_PRICE = 0.05 ether`
- Emits: `Minted(tokenId, to, uri)`

Mint examples (Hardhat console):
```js
const c = await ethers.getContractAt("Kittens", (await deployments.get("Kittens")).address);
await c.mintItem("0xYOUR_ADDRESS", "ipfs://<CID>/image-kitten-01.json", { value: ethers.parseEther("0.05") });
await c.mintBatch("0xYOUR_ADDRESS", ["ipfs://<CID>/image-kitten-01.json", "ipfs://<CID>/image-kitten-02.json"]);
```

<h3 align="center">Kittens Auto‑Mint Recap</h3>

**Prepared auto‑mint env** in `packages/hardhat/.env`:

```
MINT_AFTER_DEPLOY=true
MINT_URIS=["ipfs://.../image-kitten-01.json","ipfs://.../image-kitten-02.json", ..., "ipfs://.../image-kitten-12.json"]
```

**Ran the Kittens deploy script** from repo root:

```
yarn workspace @se-2/hardhat deploy --network intuition --tags Kittens
```

The script `packages/hardhat/deploy/02_deploy_kittens.ts` reused the existing deployment at
`0x20b691728B6fdaB7Ae0cBe7C73E170ed41e5A32d`, connected as the owner
(`0xF4220e5c9882746f4F52FC61Dcfd1095c5D563e6`), and called `mintBatch(...)`.

**Mint succeeded**
- Log: `Minted 12 token(s). Tx: 0xb7e19334c1a09f4cda2be096bcf87a90be01b28473229c7907a47802964ab292`

**Verify (optional)**
- Path: `packages/hardhat/`
- Console: `yarn hardhat console --network intuition`

```js
const c = await ethers.getContractAt("Kittens","0x20b691728B6fdaB7Ae0cBe7C73E170ed41e5A32d");
(await c.totalSupply()).toString(); // expect "12"
await c.tokenURI(1);
```

**Avoid duplicate auto‑mints**
- In `packages/hardhat/.env`, set `MINT_AFTER_DEPLOY=false` once done (keep `MINT_URIS` for reference).

<h3 align="center">About the deploy script: 02_deploy_kittens.ts</h3>

- Path: `packages/hardhat/deploy/02_deploy_kittens.ts`
- What it is: A `hardhat-deploy` script that deploys `Kittens.sol`. Scripts in `deploy/` run automatically when you execute `yarn deploy`.
- How it runs:
  - CWD: `/` — `yarn deploy --network <network>`
  - CWD: `packages/hardhat/` — `yarn hardhat deploy --network <network>`
- Inputs it uses:
  - `namedAccounts.deployer` from `packages/hardhat/hardhat.config.ts`
  - Env variables in `packages/hardhat/.env` (e.g., `__RUNTIME_DEPLOYER_PRIVATE_KEY`)
  - Optional: `OWNER_ADDRESS` (contract owner), `MINT_AFTER_DEPLOY`, `MINT_URIS` (and `MINT_KITTEN_IDS`) to auto‑mint after deploy
- Outputs it produces:
  - Writes address + ABI to `packages/hardhat/deployments/<network>/Kittens.json`
  - Triggers TS ABI generation (extended deploy task), which the frontend reads
- Tips:
  - Re‑runs are idempotent (won’t redeploy if nothing changed). Use a new script (e.g., `03_deploy_kittens_v2.ts`) for upgrades.
  - You can target this script alone if it has a tag, e.g., `--tags Kittens`.

<h3 align="center">About Hardhat config: hardhat.config.ts</h3>

- Path: `packages/hardhat/hardhat.config.ts`
- What it is: The central configuration for Solidity versioning, networks (e.g., `intuition`), plugins, verification, and named accounts.
- Key responsibilities:
  - Defines `solidity` compiler and optimizer settings
  - Declares networks (RPC URLs and which private key to use)
  - Configures verification (`etherscan`/`verify`) and `hardhat-deploy`
  - Sets `namedAccounts.deployer` used by deploy scripts
  - Extends the `deploy` task to generate TypeScript ABIs after deployment
- How pieces connect semantically:
  - You set secrets in `packages/hardhat/.env` → `hardhat.config.ts` reads them → `yarn deploy --network intuition` uses that account + RPC → `02_deploy_kittens.ts` deploys and `deployments/<network>` is written → extended task generates ABIs → Next.js reads addresses/ABIs to interact on the selected network.
- Useful commands:
  - CWD: `/` — `yarn deploy --network intuition`
  - CWD: `/` — `yarn verify --network intuition`
  - CWD: `/` — `yarn workspace @se-2/hardhat hardhat console --network intuition`

<h4 align="center">Where ABIs and addresses live</h4>

- Deployments (addresses + ABIs written by hardhat-deploy):
  - `packages/hardhat/deployments/<network>/Kittens.json`
- Frontend-consumable ABIs/typed artifacts (generated post‑deploy):
  - Check your app’s imports in `packages/nextjs/` and the shared artifacts in `packages/nextjs/contracts/`
- If something looks out of sync, re-run: `yarn compile` or `yarn deploy --network <network>`

Reference: hardhat-deploy docs — https://github.com/wighawag/hardhat-deploy

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * KittensV2 (ERC721)
 * - Contract-derives tokenURI from a baseURI and kittenId
 * - Base URI pattern (IPFS): ipfs://<directoryCID>/<kittenId>.json
 * - Editions model: each kittenId can be minted multiple times (serials)
 * - Token ID scheme: tokenId = kittenId * 1_000_000 + serial
 * - No per-token URI storage (prevents malformed URIs)
 *
 * # Reason:
 * Make tokenURI deterministic and "Relic-like" (derived on-chain),
 * while keeping IPFS-only metadata hosting.
 */
contract KittensV2 is ERC721, ERC721Enumerable, Ownable {
    using Strings for uint256;

    uint256 public constant MINT_PRICE = 0.05 ether;

    // Sale controls
    bool public saleActive = true;

    // Global minted counter; also used as the latest tokenId (starts at 0, first mint gives ID 1)
    uint256 public totalMinted;

    // Editions: per-kitten minted counters and caps
    mapping(uint256 => uint256) public mintedPerKitten; // kittenId => minted count
    mapping(uint256 => uint256) public maxPerKitten;    // kittenId => cap (0 means use default)
    uint256 public defaultMaxPerKitten = 10;            // each kitten mintable up to 10 times by default

    // Base URI used to derive tokenURI(tokenId)
    string private _baseTokenURI; // e.g., "ipfs://bafy.../"

    // Map sequential tokenId => kittenId (so token IDs can start at 1 and remain contiguous)
    mapping(uint256 => uint256) public tokenIdToKittenId;

    event Minted(uint256 indexed tokenId, uint256 indexed kittenId, uint256 serial, address indexed to);
    event BaseURIUpdated(string newBaseURI);

    constructor(address initialOwner, string memory baseURI_)
        ERC721("KittensV2", "KITY2")
        Ownable(initialOwner)
    {
        _baseTokenURI = baseURI_;
    }

    // --- Owner controls ---
    function setSaleActive(bool active) external onlyOwner {
        saleActive = active;
    }

    function withdraw(address payable to) external onlyOwner {
        require(to != address(0), "bad to");
        to.transfer(address(this).balance);
    }

    function setDefaultMaxPerKitten(uint256 cap) external onlyOwner {
        require(cap > 0 && cap <= 10000, "bad cap");
        defaultMaxPerKitten = cap;
    }

    function setMaxPerKitten(uint256 kittenId, uint256 cap) external onlyOwner {
        require(cap > 0 && cap <= 10000, "bad cap");
        require(cap >= mintedPerKitten[kittenId], "lt minted");
        maxPerKitten[kittenId] = cap;
    }

    function setBaseURI(string memory newBase) external onlyOwner {
        _baseTokenURI = newBase;
        emit BaseURIUpdated(newBase);
    }

    // --- Minting (editions) ---
    // kittenId is the logical artwork ID (e.g., 1..12). Each mint creates a new serial for that kittenId.
    function mintItem(address to, uint256 kittenId) public payable returns (uint256) {
        require(saleActive, "sale off");
        require(msg.value >= MINT_PRICE, "insufficient value");
        require(kittenId > 0, "bad kittenId");

        uint256 cap = maxPerKitten[kittenId];
        if (cap == 0) cap = defaultMaxPerKitten;
        require(mintedPerKitten[kittenId] < cap, "kitten sold out");

        // Serial within the kitten's edition (1..cap)
        uint256 serial = mintedPerKitten[kittenId] + 1;
        mintedPerKitten[kittenId] = serial;

        // Assign a new sequential tokenId starting from 1
        totalMinted += 1;
        uint256 tokenId = totalMinted;

        // Record kitten mapping for URI derivation and querying
        tokenIdToKittenId[tokenId] = kittenId;

        _safeMint(to, tokenId);
        emit Minted(tokenId, kittenId, serial, to);
        return tokenId;
    }

    // --- Views ---
    function baseURI() external view returns (string memory) {
        return _baseTokenURI;
    }

    // ERC721 tokenURI override: derive from baseURI and kittenId
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721)
        returns (string memory)
    {
        require(_ownerOf(tokenId) != address(0), "ERC721: invalid token ID");
        uint256 kittenId = tokenIdToKittenId[tokenId];
        require(kittenId != 0, "missing kitten mapping");
        return string(abi.encodePacked(_baseTokenURI, kittenId.toString(), ".json"));
    }

    // --- OZ required overrides ---
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

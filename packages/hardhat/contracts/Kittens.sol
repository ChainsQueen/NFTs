// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * Kittens (ERC721)
 * - Per-mint explicit tokenURI (works with arbitrary filenames like image-kitten-01.json)
 * - Public mint for 0.05 ETH, toggleable sale
 * - ERC721 "Editions" emulation: each kittenId can be minted multiple times (serials)
 * - Per-kitten cap: default 5 editions per kittenId
 * - Owner can batch mint and withdraw
 *
 * # Reason:
 * Matches user's IPFS metadata filenames and collection size/price requirements.
 */
contract Kittens is ERC721, ERC721Enumerable, ERC721URIStorage, Ownable {
    uint256 public constant MINT_PRICE = 0.05 ether;

    // Global minted counter (optional, useful for stats)
    uint256 public totalMinted;
    bool public saleActive = true;

    // Editions: per-kitten minted counters and caps
    mapping(uint256 => uint256) public mintedPerKitten; // kittenId => minted count
    mapping(uint256 => uint256) public maxPerKitten;    // kittenId => cap (0 means use default)
    uint256 public defaultMaxPerKitten = 5;

    event Minted(uint256 indexed tokenId, uint256 indexed kittenId, uint256 serial, address indexed to, string uri);

    constructor(address initialOwner)
        ERC721("Kittens", "KITY")
        Ownable(initialOwner)
    {}

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

    // --- Minting (editions) ---
    // kittenId is the logical artwork ID (e.g., 1..12). Each mint creates a new serial for that kittenId.
    function mintItem(address to, uint256 kittenId, string memory uri) public payable returns (uint256) {
        require(saleActive, "sale off");
        require(msg.value >= MINT_PRICE, "insufficient value");
        require(kittenId > 0, "bad kittenId");

        uint256 cap = maxPerKitten[kittenId];
        if (cap == 0) cap = defaultMaxPerKitten;
        require(mintedPerKitten[kittenId] < cap, "kitten sold out");

        // Serial within the kitten's edition
        uint256 serial = mintedPerKitten[kittenId] + 1;
        mintedPerKitten[kittenId] = serial;

        // Compose tokenId such that we can infer kittenId/serial without extra storage
        uint256 tokenId = kittenId * 1_000_000 + serial;
        totalMinted += 1;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        emit Minted(tokenId, kittenId, serial, to, uri);
        return tokenId;
    }

    // Note: legacy ERC721 batch mint removed in editions model. If needed, implement
    // a batch that mints multiple serials for a given kittenId in one call.

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

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

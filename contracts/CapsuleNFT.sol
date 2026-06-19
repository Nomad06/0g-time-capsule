// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

interface ITimeCapsule {
    function getCapsule(bytes32 capsuleId) external view returns (
        address owner,
        uint64  unlockTime,
        uint64  unlockBlock,
        bytes32 storageRoot,
        bytes32 commitHash,
        bytes   memory timelockHeader,
        uint8   triggerType,
        address triggerContract,
        address[] memory recipients,
        uint8   state,
        uint64  createdAt
    );
    function isUnlocked(bytes32 capsuleId) external view returns (bool);
}

/// @title CapsuleNFT
/// @notice ERC-721 wrapper for 0G Time Capsule IDs.
///
/// Mint a sealed capsule as an NFT — the NFT holder is the sole
/// party authorised to reveal and decrypt the capsule content.
/// Transfer the NFT = transfer the reveal right.
contract CapsuleNFT is ERC721 {
    using Strings for uint256;

    ITimeCapsule public immutable timeCapsule;
    string       public           baseMetadataURI;

    uint256 private _nextTokenId;

    // capsuleId → tokenId (1-based; 0 = not minted)
    mapping(bytes32 => uint256) public capsuleToToken;
    // tokenId → capsuleId
    mapping(uint256 => bytes32) public tokenToCapsule;

    event CapsuleMinted(bytes32 indexed capsuleId, uint256 indexed tokenId, address indexed minter);

    error AlreadyMinted();
    error NotCapsuleOwner();
    error CapsuleAlreadyRevealed();

    constructor(address _timeCapsule, string memory _baseMetadataURI)
        ERC721("0G Time Capsule", "CAPSULE")
    {
        timeCapsule     = ITimeCapsule(_timeCapsule);
        baseMetadataURI = _baseMetadataURI;
    }

    /// @notice Mint an NFT for a capsule you own.
    ///         The capsule must be SEALED and caller must be its owner.
    function mint(bytes32 capsuleId) external returns (uint256 tokenId) {
        if (capsuleToToken[capsuleId] != 0) revert AlreadyMinted();

        (address owner,,,,,,,,,uint8 state,) = _getCapsuleData(capsuleId);
        if (owner  != msg.sender) revert NotCapsuleOwner();
        if (state  == 1)          revert CapsuleAlreadyRevealed();

        _nextTokenId++;
        tokenId = _nextTokenId;

        capsuleToToken[capsuleId] = tokenId;
        tokenToCapsule[tokenId]   = capsuleId;

        _safeMint(msg.sender, tokenId);
        emit CapsuleMinted(capsuleId, tokenId, msg.sender);
    }

    /// @notice Whether the capsule backing this token is unlocked.
    function isUnlocked(uint256 tokenId) external view returns (bool) {
        return timeCapsule.isUnlocked(tokenToCapsule[tokenId]);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        bytes32 capsuleId = tokenToCapsule[tokenId];
        return string(abi.encodePacked(
            baseMetadataURI,
            "/api/nft/",
            _toHex(capsuleId)
        ));
    }

    // ── internal ──────────────────────────────────────────────────────────────

    function _getCapsuleData(bytes32 capsuleId) internal view returns (
        address owner, uint64 unlockTime, uint64 unlockBlock,
        bytes32 storageRoot, bytes32 commitHash, bytes memory timelockHeader,
        uint8 triggerType, address triggerContract,
        address[] memory recipients, uint8 state, uint64 createdAt
    ) {
        return timeCapsule.getCapsule(capsuleId);
    }

    function _toHex(bytes32 data) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(66);
        str[0] = "0"; str[1] = "x";
        for (uint i = 0; i < 32; i++) {
            str[2 + i * 2]     = alphabet[uint8(data[i] >> 4)];
            str[3 + i * 2]     = alphabet[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }
}

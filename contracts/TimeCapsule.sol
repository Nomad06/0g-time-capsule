// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IRevealTrigger.sol";

/// @title TimeCapsule
/// @notice Core registry for 0G Time Capsule.
///
/// Lifecycle:
///   seal()   — store commitment + 0G storage root on-chain, ciphertext stays off-chain
///   reveal() — validates unlock condition, emits timelocked key so clients can decrypt
///   verify() — proves revealed plaintext matches the on-chain commitment hash (Stage 1)
///
/// Key design choice: the contract never holds the plaintext decryption key.
/// timelockHeader is the drand-timelocked symmetric key; the drand beacon publishes
/// the round key after unlockTime, letting any client decrypt locally. The contract
/// just stores and emits it — no trusted party involved.
contract TimeCapsule is ReentrancyGuard {

    // ─── Types ────────────────────────────────────────────────────────────────

    enum TriggerType { TIME, DEADMAN, ORACLE, MULTISIG }
    enum CapsuleState { SEALED, REVEALED }

    struct Capsule {
        address owner;
        uint64  unlockTime;       // unix timestamp; 0 = use unlockBlock
        uint64  unlockBlock;      // block number;   0 = use unlockTime
        bytes32 storageRoot;      // 0G Storage content-addressed hash
        bytes32 commitHash;       // keccak256(plaintext) — proof-of-existence
        bytes   timelockHeader;   // drand-timelocked symmetric key blob
        TriggerType triggerType;
        address triggerContract;  // non-zero for DEADMAN / ORACLE / MULTISIG
        address[] recipients;     // empty = public reveal; non-empty = gated
        CapsuleState state;
        uint64  createdAt;
    }

    // ─── Storage ──────────────────────────────────────────────────────────────

    mapping(bytes32 => Capsule) private _capsules;
    mapping(address => bytes32[]) private _ownerIndex;
    mapping(address => bytes32[]) private _recipientIndex;

    uint256 private _nonce;

    // ─── Events ───────────────────────────────────────────────────────────────

    event CapsuleSealed(
        bytes32 indexed capsuleId,
        address indexed owner,
        uint64  unlockTime,
        uint64  unlockBlock,
        bytes32 commitHash,
        TriggerType triggerType
    );

    /// Emitted on reveal — timelockHeader lets clients decrypt off-chain.
    event CapsuleRevealed(
        bytes32 indexed capsuleId,
        address indexed revealer,
        bytes   timelockHeader
    );

    // ─── Errors ───────────────────────────────────────────────────────────────

    error CapsuleNotFound(bytes32 capsuleId);
    error CapsuleLocked(bytes32 capsuleId, uint64 unlockTime, uint64 unlockBlock);
    error CapsuleAlreadyRevealed(bytes32 capsuleId);
    error NotRecipient(bytes32 capsuleId, address caller);
    error TriggerDenied(bytes32 capsuleId, address caller);
    error InvalidUnlockCondition();
    error InvalidStorageRoot();

    // ─── Seal ─────────────────────────────────────────────────────────────────

    /// @param storageRoot   Content hash of the ciphertext on 0G Storage.
    /// @param commitHash    keccak256(plaintext) — stored for later proof.
    /// @param timelockHeader Drand-timelocked symmetric key bytes.
    /// @param unlockTime    Unix timestamp after which reveal is allowed (0 = block-based).
    /// @param unlockBlock   Block number threshold (0 = time-based).
    /// @param recipients    Wallet addresses allowed to reveal; empty = anyone.
    /// @param triggerType   TIME for Stage 0-1; others wired to triggerContract.
    /// @param triggerContract External IRevealTrigger; address(0) for TIME trigger.
    function seal(
        bytes32   storageRoot,
        bytes32   commitHash,
        bytes     calldata timelockHeader,
        uint64    unlockTime,
        uint64    unlockBlock,
        address[] calldata recipients,
        TriggerType triggerType,
        address   triggerContract
    ) external returns (bytes32 capsuleId) {
        if (storageRoot == bytes32(0)) revert InvalidStorageRoot();
        if (unlockTime == 0 && unlockBlock == 0) revert InvalidUnlockCondition();
        if (unlockTime  != 0 && unlockTime  <= block.timestamp) revert InvalidUnlockCondition();
        if (unlockBlock != 0 && unlockBlock <= block.number)    revert InvalidUnlockCondition();

        capsuleId = keccak256(
            abi.encodePacked(msg.sender, storageRoot, block.timestamp, _nonce++)
        );

        Capsule storage cap = _capsules[capsuleId];
        cap.owner           = msg.sender;
        cap.unlockTime      = unlockTime;
        cap.unlockBlock     = unlockBlock;
        cap.storageRoot     = storageRoot;
        cap.commitHash      = commitHash;
        cap.timelockHeader  = timelockHeader;
        cap.triggerType     = triggerType;
        cap.triggerContract = triggerContract;
        cap.recipients      = recipients;
        cap.state           = CapsuleState.SEALED;
        cap.createdAt       = uint64(block.timestamp);

        _ownerIndex[msg.sender].push(capsuleId);
        for (uint256 i; i < recipients.length; ++i) {
            _recipientIndex[recipients[i]].push(capsuleId);
        }

        emit CapsuleSealed(capsuleId, msg.sender, unlockTime, unlockBlock, commitHash, triggerType);
    }

    // ─── Reveal ───────────────────────────────────────────────────────────────

    function reveal(bytes32 capsuleId) external nonReentrant {
        Capsule storage cap = _capsules[capsuleId];
        if (cap.owner == address(0))               revert CapsuleNotFound(capsuleId);
        if (cap.state == CapsuleState.REVEALED)    revert CapsuleAlreadyRevealed(capsuleId);

        _checkUnlock(cap, capsuleId, msg.sender);
        _checkRecipient(cap, capsuleId, msg.sender);

        cap.state = CapsuleState.REVEALED;

        if (cap.triggerContract != address(0)) {
            IRevealTrigger(cap.triggerContract).onRevealed(capsuleId);
        }

        emit CapsuleRevealed(capsuleId, msg.sender, cap.timelockHeader);
    }

    // ─── Verify (Stage 1 — proof of existence) ────────────────────────────────

    /// Prove that `plaintextHash` matches what was committed at seal time.
    /// Call off-chain with keccak256(abi.encodePacked(plaintext)) for trustless proof.
    function verify(bytes32 capsuleId, bytes32 plaintextHash) external view returns (bool) {
        return _capsules[capsuleId].commitHash == plaintextHash;
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function isUnlocked(bytes32 capsuleId) external view returns (bool) {
        Capsule storage cap = _capsules[capsuleId];
        if (cap.owner == address(0)) return false;
        if (cap.triggerContract != address(0)) {
            return IRevealTrigger(cap.triggerContract).canReveal(capsuleId, address(0));
        }
        return _timeUnlocked(cap);
    }

    function getCapsule(bytes32 capsuleId) external view returns (Capsule memory) {
        return _capsules[capsuleId];
    }

    function getOwnerCapsules(address owner) external view returns (bytes32[] memory) {
        return _ownerIndex[owner];
    }

    function getRecipientCapsules(address recipient) external view returns (bytes32[] memory) {
        return _recipientIndex[recipient];
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _timeUnlocked(Capsule storage cap) internal view returns (bool) {
        return (cap.unlockTime  > 0 && block.timestamp >= cap.unlockTime) ||
               (cap.unlockBlock > 0 && block.number    >= cap.unlockBlock);
    }

    function _checkUnlock(Capsule storage cap, bytes32 capsuleId, address caller) internal view {
        if (cap.triggerContract != address(0)) {
            if (!IRevealTrigger(cap.triggerContract).canReveal(capsuleId, caller)) {
                revert TriggerDenied(capsuleId, caller);
            }
            return;
        }
        if (!_timeUnlocked(cap)) {
            revert CapsuleLocked(capsuleId, cap.unlockTime, cap.unlockBlock);
        }
    }

    function _checkRecipient(Capsule storage cap, bytes32 capsuleId, address caller) internal view {
        if (cap.recipients.length == 0) return; // public capsule
        if (caller == cap.owner) return;         // owner always allowed
        for (uint256 i; i < cap.recipients.length; ++i) {
            if (cap.recipients[i] == caller) return;
        }
        revert NotRecipient(capsuleId, caller);
    }
}

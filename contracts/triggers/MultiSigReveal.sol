// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IRevealTrigger.sol";

/// @title MultiSigReveal
/// @notice Trigger module: M-of-N designated signers must approve before reveal.
///
/// Use case: sealed legal docs, board resolutions, escrow releases.
/// Flow:
///   1. Owner creates vault via create() referencing a TimeCapsule capsuleId.
///   2. Each designated signer calls approve(capsuleId).
///   3. Once approvalCount >= threshold, canReveal() returns true.
///   4. Any signer (or anyone) calls TimeCapsule.reveal() to finalize.
contract MultiSigReveal is IRevealTrigger, ReentrancyGuard {

    // ─── Types ────────────────────────────────────────────────────────────────

    struct Vault {
        address   owner;
        address[] signers;
        uint8     threshold;
        uint8     approvalCount;
        bool      revealed;
    }

    // ─── Storage ──────────────────────────────────────────────────────────────

    mapping(bytes32 => Vault) private _vaults;
    mapping(bytes32 => mapping(address => bool)) private _approved;

    address public immutable timeCapsule;

    // ─── Events ───────────────────────────────────────────────────────────────

    event VaultCreated(bytes32 indexed capsuleId, address indexed owner, uint8 threshold, uint8 total);
    event ApprovalGiven(bytes32 indexed capsuleId, address indexed signer, uint8 count, uint8 threshold);
    event ThresholdReached(bytes32 indexed capsuleId);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error VaultNotFound(bytes32 capsuleId);
    error AlreadyCreated(bytes32 capsuleId);
    error NotSigner(bytes32 capsuleId, address caller);
    error AlreadyApproved(bytes32 capsuleId, address signer);
    error VaultAlreadyRevealed(bytes32 capsuleId);
    error InvalidThreshold();
    error CallerNotTimeCapsule();

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _timeCapsule) {
        timeCapsule = _timeCapsule;
    }

    // ─── Create vault ─────────────────────────────────────────────────────────

    /// Register M-of-N config for a capsuleId that already exists in TimeCapsule.
    function create(
        bytes32   capsuleId,
        address   owner,
        address[] calldata signers,
        uint8     threshold
    ) external {
        if (threshold == 0 || threshold > signers.length) revert InvalidThreshold();
        if (_vaults[capsuleId].owner != address(0)) revert AlreadyCreated(capsuleId);

        Vault storage v = _vaults[capsuleId];
        v.owner         = owner;
        v.signers       = signers;
        v.threshold     = threshold;
        v.approvalCount = 0;
        v.revealed      = false;

        emit VaultCreated(capsuleId, owner, threshold, uint8(signers.length));
    }

    // ─── Approve ──────────────────────────────────────────────────────────────

    function approve(bytes32 capsuleId) external nonReentrant {
        Vault storage v = _vaults[capsuleId];
        if (v.owner == address(0))        revert VaultNotFound(capsuleId);
        if (v.revealed)                   revert VaultAlreadyRevealed(capsuleId);
        if (_approved[capsuleId][msg.sender]) revert AlreadyApproved(capsuleId, msg.sender);

        bool isSigner;
        for (uint256 i; i < v.signers.length; ++i) {
            if (v.signers[i] == msg.sender) { isSigner = true; break; }
        }
        if (!isSigner) revert NotSigner(capsuleId, msg.sender);

        _approved[capsuleId][msg.sender] = true;
        ++v.approvalCount;

        emit ApprovalGiven(capsuleId, msg.sender, v.approvalCount, v.threshold);

        if (v.approvalCount >= v.threshold) {
            emit ThresholdReached(capsuleId);
        }
    }

    // ─── IRevealTrigger ───────────────────────────────────────────────────────

    function canReveal(bytes32 capsuleId, address /*caller*/) external view override returns (bool) {
        Vault storage v = _vaults[capsuleId];
        if (v.owner == address(0)) return false;
        return v.approvalCount >= v.threshold;
    }

    function onRevealed(bytes32 capsuleId) external override {
        if (msg.sender != timeCapsule) revert CallerNotTimeCapsule();
        _vaults[capsuleId].revealed = true;
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getVault(bytes32 capsuleId) external view returns (
        address owner, uint8 threshold, uint8 approvalCount, bool revealed, address[] memory signers
    ) {
        Vault storage v = _vaults[capsuleId];
        return (v.owner, v.threshold, v.approvalCount, v.revealed, v.signers);
    }

    function hasApproved(bytes32 capsuleId, address signer) external view returns (bool) {
        return _approved[capsuleId][signer];
    }
}

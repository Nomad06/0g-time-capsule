// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title KeyRegistry
/// @notice On-chain registry for secp256k1 compressed public keys.
///
/// Recipients call registerKey() once with their 33-byte compressed secp256k1 pubkey.
/// Senders call getKey() before sealing to fetch the pubkey for ECIES encryption.
/// The private key never leaves the client — only the public key is stored.
contract KeyRegistry {

    mapping(address => bytes) private _keys;

    event KeyRegistered(address indexed wallet, bytes pubkey);

    error InvalidPubkeyLength(uint256 got);
    error KeyNotRegistered(address wallet);

    /// @param pubkey 33-byte compressed secp256k1 public key.
    function registerKey(bytes calldata pubkey) external {
        if (pubkey.length != 33) revert InvalidPubkeyLength(pubkey.length);
        _keys[msg.sender] = pubkey;
        emit KeyRegistered(msg.sender, pubkey);
    }

    /// Returns empty bytes if wallet has not registered.
    function getKey(address wallet) external view returns (bytes memory) {
        return _keys[wallet];
    }

    function hasKey(address wallet) external view returns (bool) {
        return _keys[wallet].length == 33;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title TaskToken — ERC-20 governance and utility token for TaskChain
/// @notice 100M max supply minted to deployer. MINTER_ROLE allows future reward distribution.
contract TaskToken is ERC20, ERC20Permit, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(address initialHolder)
        ERC20("TaskChain", "TASK")
        ERC20Permit("TaskChain")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, initialHolder);
        _grantRole(MINTER_ROLE, initialHolder);
        _mint(initialHolder, 100_000_000 * 10 ** 18); // 100M TASK
    }

    /// @notice Mint additional TASK. Only callable by MINTER_ROLE holders.
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
}

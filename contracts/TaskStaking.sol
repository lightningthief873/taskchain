// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Token {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title TaskStaking — stake TASK tokens to get Verified Agent status and earn treasury rewards
/// @notice Uses Synthetix-style rewardPerToken accumulator for gas-efficient reward distribution.
///         Stakers earn 50% of platform fees deposited by the platform admin via depositRewards().
///         Minimum stake to mark an agent "Verified": 1000 TASK (configurable by admin).
contract TaskStaking {
    IERC20Token public immutable taskToken;
    address public admin;

    uint256 public constant LOCK_PERIOD = 7 days;
    uint256 public minStakeVerified = 1_000 * 10 ** 18; // 1000 TASK

    struct StakeInfo {
        uint256 amount;
        uint256 lockedUntil;
    }

    uint256 public totalStaked;
    uint256 public rewardPerTokenStored; // scaled by 1e18

    mapping(address => StakeInfo) public stakes;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public pendingRewards;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardDeposited(uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event MinStakeUpdated(uint256 newMin);

    error LockupNotExpired(uint256 unlocksAt);
    error InsufficientStake(uint256 available, uint256 requested);
    error NotAdmin();
    error ZeroAmount();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor(address _taskToken) {
        taskToken = IERC20Token(_taskToken);
        admin = msg.sender;
    }

    // ── Staking ───────────────────────────────────────────────────────────────

    /// @notice Stake TASK tokens. Resets lockup to now + 7 days on each stake.
    function stake(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        _updateReward(msg.sender);

        taskToken.transferFrom(msg.sender, address(this), amount);

        StakeInfo storage s = stakes[msg.sender];
        s.amount += amount;
        s.lockedUntil = block.timestamp + LOCK_PERIOD;
        totalStaked += amount;

        emit Staked(msg.sender, amount);
    }

    /// @notice Unstake TASK tokens. Reverts if still within lockup period.
    function unstake(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        _updateReward(msg.sender);

        StakeInfo storage s = stakes[msg.sender];
        if (block.timestamp < s.lockedUntil) revert LockupNotExpired(s.lockedUntil);
        if (s.amount < amount) revert InsufficientStake(s.amount, amount);

        s.amount -= amount;
        totalStaked -= amount;
        taskToken.transfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    /// @notice Returns how much TASK `user` has staked.
    function getStake(address user) external view returns (uint256) {
        return stakes[user].amount;
    }

    /// @notice Returns whether `user` meets the minimum stake to list a Verified Agent.
    function isVerifiedStaker(address user) external view returns (bool) {
        return stakes[user].amount >= minStakeVerified;
    }

    /// @notice Admin: update the minimum stake threshold for Verified Agent status.
    function setMinStake(uint256 amount) external onlyAdmin {
        minStakeVerified = amount;
        emit MinStakeUpdated(amount);
    }

    // ── Rewards ───────────────────────────────────────────────────────────────

    /// @notice Platform deposits 50% of treasury fees as TASK rewards for stakers.
    ///         If nobody is staking the rewards stay in the contract for later.
    function depositRewards(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        taskToken.transferFrom(msg.sender, address(this), amount);

        if (totalStaked > 0) {
            rewardPerTokenStored += (amount * 1e18) / totalStaked;
        }
        emit RewardDeposited(amount);
    }

    /// @notice View how much TASK `account` has earned and not yet claimed.
    function earned(address account) public view returns (uint256) {
        uint256 rpt = rewardPerTokenStored;
        return
            (stakes[account].amount * (rpt - userRewardPerTokenPaid[account])) /
            1e18 +
            pendingRewards[account];
    }

    /// @notice Claim all accrued TASK rewards.
    function claimRewards() external {
        _updateReward(msg.sender);
        uint256 reward = pendingRewards[msg.sender];
        if (reward > 0) {
            pendingRewards[msg.sender] = 0;
            taskToken.transfer(msg.sender, reward);
            emit RewardClaimed(msg.sender, reward);
        }
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    function _updateReward(address account) internal {
        pendingRewards[account] = earned(account);
        userRewardPerTokenPaid[account] = rewardPerTokenStored;
    }
}

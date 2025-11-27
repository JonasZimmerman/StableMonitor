// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title StableMonitor - Encrypted Stablecoin Monitoring System
/// @notice A contract for managing encrypted stablecoin issuance, transfers, and risk monitoring
/// @dev All balances and amounts are encrypted using FHEVM technology
contract StableMonitor is ZamaEthereumConfig {
    // Mapping from user address to encrypted balance
    mapping(address => euint32) private _balances;
    
    // Encrypted total supply
    euint32 private _totalSupply;
    
    // Issuer address (who can mint new tokens)
    address private _issuer;
    
    // Risk threshold for monitoring (encrypted)
    euint32 private _riskThreshold;
    
    // Events
    event Issuance(address indexed user, bytes32 handle);
    event Transfer(address indexed from, address indexed to, bytes32 handle);
    event RiskCheck(address indexed user, bytes32 riskFlagHandle);
    
    /// @notice Constructor sets the issuer and initial risk threshold
    /// @param issuer The address that can issue new stablecoins
    /// @param initialRiskThreshold The initial encrypted risk threshold value
    /// @param initialRiskThresholdProof The proof for the initial risk threshold
    constructor(
        address issuer,
        externalEuint32 initialRiskThreshold,
        bytes memory initialRiskThresholdProof
    ) {
        _issuer = issuer;
        if (block.chainid == 31337) {
            // Local dev chain: initialize to encrypted zero without proof
            _riskThreshold = FHE.asEuint32(0);
        } else if (block.chainid == 11155111 && initialRiskThresholdProof.length == 0) {
            // Sepolia testnet: allow initializing to encrypted zero if no proof is provided
            _riskThreshold = FHE.asEuint32(0);
        } else {
            // Public/test networks: require valid encrypted input with proof
            _riskThreshold = FHE.fromExternal(initialRiskThreshold, initialRiskThresholdProof);
        }
        FHE.allowThis(_riskThreshold);
    }
    
    /// @notice Issue new stablecoins to a user
    /// @param user The address to issue tokens to
    /// @param amount The encrypted amount to issue
    /// @param amountProof The proof for the encrypted amount
    /// @dev Only the issuer can call this function
    function issue(
        address user,
        externalEuint32 amount,
        bytes calldata amountProof
    ) external {
        require(msg.sender == _issuer, "Only issuer can issue tokens");
        require(user != address(0), "Cannot issue to zero address");
        
        euint32 encryptedAmount = FHE.fromExternal(amount, amountProof);
        
        // Update user balance
        _balances[user] = FHE.add(_balances[user], encryptedAmount);
        
        // Update total supply
        _totalSupply = FHE.add(_totalSupply, encryptedAmount);
        
        // Grant ACL permissions
        FHE.allowThis(_balances[user]);
        FHE.allow(_balances[user], user);
        FHE.allowThis(_totalSupply);
        
        emit Issuance(user, FHE.toBytes32(_balances[user]));
    }
    
    /// @notice Transfer encrypted stablecoins from sender to recipient
    /// @param to The address to transfer to
    /// @param amount The encrypted amount to transfer
    /// @param amountProof The proof for the encrypted amount
    /// @dev Note: Balance validation should be done off-chain before calling this function
    /// The contract performs the transfer assuming the caller has verified sufficient balance
    function transfer(
        address to,
        externalEuint32 amount,
        bytes calldata amountProof
    ) external {
        require(to != address(0), "Cannot transfer to zero address");
        require(to != msg.sender, "Cannot transfer to self");
        
        euint32 encryptedAmount = FHE.fromExternal(amount, amountProof);
        
        // Update sender balance (subtract)
        _balances[msg.sender] = FHE.sub(_balances[msg.sender], encryptedAmount);
        
        // Update recipient balance (add)
        _balances[to] = FHE.add(_balances[to], encryptedAmount);
        
        // Grant ACL permissions
        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);
        FHE.allowThis(_balances[to]);
        FHE.allow(_balances[to], to);
        
        emit Transfer(msg.sender, to, FHE.toBytes32(encryptedAmount));
    }
    
    /// @notice Check if a user has sufficient balance for a transfer
    /// @param user The address to check
    /// @param amount The encrypted amount to check
    /// @param amountProof The proof for the encrypted amount
    /// @return An encrypted boolean indicating if balance is sufficient
    /// @dev This function returns an encrypted boolean that can be decrypted off-chain
    function hasSufficientBalance(
        address user,
        externalEuint32 amount,
        bytes calldata amountProof
    ) external returns (ebool) {
        euint32 encryptedAmount = FHE.fromExternal(amount, amountProof);
        return FHE.le(encryptedAmount, _balances[user]);
    }
    
    /// @notice Get the encrypted balance of a user
    /// @param user The address to query
    /// @return The encrypted balance
    function getBalance(address user) external view returns (euint32) {
        return _balances[user];
    }
    
    /// @notice Get the encrypted total supply
    /// @return The encrypted total supply
    function getTotalSupply() external view returns (euint32) {
        return _totalSupply;
    }
    
    /// @notice Get the encrypted risk threshold
    /// @return The encrypted risk threshold
    function getRiskThreshold() external view returns (euint32) {
        return _riskThreshold;
    }

    /// @notice Grant caller the permission to decrypt current risk threshold and return its handle
    /// @dev This function updates ACL; thus, it's non-view. Anyone calling it will be able to decrypt the threshold.
    ///      If you want to restrict who can decrypt, gate this function with issuer check.
    function getRiskThresholdForCaller() external returns (euint32) {
        FHE.allowThis(_riskThreshold);
        FHE.allow(_riskThreshold, msg.sender);
        return _riskThreshold;
    }
    
    /// @notice Perform risk check on a user's balance
    /// @param user The address to check
    /// @return The encrypted risk flag (true if balance exceeds threshold)
    function checkRisk(address user) external returns (ebool) {
        ebool risk = FHE.gt(_balances[user], _riskThreshold);
        // Grant ACL permissions for the caller to decrypt the result
        FHE.allowThis(risk);
        FHE.allow(risk, msg.sender);
        return risk;
    }
    
    /// @notice Perform risk check on total supply
    /// @return The encrypted risk flag (true if total supply exceeds threshold)
    function checkTotalSupplyRisk() external returns (ebool) {
        ebool risk = FHE.gt(_totalSupply, _riskThreshold);
        // Grant ACL permissions for the caller to decrypt the result
        FHE.allowThis(risk);
        FHE.allow(risk, msg.sender);
        return risk;
    }
    
    /// @notice Perform risk check and emit event
    /// @param user The address to check
    /// @dev This function performs the risk check and emits an event with the encrypted result
    function performRiskCheck(address user) external {
        ebool risk = FHE.gt(_balances[user], _riskThreshold);
        // Grant ACL permissions for the caller to decrypt the result
        FHE.allowThis(risk);
        FHE.allow(risk, msg.sender);
        emit RiskCheck(user, FHE.toBytes32(risk));
    }
    
    /// @notice Update risk threshold
    /// @param newThreshold The new encrypted risk threshold
    /// @param newThresholdProof The proof for the new threshold
    /// @dev Only issuer can update threshold
    function updateRiskThreshold(
        externalEuint32 newThreshold,
        bytes calldata newThresholdProof
    ) external {
        require(msg.sender == _issuer, "Only issuer can update threshold");
        _riskThreshold = FHE.fromExternal(newThreshold, newThresholdProof);
        FHE.allowThis(_riskThreshold);
    }
    
    /// @notice Get the issuer address
    /// @return The issuer address
    function getIssuer() external view returns (address) {
        return _issuer;
    }
}


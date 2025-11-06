"use client";

import { useFhevm } from "../fhevm/useFhevm";
import { useInMemoryStorage } from "../hooks/useInMemoryStorage";
import { useMetaMaskEthersSigner } from "../hooks/metamask/useMetaMaskEthersSigner";
import { useStableMonitor } from "@/hooks/useStableMonitor";
import { useState } from "react";

type TabType = 'wallet' | 'issuer' | 'monitoring';

function InfoRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className="info-value">{String(value)}</span>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  subtitle: string;
}

function TabButton({ active, onClick, icon, title, subtitle }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '20px',
        backgroundColor: active ? '#8B4513' : '#FAFAFA',
        color: active ? 'white' : '#2C1810',
        border: `2px solid ${active ? '#8B4513' : '#D4A574'}`,
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'all 0.3s',
        textAlign: 'left',
        minWidth: '200px'
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = '#F5F5F5';
          e.currentTarget.style.borderColor = '#8B4513';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = '#FAFAFA';
          e.currentTarget.style.borderColor = '#D4A574';
        }
      }}
    >
      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '4px' }}>
        {title}
      </div>
      <div style={{ 
        fontSize: '0.85rem', 
        opacity: active ? 0.9 : 0.7,
        color: active ? 'white' : '#666'
      }}>
        {subtitle}
      </div>
    </button>
  );
}

export const StableMonitorDemo = () => {
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();
  const {
    provider,
    chainId,
    accounts,
    isConnected,
    connect,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
    initialMockChains,
  } = useMetaMaskEthersSigner();

  const {
    instance: fhevmInstance,
    status: fhevmStatus,
    error: fhevmError,
  } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true,
  });

  const stableMonitor = useStableMonitor({
    instance: fhevmInstance,
    fhevmDecryptionSignatureStorage,
    eip1193Provider: provider,
    chainId,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
    userAddress: accounts?.[0],
  });

  const [activeTab, setActiveTab] = useState<TabType>('wallet');
  const [issueTo, setIssueTo] = useState("");
  const [issueAmount, setIssueAmount] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [riskCheckUser, setRiskCheckUser] = useState("");
  const [newThreshold, setNewThreshold] = useState("");

  if (!isConnected) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: '400px',
        gap: '20px'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          backgroundColor: '#8B4513',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '40px',
          fontWeight: '700'
        }}>
          🔒
        </div>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          color: '#2C1810',
          marginBottom: '8px'
        }}>
          Connect Your Wallet
        </h2>
        <p style={{
          fontSize: '1rem',
          color: '#666',
          marginBottom: '20px',
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          Please connect your MetaMask wallet to access the Stable Monitor platform
        </p>
        <button
          className="btn-primary"
          style={{ padding: '16px 48px', fontSize: '1.1rem' }}
          onClick={connect}
        >
          Connect to MetaMask
        </button>
      </div>
    );
  }

  // Only show deployment error when chainId is known and contract is not deployed
  if (chainId !== undefined && stableMonitor.isDeployed === false) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: '400px',
        gap: '20px'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          backgroundColor: '#8B0000',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '40px',
          fontWeight: '700'
        }}>
          ⚠️
        </div>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          color: '#8B0000'
        }}>
          Contract Not Deployed
        </h2>
        <p style={{
          fontSize: '1rem',
          color: '#666',
          textAlign: 'center',
          maxWidth: '500px'
        }}>
          The StableMonitor contract is not deployed on the current network (Chain ID: {chainId}). Please switch to a supported network or deploy the contract first.
        </p>
      </div>
    );
  }

  // Wallet View
  const renderWalletView = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Connection Info */}
      <div className="card-container">
        <h3 className="card-header">📡 Connection Information</h3>
        <InfoRow label="Network Chain ID" value={chainId || 'Not connected'} />
        <InfoRow label="Your Wallet Address" value={accounts?.[0] ? `${accounts[0].slice(0, 10)}...${accounts[0].slice(-8)}` : 'Not available'} />
        <InfoRow label="Contract Address" value={stableMonitor.contractAddress ? `${stableMonitor.contractAddress.slice(0, 10)}...${stableMonitor.contractAddress.slice(-8)}` : 'Not deployed'} />
      </div>

      {/* Status Grid */}
      <div className="grid-2">
        <div className="card-container">
          <h3 className="card-header">🔐 FHEVM Encryption Status</h3>
          <InfoRow label="Instance" value={fhevmInstance ? '✓ Ready' : '✗ Not initialized'} />
          <InfoRow label="Status" value={fhevmStatus} />
          {fhevmError && (
            <div style={{ 
              marginTop: '12px', 
              padding: '12px', 
              backgroundColor: '#FEE', 
              borderRadius: '6px',
              border: '1px solid #FCC'
            }}>
              <p style={{ color: '#C00', fontSize: '0.85rem', fontWeight: '600' }}>
                Error: {fhevmError.message}
              </p>
            </div>
          )}
        </div>

        <div className="card-container">
          <h3 className="card-header">⚡ Operation Status</h3>
          <InfoRow label="Refreshing Balance" value={stableMonitor.isRefreshing ? '🔄 In Progress' : '✓ Idle'} />
          <InfoRow label="Decrypting Data" value={stableMonitor.isDecrypting ? '🔄 In Progress' : '✓ Idle'} />
          <InfoRow label="Issuing Tokens" value={stableMonitor.isIssuing ? '🔄 In Progress' : '✓ Idle'} />
          <InfoRow label="Transferring" value={stableMonitor.isTransferring ? '🔄 In Progress' : '✓ Idle'} />
        </div>
      </div>

      {/* Balance Section */}
      <div className="card-container">
        <h3 className="card-header">💰 Your Token Balance</h3>
        <InfoRow 
          label="Encrypted Balance Handle" 
          value={stableMonitor.handle ? `${stableMonitor.handle.slice(0, 20)}...` : 'Not yet loaded'} 
        />
        <InfoRow 
          label="Decrypted Balance" 
          value={stableMonitor.clear !== undefined ? `${stableMonitor.clear} tokens` : 'Click "Decrypt" to view'} 
        />
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
          <button
            className="btn-primary"
            disabled={!stableMonitor.canGetBalance}
            onClick={stableMonitor.refreshBalance}
          >
            🔄 Refresh Balance
          </button>
          <button
            className="btn-danger"
            disabled={!stableMonitor.canDecrypt}
            onClick={stableMonitor.decryptBalance}
          >
            🔓 Decrypt Balance
          </button>
        </div>
      </div>

      {/* Transfer Section */}
      <div className="card-container">
        <h3 className="card-header">💸 Transfer Tokens</h3>
        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '16px' }}>
          Send encrypted tokens from your wallet to another address securely.
        </p>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px' }}>
            <label className="input-label">Recipient Wallet Address</label>
            <input
              type="text"
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
              className="input-field"
              placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
            />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label className="input-label">Token Amount</label>
            <input
              type="number"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              className="input-field"
              placeholder="e.g., 50"
              min="0"
            />
          </div>
        </div>
        <button
          className="btn-primary"
          disabled={!stableMonitor.canTransfer || !transferTo || !transferAmount}
          onClick={() => {
            stableMonitor.transfer(transferTo, parseInt(transferAmount));
            setTransferTo("");
            setTransferAmount("");
          }}
        >
          ➤ Send Transfer
        </button>
      </div>
    </div>
  );

  // Issuer View
  const renderIssuerView = () => {
    const isIssuer = stableMonitor.isIssuer ?? false;
    
    return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Issuer Info Banner */}
      <div style={{
        backgroundColor: '#8B0000',
        borderRadius: '12px',
        padding: '20px',
        color: 'white'
      }}>
        <h3 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '8px' }}>
          🏦 Issuer Control Panel
        </h3>
        <p style={{ fontSize: '0.9rem', opacity: 0.9 }}>
          Administrative functions for token issuance and risk management configuration.
        </p>
      </div>

      {/* Warning if not issuer */}
      {!isIssuer && (
        <div style={{
          backgroundColor: '#FFF9E6',
          border: '2px solid #F0C674',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            marginBottom: '12px'
          }}>
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <h4 style={{ 
              fontSize: '1.1rem', 
              fontWeight: '700', 
              color: '#8B0000',
              margin: 0
            }}>
              Access Restricted
            </h4>
          </div>
          <p style={{ 
            fontSize: '0.95rem', 
            color: '#2C1810',
            margin: 0,
            lineHeight: '1.5'
          }}>
            You are not authorized to use issuer functions. Only the contract issuer ({stableMonitor.issuerAddress ? `${stableMonitor.issuerAddress.slice(0, 10)}...${stableMonitor.issuerAddress.slice(-8)}` : 'Unknown'}) can issue tokens and configure risk thresholds.
          </p>
        </div>
      )}

      {/* Operation Status */}
      <div className="card-container">
        <h3 className="card-header">⚡ Operation Status</h3>
        <InfoRow label="Issuing Tokens" value={stableMonitor.isIssuing ? '🔄 In Progress' : '✓ Idle'} />
        <InfoRow label="Updating Threshold" value={stableMonitor.isUpdatingThreshold ? '🔄 In Progress' : '✓ Idle'} />
        <InfoRow label="Decrypting Data" value={stableMonitor.isDecrypting ? '🔄 In Progress' : '✓ Idle'} />
      </div>

      {/* Issue Tokens Section */}
      <div className="card-container">
        <h3 className="card-header">🏦 Issue New Tokens</h3>
        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '16px' }}>
          Create and distribute new stablecoin tokens to a recipient address. Only authorized issuers can perform this action.
        </p>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px' }}>
            <label className="input-label">Recipient Wallet Address</label>
            <input
              type="text"
              value={issueTo}
              onChange={(e) => setIssueTo(e.target.value)}
              className="input-field"
              placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
              disabled={!isIssuer}
            />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label className="input-label">Token Amount</label>
            <input
              type="number"
              value={issueAmount}
              onChange={(e) => setIssueAmount(e.target.value)}
              className="input-field"
              placeholder="e.g., 100"
              min="0"
              disabled={!isIssuer}
            />
          </div>
        </div>
        <button
          className="btn-primary"
          disabled={!isIssuer || !stableMonitor.canIssue || !issueTo || !issueAmount}
          onClick={() => {
            stableMonitor.issue(issueTo, parseInt(issueAmount));
            setIssueTo("");
            setIssueAmount("");
          }}
        >
          ✓ Issue Tokens
        </button>
      </div>

      {/* Risk Threshold Section */}
      <div className="card-container">
        <h3 className="card-header">⚙️ Risk Threshold Configuration</h3>
        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '16px' }}>
          Set the risk monitoring threshold for user balances. Balances exceeding this threshold will be flagged for review.
        </p>
        <InfoRow 
          label="Threshold Handle" 
          value={stableMonitor.riskThresholdHandle ? `${stableMonitor.riskThresholdHandle.slice(0, 20)}...` : 'Not loaded'} 
        />
        <InfoRow 
          label="Current Threshold" 
          value={stableMonitor.clearRiskThreshold !== undefined ? `${stableMonitor.clearRiskThreshold} tokens` : 'Click "Decrypt" to view'} 
        />
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label className="input-label">New Threshold Value</label>
            <input
              type="number"
              value={newThreshold}
              onChange={(e) => setNewThreshold(e.target.value)}
              className="input-field"
              placeholder="e.g., 1000"
              min="0"
              disabled={!isIssuer}
            />
          </div>
          <button
            className="btn-primary"
            disabled={!isIssuer || !stableMonitor.canUpdateThreshold || !newThreshold}
            onClick={() => {
              stableMonitor.updateRiskThreshold(parseInt(newThreshold));
              setNewThreshold("");
            }}
          >
            Update Threshold
          </button>
          <button
            className="btn-danger"
            disabled={!isIssuer || stableMonitor.isDecrypting}
            onClick={() => {
              stableMonitor.decryptRiskThreshold();
            }}
          >
            🔓 Decrypt Threshold
          </button>
        </div>
      </div>
    </div>
    );
  };

  // Monitoring View
  const renderMonitoringView = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Monitoring Info Banner */}
      <div style={{
        backgroundColor: '#8B4513',
        borderRadius: '12px',
        padding: '20px',
        color: 'white'
      }}>
        <h3 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '8px' }}>
          🔍 Risk Monitoring Dashboard
        </h3>
        <p style={{ fontSize: '0.9rem', opacity: 0.9 }}>
          Analyze user balances and identify potential risks in the stablecoin system.
        </p>
      </div>

      {/* Operation Status */}
      <div className="card-container">
        <h3 className="card-header">⚡ Monitoring Status</h3>
        <InfoRow label="Risk Check" value={stableMonitor.isCheckingRisk ? '🔄 In Progress' : '✓ Idle'} />
        <InfoRow label="Decrypting Data" value={stableMonitor.isDecrypting ? '🔄 In Progress' : '✓ Idle'} />
      </div>

      {/* Risk Monitoring Section */}
      <div className="card-container">
        <h3 className="card-header">🔍 Risk Monitoring & Analysis</h3>
        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '16px' }}>
          Check if a user&apos;s encrypted balance exceeds the configured risk threshold. This helps identify potential risks in the system.
        </p>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 300px' }}>
            <label className="input-label">User Address to Check</label>
            <input
              type="text"
              value={riskCheckUser}
              onChange={(e) => setRiskCheckUser(e.target.value)}
              className="input-field"
              placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
            />
          </div>
          <button
            className="btn-primary"
            disabled={!riskCheckUser || stableMonitor.isCheckingRisk}
            onClick={() => {
              stableMonitor.checkRisk(riskCheckUser);
            }}
          >
            {stableMonitor.isCheckingRisk ? '🔄 Checking...' : '🔍 Perform Risk Check'}
          </button>
        </div>
        {stableMonitor.clearRiskFlag !== undefined && (
          <div style={{ marginTop: '16px' }}>
            {stableMonitor.clearRiskFlag ? (
              <div className="status-badge status-risk">
                ⚠️ RISK DETECTED - Balance exceeds threshold
              </div>
            ) : (
              <div className="status-badge status-safe">
                ✓ SAFE - Balance within acceptable limits
              </div>
            )}
          </div>
        )}
      </div>

      {/* Additional Info */}
      <div className="card-container">
        <h3 className="card-header">ℹ️ Risk Assessment Information</h3>
        <p style={{ color: '#666', fontSize: '0.9rem', lineHeight: '1.6' }}>
          The risk monitoring system uses fully homomorphic encryption (FHE) to check user balances against the configured threshold without revealing the actual balance amounts. This ensures privacy while maintaining regulatory compliance.
        </p>
        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#FFF9E6', borderRadius: '8px', border: '1px solid #F0C674' }}>
          <p style={{ fontSize: '0.85rem', color: '#2C1810' }}>
            <strong>Note:</strong> Risk assessments are performed on encrypted data. The system will only indicate whether a balance exceeds the threshold, without exposing specific amounts.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '16px', 
        flexWrap: 'wrap',
        padding: '24px',
        backgroundColor: '#FAFAFA',
        borderRadius: '12px',
        border: '2px solid #D4A574'
      }}>
        <TabButton
          active={activeTab === 'wallet'}
          onClick={() => setActiveTab('wallet')}
          icon="💰"
          title="My Wallet"
          subtitle="View balance and transfer tokens"
        />
        <TabButton
          active={activeTab === 'issuer'}
          onClick={() => setActiveTab('issuer')}
          icon="🏦"
          title="Issuer Panel"
          subtitle="Issue tokens and configure thresholds"
        />
        <TabButton
          active={activeTab === 'monitoring'}
          onClick={() => setActiveTab('monitoring')}
          icon="🔍"
          title="Risk Monitoring"
          subtitle="Analyze and assess user balances"
        />
      </div>

      {/* Content Area */}
      <div>
        {activeTab === 'wallet' && renderWalletView()}
        {activeTab === 'issuer' && renderIssuerView()}
        {activeTab === 'monitoring' && renderMonitoringView()}
      </div>

      {/* Message Box - Show on all tabs */}
      {stableMonitor.message && (
        <div className="message-box">
          <div className="message-title">System Message</div>
          <p style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>
            {stableMonitor.message}
          </p>
        </div>
      )}
    </div>
  );
};


"use client";

import { ethers } from "ethers";
import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { FhevmInstance } from "@/fhevm/fhevmTypes";
import { FhevmDecryptionSignature } from "@/fhevm/FhevmDecryptionSignature";
import { GenericStringStorage } from "@/fhevm/GenericStringStorage";

import { StableMonitorAddresses } from "@/abi/StableMonitorAddresses";
import { StableMonitorABI } from "@/abi/StableMonitorABI";

export type ClearValueType = {
  handle: string;
  clear: string | bigint | boolean;
};

type StableMonitorInfoType = {
  abi: typeof StableMonitorABI.abi;
  address?: `0x${string}`;
  chainId?: number;
  chainName?: string;
};

function getStableMonitorByChainId(
  chainId: number | undefined
): StableMonitorInfoType {
  if (!chainId) {
    return { abi: StableMonitorABI.abi };
  }

  const entry =
    StableMonitorAddresses[chainId.toString() as keyof typeof StableMonitorAddresses];

  if (!entry || !("address" in entry) || entry.address === ethers.ZeroAddress) {
    return { abi: StableMonitorABI.abi, chainId };
  }

  return {
    address: entry?.address as `0x${string}` | undefined,
    chainId: entry?.chainId ?? chainId,
    chainName: entry?.chainName,
    abi: StableMonitorABI.abi,
  };
}

export const useStableMonitor = (parameters: {
  instance: FhevmInstance | undefined;
  fhevmDecryptionSignatureStorage: GenericStringStorage;
  eip1193Provider: ethers.Eip1193Provider | undefined;
  chainId: number | undefined;
  ethersSigner: ethers.JsonRpcSigner | undefined;
  ethersReadonlyProvider: ethers.ContractRunner | undefined;
  sameChain: RefObject<(chainId: number | undefined) => boolean>;
  sameSigner: RefObject<
    (ethersSigner: ethers.JsonRpcSigner | undefined) => boolean
  >;
  userAddress: string | undefined;
}) => {
  const {
    instance,
    fhevmDecryptionSignatureStorage,
    chainId,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
    userAddress,
  } = parameters;

  const [balanceHandle, setBalanceHandle] = useState<string | undefined>(undefined);
  const [clearBalance, setClearBalance] = useState<ClearValueType | undefined>(undefined);
  const [totalSupplyHandle, setTotalSupplyHandle] = useState<string | undefined>(undefined);
  const [clearTotalSupply, setClearTotalSupply] = useState<ClearValueType | undefined>(undefined);
  const [riskThresholdHandle, setRiskThresholdHandle] = useState<string | undefined>(undefined);
  const [clearRiskThreshold, setClearRiskThreshold] = useState<ClearValueType | undefined>(undefined);
  const [riskFlagHandle, setRiskFlagHandle] = useState<string | undefined>(undefined);
  const [clearRiskFlag, setClearRiskFlag] = useState<ClearValueType | undefined>(undefined);
  
  const clearBalanceRef = useRef<ClearValueType>(undefined);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [isIssuing, setIsIssuing] = useState<boolean>(false);
  const [isTransferring, setIsTransferring] = useState<boolean>(false);
  const [isCheckingRisk, setIsCheckingRisk] = useState<boolean>(false);
  const [isUpdatingThreshold, setIsUpdatingThreshold] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [issuerAddress, setIssuerAddress] = useState<string | undefined>(undefined);

  const stableMonitorRef = useRef<StableMonitorInfoType | undefined>(undefined);
  const isRefreshingRef = useRef<boolean>(isRefreshing);
  const isDecryptingRef = useRef<boolean>(isDecrypting);
  const isIssuingRef = useRef<boolean>(isIssuing);
  const isTransferringRef = useRef<boolean>(isTransferring);
  const isCheckingRiskRef = useRef<boolean>(isCheckingRisk);
  const isUpdatingThresholdRef = useRef<boolean>(isUpdatingThreshold);

  const isBalanceDecrypted = balanceHandle && balanceHandle === clearBalance?.handle;

  const stableMonitor = useMemo(() => {
    const c = getStableMonitorByChainId(chainId);
    stableMonitorRef.current = c;
    // Only show message when chainId is known and address is not configured
    if (c.chainId !== undefined && !c.address) {
      setMessage(`StableMonitor deployment not found for chainId=${c.chainId}.`);
    } else {
      // Clear message when chainId is undefined or address is available
      setMessage("");
    }
    return c;
  }, [chainId]);

  const isDeployed = useMemo(() => {
    if (!stableMonitor) {
      return undefined;
    }
    return (Boolean(stableMonitor.address) && stableMonitor.address !== ethers.ZeroAddress);
  }, [stableMonitor]);

  // Fetch issuer address from contract
  useEffect(() => {
    if (!stableMonitor.address || !ethersReadonlyProvider) {
      setIssuerAddress(undefined);
      return;
    }

    const contract = new ethers.Contract(
      stableMonitor.address,
      stableMonitor.abi,
      ethersReadonlyProvider
    );

    contract
      .getIssuer()
      .then((issuer: string) => {
        if (sameChain.current(stableMonitor.chainId)) {
          setIssuerAddress(issuer);
        }
      })
      .catch(() => {
        setIssuerAddress(undefined);
      });
  }, [stableMonitor.address, stableMonitor.abi, stableMonitor.chainId, ethersReadonlyProvider, sameChain]);

  // Check if current user is the issuer
  const isIssuer = useMemo(() => {
    if (!userAddress || !issuerAddress) {
      return false;
    }
    return userAddress.toLowerCase() === issuerAddress.toLowerCase();
  }, [userAddress, issuerAddress]);

  const canGetBalance = useMemo(() => {
    return stableMonitor.address && ethersReadonlyProvider && !isRefreshing && userAddress;
  }, [stableMonitor.address, ethersReadonlyProvider, isRefreshing, userAddress]);

  const refreshBalance = useCallback(() => {
    if (isRefreshingRef.current || !userAddress) {
      return;
    }

    if (
      !stableMonitorRef.current ||
      !stableMonitorRef.current?.chainId ||
      !stableMonitorRef.current?.address ||
      !ethersReadonlyProvider
    ) {
      setBalanceHandle(undefined);
      return;
    }

    isRefreshingRef.current = true;
    setIsRefreshing(true);

    const thisChainId = stableMonitorRef.current.chainId;
    const thisContractAddress = stableMonitorRef.current.address;

    const contract = new ethers.Contract(
      thisContractAddress,
      stableMonitorRef.current.abi,
      ethersReadonlyProvider
    );

    Promise.all([
      contract.getBalance(userAddress),
      contract.getTotalSupply(),
      contract.getRiskThreshold(),
    ])
      .then(([balance, totalSupply, riskThreshold]) => {
        if (
          sameChain.current(thisChainId) &&
          thisContractAddress === stableMonitorRef.current?.address
        ) {
          // Convert handles to string format (bytes32 -> hex string)
          const balanceHandleStr = typeof balance === 'string' ? balance : ethers.hexlify(balance);
          const totalSupplyHandleStr = typeof totalSupply === 'string' ? totalSupply : ethers.hexlify(totalSupply);
          const riskThresholdHandleStr = typeof riskThreshold === 'string' ? riskThreshold : ethers.hexlify(riskThreshold);
          
          setBalanceHandle(balanceHandleStr);
          setTotalSupplyHandle(totalSupplyHandleStr);
          setRiskThresholdHandle(riskThresholdHandleStr);
        }
        isRefreshingRef.current = false;
        setIsRefreshing(false);
      })
      .catch((e) => {
        setMessage("Failed to fetch balance: " + e);
        isRefreshingRef.current = false;
        setIsRefreshing(false);
      });
  }, [ethersReadonlyProvider, sameChain, userAddress]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  const canDecrypt = useMemo(() => {
    return (
      stableMonitor.address &&
      instance &&
      ethersSigner &&
      !isRefreshing &&
      !isDecrypting &&
      balanceHandle &&
      balanceHandle !== ethers.ZeroHash &&
      balanceHandle !== clearBalance?.handle
    );
  }, [
    stableMonitor.address,
    instance,
    ethersSigner,
    isRefreshing,
    isDecrypting,
    balanceHandle,
    clearBalance,
  ]);

  const decryptBalance = useCallback(() => {
    if (isRefreshingRef.current || isDecryptingRef.current || !balanceHandle) {
      return;
    }

    if (!stableMonitor.address || !instance || !ethersSigner) {
      return;
    }

    if (balanceHandle === clearBalanceRef.current?.handle) {
      return;
    }

    if (balanceHandle === ethers.ZeroHash) {
      setClearBalance({ handle: balanceHandle, clear: BigInt(0) });
      clearBalanceRef.current = { handle: balanceHandle, clear: BigInt(0) };
      return;
    }

    const thisChainId = chainId;
    const thisContractAddress = stableMonitor.address;
    const thisBalanceHandle = balanceHandle;
    const thisEthersSigner = ethersSigner;

    isDecryptingRef.current = true;
    setIsDecrypting(true);
    setMessage("Start decrypting balance...");

    const run = async () => {
      const isStale = () =>
        thisContractAddress !== stableMonitorRef.current?.address ||
        !sameChain.current(thisChainId) ||
        !sameSigner.current(thisEthersSigner);

      try {
        const sig: FhevmDecryptionSignature | null =
          await FhevmDecryptionSignature.loadOrSign(
            instance,
            [stableMonitor.address as `0x${string}`],
            ethersSigner,
            fhevmDecryptionSignatureStorage
          );

        if (!sig) {
          setMessage("Unable to build FHEVM decryption signature");
          return;
        }

        if (isStale()) {
          setMessage("Ignore FHEVM decryption");
          return;
        }

        setMessage("Calling FHEVM userDecrypt...");

        const res = await instance.userDecrypt(
          [{ handle: thisBalanceHandle, contractAddress: thisContractAddress }],
          sig.privateKey,
          sig.publicKey,
          sig.signature,
          sig.contractAddresses,
          sig.userAddress,
          sig.startTimestamp,
          sig.durationDays
        );

        setMessage("FHEVM userDecrypt completed!");

        if (isStale()) {
          setMessage("Ignore FHEVM decryption");
          return;
        }

        // Get decrypted value and handle uint32 overflow (negative numbers)
        let decryptedValue = res[thisBalanceHandle];
        
        // If value is large (likely uint32 overflow from negative), convert to signed int32
        if (typeof decryptedValue === 'bigint' || typeof decryptedValue === 'number') {
          const numValue = typeof decryptedValue === 'bigint' ? Number(decryptedValue) : decryptedValue;
          // uint32 max is 4294967295, if value > 2147483647 (int32 max), treat as negative
          if (numValue > 2147483647 && numValue <= 4294967295) {
            decryptedValue = BigInt(numValue - 4294967296); // Convert to signed int32
          }
        }
        
        setClearBalance({ handle: thisBalanceHandle, clear: decryptedValue });
        clearBalanceRef.current = {
          handle: thisBalanceHandle,
          clear: decryptedValue,
        };

        setMessage("Balance decrypted: " + clearBalanceRef.current.clear);
      } finally {
        isDecryptingRef.current = false;
        setIsDecrypting(false);
      }
    };

    run();
  }, [
    fhevmDecryptionSignatureStorage,
    ethersSigner,
    stableMonitor.address,
    instance,
    balanceHandle,
    chainId,
    sameChain,
    sameSigner,
  ]);

  const decryptRiskThreshold = useCallback(() => {
    if (isRefreshingRef.current || isDecryptingRef.current || !riskThresholdHandle) {
      return;
    }

    if (!stableMonitor.address || !instance || !ethersSigner) {
      return;
    }

    const thisChainId = chainId;
    const thisContractAddress = stableMonitor.address;
    const thisEthersSigner = ethersSigner;

    isDecryptingRef.current = true;
    setIsDecrypting(true);
    setMessage("Start authorizing and decrypting risk threshold...");

    const run = async () => {
      const isStale = () =>
        thisContractAddress !== stableMonitorRef.current?.address ||
        !sameChain.current(thisChainId) ||
        !sameSigner.current(thisEthersSigner);

      try {
        const contract = new ethers.Contract(
          thisContractAddress,
          stableMonitor.abi,
          thisEthersSigner
        );

        // Grant ACL to caller to decrypt threshold
        const tx: ethers.TransactionResponse = await contract.getRiskThresholdForCaller();
        await tx.wait();

        if (isStale()) {
          setMessage("Ignore threshold decrypt");
          return;
        }

        // Fetch current handle
        const handleRaw = await contract.getRiskThreshold();
        const handle = typeof handleRaw === 'string' ? handleRaw : ethers.hexlify(handleRaw);

        const sig: FhevmDecryptionSignature | null =
          await FhevmDecryptionSignature.loadOrSign(
            instance,
            [thisContractAddress as `0x${string}`],
            thisEthersSigner,
            fhevmDecryptionSignatureStorage
          );

        if (!sig) {
          setMessage("Unable to build FHEVM decryption signature for threshold");
          return;
        }

        if (isStale()) {
          setMessage("Ignore threshold decrypt");
          return;
        }

        const res = await instance.userDecrypt(
          [{ handle, contractAddress: thisContractAddress }],
          sig.privateKey,
          sig.publicKey,
          sig.signature,
          sig.contractAddresses,
          sig.userAddress,
          sig.startTimestamp,
          sig.durationDays
        );

        setClearRiskThreshold({ handle, clear: res[handle] });
        setMessage("Risk threshold decrypted");
      } catch (e: any) {
        setMessage(`Decrypt risk threshold failed: ${e.message || e}`);
      } finally {
        isDecryptingRef.current = false;
        setIsDecrypting(false);
      }
    };

    run();
  }, [
    fhevmDecryptionSignatureStorage,
    ethersSigner,
    stableMonitor.address,
    stableMonitor.abi,
    instance,
    chainId,
    sameChain,
    sameSigner,
    riskThresholdHandle,
  ]);

  const canIssue = useMemo(() => {
    return (
      stableMonitor.address &&
      instance &&
      ethersSigner &&
      !isRefreshing &&
      !isIssuing
    );
  }, [stableMonitor.address, instance, ethersSigner, isRefreshing, isIssuing]);

  const issue = useCallback(
    (to: string, amount: number) => {
      if (isRefreshingRef.current || isIssuingRef.current) {
        return;
      }

      if (!stableMonitor.address || !instance || !ethersSigner || amount <= 0) {
        return;
      }

      const thisChainId = chainId;
      const thisContractAddress = stableMonitor.address;
      const thisEthersSigner = ethersSigner;
      const contract = new ethers.Contract(
        thisContractAddress,
        stableMonitor.abi,
        thisEthersSigner
      );

      isIssuingRef.current = true;
      setIsIssuing(true);
      setMessage(`Issuing ${amount} tokens to ${to}...`);

      const run = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));

        const isStale = () =>
          thisContractAddress !== stableMonitorRef.current?.address ||
          !sameChain.current(thisChainId) ||
          !sameSigner.current(thisEthersSigner);

        try {
          const input = instance.createEncryptedInput(
            thisContractAddress,
            thisEthersSigner.address
          );
          input.add32(amount);

          const enc = await input.encrypt();

          if (isStale()) {
            setMessage("Ignore issue");
            return;
          }

          setMessage(`Calling issue...`);

          const tx: ethers.TransactionResponse = await contract.issue(
            to,
            enc.handles[0],
            enc.inputProof
          );

          setMessage(`Waiting for tx:${tx.hash}...`);

          const receipt = await tx.wait();

          setMessage(`Issue completed status=${receipt?.status}`);

          if (isStale()) {
            setMessage("Ignore issue");
            return;
          }

          refreshBalance();
        } catch (e: any) {
          setMessage(`Issue failed: ${e.message || e}`);
        } finally {
          isIssuingRef.current = false;
          setIsIssuing(false);
        }
      };

      run();
    },
    [
      ethersSigner,
      stableMonitor.address,
      stableMonitor.abi,
      instance,
      chainId,
      refreshBalance,
      sameChain,
      sameSigner,
    ]
  );

  const canTransfer = useMemo(() => {
    return (
      stableMonitor.address &&
      instance &&
      ethersSigner &&
      !isRefreshing &&
      !isTransferring
    );
  }, [stableMonitor.address, instance, ethersSigner, isRefreshing, isTransferring]);

  const transfer = useCallback(
    (to: string, amount: number) => {
      if (isRefreshingRef.current || isTransferringRef.current) {
        return;
      }

      if (!stableMonitor.address || !instance || !ethersSigner || amount <= 0) {
        return;
      }

      const thisChainId = chainId;
      const thisContractAddress = stableMonitor.address;
      const thisEthersSigner = ethersSigner;
      const contract = new ethers.Contract(
        thisContractAddress,
        stableMonitor.abi,
        thisEthersSigner
      );

      isTransferringRef.current = true;
      setIsTransferring(true);
      setMessage(`Transferring ${amount} tokens to ${to}...`);

      const run = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));

        const isStale = () =>
          thisContractAddress !== stableMonitorRef.current?.address ||
          !sameChain.current(thisChainId) ||
          !sameSigner.current(thisEthersSigner);

        try {
          const input = instance.createEncryptedInput(
            thisContractAddress,
            thisEthersSigner.address
          );
          input.add32(amount);

          const enc = await input.encrypt();

          if (isStale()) {
            setMessage("Ignore transfer");
            return;
          }

          setMessage(`Calling transfer...`);

          const tx: ethers.TransactionResponse = await contract.transfer(
            to,
            enc.handles[0],
            enc.inputProof
          );

          setMessage(`Waiting for tx:${tx.hash}...`);

          const receipt = await tx.wait();

          setMessage(`Transfer completed status=${receipt?.status}`);

          if (isStale()) {
            setMessage("Ignore transfer");
            return;
          }

          refreshBalance();
        } catch (e: any) {
          setMessage(`Transfer failed: ${e.message || e}`);
        } finally {
          isTransferringRef.current = false;
          setIsTransferring(false);
        }
      };

      run();
    },
    [
      ethersSigner,
      stableMonitor.address,
      stableMonitor.abi,
      instance,
      chainId,
      refreshBalance,
      sameChain,
      sameSigner,
    ]
  );

  const checkRisk = useCallback(
    (user: string) => {
      if (isCheckingRiskRef.current) {
        return;
      }

      if (!stableMonitor.address || !instance || !ethersSigner) {
        return;
      }

      const thisChainId = chainId;
      const thisContractAddress = stableMonitor.address;
      const thisEthersSigner = ethersSigner;
      const contract = new ethers.Contract(
        thisContractAddress,
        stableMonitor.abi,
        thisEthersSigner
      );

      isCheckingRiskRef.current = true;
      setIsCheckingRisk(true);
      setMessage(`Checking risk for ${user}...`);

      const run = async () => {
        try {
          // 1) Send tx to perform risk check and grant ACL for caller
          const tx: ethers.TransactionResponse = await contract.performRiskCheck(user);
          const receipt = await tx.wait();

          if (
            thisContractAddress !== stableMonitorRef.current?.address ||
            !sameChain.current(thisChainId) ||
            !sameSigner.current(thisEthersSigner)
          ) {
            setMessage("Ignore risk check");
            return;
          }

          if (!receipt) {
            setMessage("Transaction receipt is null");
            return;
          }

          // 2) Parse RiskCheck event to obtain handle
          let riskHandle: string | undefined = undefined;
          const iface = new ethers.Interface(stableMonitor.abi);
          for (const log of receipt.logs) {
            if (log.address?.toLowerCase() !== thisContractAddress.toLowerCase()) continue;
            try {
              const parsed = iface.parseLog({ topics: log.topics, data: log.data });
              if (parsed?.name === "RiskCheck") {
                const [, handle] = parsed.args as unknown as [string, string];
                riskHandle = typeof handle === "string" ? handle : ethers.hexlify(handle);
                break;
              }
            } catch (_) {
              // not our event, skip
            }
          }

          if (!riskHandle) {
            setMessage("Risk check transaction succeeded but event not found");
            return;
          }

          setRiskFlagHandle(riskHandle);

          // 3) Decrypt risk flag (caller has ACL from performRiskCheck)
          const sig: FhevmDecryptionSignature | null =
            await FhevmDecryptionSignature.loadOrSign(
              instance,
              [stableMonitor.address as `0x${string}`],
              ethersSigner,
              fhevmDecryptionSignatureStorage
            );

          if (sig) {
            const res = await instance.userDecrypt(
              [{ handle: riskHandle, contractAddress: thisContractAddress }],
              sig.privateKey,
              sig.publicKey,
              sig.signature,
              sig.contractAddresses,
              sig.userAddress,
              sig.startTimestamp,
              sig.durationDays
            );

            setClearRiskFlag({ handle: riskHandle, clear: res[riskHandle] });
            setMessage(`Risk check completed: ${res[riskHandle] ? "RISK DETECTED" : "SAFE"}`);
          }
        } catch (e: any) {
          setMessage(`Risk check failed: ${e.message || e}`);
        } finally {
          isCheckingRiskRef.current = false;
          setIsCheckingRisk(false);
        }
      };

      run();
    },
    [
      ethersSigner,
      stableMonitor.address,
      stableMonitor.abi,
      instance,
      chainId,
      sameChain,
      sameSigner,
      fhevmDecryptionSignatureStorage,
    ]
  );

  const canUpdateThreshold = useMemo(() => {
    return (
      stableMonitor.address &&
      instance &&
      ethersSigner &&
      !isRefreshing &&
      !isUpdatingThreshold
    );
  }, [stableMonitor.address, instance, ethersSigner, isRefreshing, isUpdatingThreshold]);

  const updateRiskThreshold = useCallback(
    (newThreshold: number) => {
      if (isRefreshingRef.current || isUpdatingThresholdRef.current) {
        return;
      }

      if (!stableMonitor.address || !instance || !ethersSigner || newThreshold < 0) {
        return;
      }

      const thisChainId = chainId;
      const thisContractAddress = stableMonitor.address;
      const thisEthersSigner = ethersSigner;
      const contract = new ethers.Contract(
        thisContractAddress,
        stableMonitor.abi,
        thisEthersSigner
      );

      isUpdatingThresholdRef.current = true;
      setIsUpdatingThreshold(true);
      setMessage(`Updating risk threshold to ${newThreshold}...`);

      const run = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));

        const isStale = () =>
          thisContractAddress !== stableMonitorRef.current?.address ||
          !sameChain.current(thisChainId) ||
          !sameSigner.current(thisEthersSigner);

        try {
          const input = instance.createEncryptedInput(
            thisContractAddress,
            thisEthersSigner.address
          );
          input.add32(newThreshold);

          const enc = await input.encrypt();

          if (isStale()) {
            setMessage("Ignore updateRiskThreshold");
            return;
          }

          setMessage(`Calling updateRiskThreshold...`);

          const tx: ethers.TransactionResponse = await contract.updateRiskThreshold(
            enc.handles[0],
            enc.inputProof
          );

          setMessage(`Waiting for tx:${tx.hash}...`);

          const receipt = await tx.wait();

          setMessage(`Update threshold completed status=${receipt?.status}`);

          if (isStale()) {
            setMessage("Ignore updateRiskThreshold");
            return;
          }

          refreshBalance();
        } catch (e: any) {
          setMessage(`Update threshold failed: ${e.message || e}`);
        } finally {
          isUpdatingThresholdRef.current = false;
          setIsUpdatingThreshold(false);
        }
      };

      run();
    },
    [
      ethersSigner,
      stableMonitor.address,
      stableMonitor.abi,
      instance,
      chainId,
      refreshBalance,
      sameChain,
      sameSigner,
    ]
  );

  return {
    contractAddress: stableMonitor.address,
    canDecrypt,
    canGetBalance,
    canIssue,
    canTransfer,
    canUpdateThreshold,
    issue,
    transfer,
    updateRiskThreshold,
    decryptBalance,
    refreshBalance,
    checkRisk,
    isBalanceDecrypted,
    message,
    clear: clearBalance?.clear,
    handle: balanceHandle,
    totalSupplyHandle,
    riskThresholdHandle,
    riskFlagHandle,
    clearRiskFlag: clearRiskFlag?.clear,
    isDecrypting,
    isRefreshing,
    isIssuing,
    isTransferring,
    isCheckingRisk,
    isDeployed,
    isUpdatingThreshold,
    clearRiskThreshold: clearRiskThreshold?.clear,
    decryptRiskThreshold,
    isIssuer,
    issuerAddress,
  };
};


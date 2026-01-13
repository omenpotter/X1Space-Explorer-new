import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, X } from 'lucide-react';

export default function WalletConnector({ onConnect, onDisconnect }) {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [walletType, setWalletType] = useState(null);

  useEffect(() => {
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    if (window.solana?.isPhantom) {
      const response = await window.solana.connect({ onlyIfTrusted: true }).catch(() => null);
      if (response?.publicKey) {
        const address = response.publicKey.toString();
        setWalletAddress(address);
        setWalletConnected(true);
        setWalletType('Phantom');
        onConnect?.({ address, type: 'Phantom' });
      }
    }
  };

  const connectPhantom = async () => {
    if (!window.solana?.isPhantom) {
      window.open('https://phantom.app/', '_blank');
      return;
    }

    try {
      const response = await window.solana.connect();
      const address = response.publicKey.toString();
      setWalletAddress(address);
      setWalletConnected(true);
      setWalletType('Phantom');
      onConnect?.({ address, type: 'Phantom' });
    } catch (error) {
      console.error('Phantom connection failed:', error);
    }
  };

  const disconnect = () => {
    if (window.solana?.isPhantom) {
      window.solana.disconnect();
    }
    setWalletConnected(false);
    setWalletAddress(null);
    setWalletType(null);
    onDisconnect?.();
  };

  if (walletConnected) {
    return (
      <div className="flex items-center gap-3">
        <Badge className="bg-emerald-500/20 text-emerald-400 border-0">
          {walletType} Connected
        </Badge>
        <span className="text-white font-mono text-sm">
          {walletAddress.substring(0, 6)}...{walletAddress.slice(-4)}
        </span>
        <Button variant="ghost" size="sm" onClick={disconnect} className="text-gray-400 hover:text-white">
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={connectPhantom} className="bg-purple-500 hover:bg-purple-600">
      <Wallet className="w-4 h-4 mr-2" />
      Connect Wallet
    </Button>
  );
}
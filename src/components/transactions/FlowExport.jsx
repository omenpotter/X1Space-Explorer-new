import React, { memo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Download, Image, FileJson } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const FlowExport = memo(function FlowExport({ flowData, transactions, graphRef }) {
  
  const exportAsJSON = useCallback(() => {
    const exportData = {
      centerAddress: flowData.centerAddress,
      exportDate: new Date().toISOString(),
      summary: {
        totalTransactions: transactions.length,
        connectedAddresses: flowData.nodes.length - 1,
        totalInflow: flowData.nodes[0]?.inflow || 0,
        totalOutflow: flowData.nodes[0]?.outflow || 0
      },
      nodes: flowData.nodes,
      edges: flowData.edges,
      transactions: transactions.map(tx => ({
        signature: tx.signature,
        type: tx.type,
        amount: tx.amount,
        from: tx.from,
        to: tx.to,
        status: tx.status,
        blockTime: tx.blockTime
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `x1_flow_${flowData.centerAddress?.substring(0, 8)}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [flowData, transactions]);

  const exportAsImage = useCallback(() => {
    if (!graphRef?.current) return;
    
    // Use html2canvas if available, otherwise create SVG export
    const svgElement = graphRef.current.querySelector('svg');
    if (svgElement) {
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `x1_flow_${flowData.centerAddress?.substring(0, 8)}_${Date.now()}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [flowData, graphRef]);

  const exportAsCSV = useCallback(() => {
    const headers = ['Signature', 'Type', 'Amount', 'From', 'To', 'Status', 'Time'];
    const rows = transactions.map(tx => [
      tx.signature,
      tx.type,
      tx.amount,
      tx.from,
      tx.to,
      tx.status,
      tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : ''
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `x1_transactions_${flowData.centerAddress?.substring(0, 8)}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [flowData, transactions]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="border-white/10 text-gray-400 hover:text-white">
          <Download className="w-4 h-4 mr-2" /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-[#24384a] border-white/10">
        <DropdownMenuItem onClick={exportAsJSON} className="text-gray-300 hover:text-white cursor-pointer">
          <FileJson className="w-4 h-4 mr-2" /> Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAsImage} className="text-gray-300 hover:text-white cursor-pointer">
          <Image className="w-4 h-4 mr-2" /> Export as SVG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAsCSV} className="text-gray-300 hover:text-white cursor-pointer">
          <Download className="w-4 h-4 mr-2" /> Export as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

export default FlowExport;
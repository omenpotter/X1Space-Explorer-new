import React, { useEffect, useRef, useState } from 'react';
import { Badge } from "@/components/ui/badge";

export default function ValidatorGraph({ validators, onNodeClick, stakeThreshold = 0 }) {
  const canvasRef = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const animationRef = useRef(null);

  useEffect(() => {
    if (!validators.length) return;

    // Filter by stake threshold
    const filtered = validators.filter(v => v.activatedStake >= stakeThreshold);
    
    // Initialize nodes with physics properties in center with radial distribution
    const initialNodes = filtered.map((v, i) => {
      const angle = (i / filtered.length) * Math.PI * 2;
      const radius = 200 + Math.random() * 100;
      return {
        ...v,
        x: 600 + Math.cos(angle) * radius,
        y: 300 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        radius: Math.max(8, Math.min(25, Math.sqrt(v.activatedStake) / 400)),
        color: v.delinquent ? '#ef4444' : '#06b6d4'
      };
    });

    setNodes(initialNodes);
  }, [validators, stakeThreshold]);

  useEffect(() => {
    if (!nodes.length || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Apply forces
      nodes.forEach((node, i) => {
        // Repulsion from other nodes
        nodes.forEach((other, j) => {
          if (i === j) return;
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const minDist = node.radius + other.radius + 20;
          
          if (dist < minDist) {
            const force = ((minDist - dist) / dist) * 0.5;
            node.vx += (dx / dist) * force;
            node.vy += (dy / dist) * force;
          }
        });

        // Attraction to center (gentle gravity)
        const centerX = width / 2;
        const centerY = height / 2;
        const dx = centerX - node.x;
        const dy = centerY - node.y;
        const distToCenter = Math.sqrt(dx * dx + dy * dy);
        node.vx += (dx / distToCenter) * 0.02;
        node.vy += (dy / distToCenter) * 0.02;

        // Velocity damping
        node.vx *= 0.85;
        node.vy *= 0.85;

        // Update position
        node.x += node.vx;
        node.y += node.vy;

        // Boundary constraints
        if (node.x < node.radius + 10) { node.x = node.radius + 10; node.vx = 0; }
        if (node.x > width - node.radius - 10) { node.x = width - node.radius - 10; node.vx = 0; }
        if (node.y < node.radius + 10) { node.y = node.radius + 10; node.vy = 0; }
        if (node.y > height - node.radius - 10) { node.y = height - node.radius - 10; node.vy = 0; }
      });

      // Draw connections to nearby nodes (only top stakers for clarity)
      const topNodes = nodes.filter(n => n.activatedStake > 1000000).slice(0, 50);
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
      topNodes.forEach((node, i) => {
        topNodes.slice(i + 1, i + 5).forEach(other => {
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200) {
            ctx.lineWidth = Math.max(0.5, (200 - dist) / 100);
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        });
      });

      // Draw nodes
      nodes.forEach(node => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.globalAlpha = 0.8;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [nodes]);

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const hovered = nodes.find(node => {
      const dx = node.x - x;
      const dy = node.y - y;
      return Math.sqrt(dx * dx + dy * dy) <= node.radius;
    });

    setHoveredNode(hovered || null);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleClick = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const clicked = nodes.find(node => {
      const dx = node.x - x;
      const dy = node.y - y;
      return Math.sqrt(dx * dx + dy * dy) <= node.radius;
    });

    if (clicked && onNodeClick) {
      onNodeClick(clicked);
    }
  };

  const formatStake = (stake) => {
    if (stake >= 1e6) return (stake / 1e6).toFixed(1) + 'M';
    if (stake >= 1e3) return (stake / 1e3).toFixed(1) + 'K';
    return stake?.toFixed(0) || '0';
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={1200}
        height={600}
        className="w-full h-[600px] bg-[#0a0f1a] rounded-lg cursor-pointer"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredNode(null)}
        onClick={handleClick}
      />
      
      {hoveredNode && (
        <div 
          className="fixed z-50 bg-[#0d1525] border border-white/20 rounded-lg p-3 shadow-xl pointer-events-none"
          style={{ left: tooltipPos.x + 15, top: tooltipPos.y + 15 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-cyan-400 font-black">X1</span>
            <span className="text-white font-medium text-sm">{hoveredNode.name || hoveredNode.votePubkey.substring(0, 12) + '...'}</span>
          </div>
          <div className="space-y-1 text-xs">
            <p><span className="text-gray-400">Stake:</span> <span className="text-cyan-400">{formatStake(hoveredNode.activatedStake)} XNT</span></p>
            <p><span className="text-gray-400">Uptime:</span> <span className={hoveredNode.uptime >= 99 ? 'text-emerald-400' : 'text-yellow-400'}>{hoveredNode.uptime?.toFixed(2)}%</span></p>
            <p><span className="text-gray-400">Skip Rate:</span> <span className={hoveredNode.skipRate < 1 ? 'text-emerald-400' : 'text-yellow-400'}>{hoveredNode.skipRate?.toFixed(2)}%</span></p>
            <p><span className="text-gray-400">Commission:</span> <span className="text-white">{hoveredNode.commission}%</span></p>
            <Badge className={`mt-1 ${hoveredNode.delinquent ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'} border-0 text-xs`}>
              {hoveredNode.delinquent ? 'Delinquent' : 'Active'}
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}
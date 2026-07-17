import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { useAppStore, EvidenceNode, EvidenceConnection } from "../../store/appStore";
import { 
  playPinClick, 
  playStringThrum, 
  playUnpinTear, 
  playHoverEvidence, 
  playTypeKey, 
  playDragThrum, 
  stopDragThrum, 
  playMenuToggle, 
  playReticleLock, 
  playOpenFile, 
  playCloseFile, 
  playUnlinkConnection, 
  playDetectiveBoardLoad
} from "../../lib/soundEngine";
import GlassPanel from "../../components/ui/GlassPanel";
import KnightSigil from "../../components/ui/KnightSigil";
import FittedText from "../../components/ui/FittedText";
import Badge from "../../components/ui/Badge";
import ParticleReveal from "../../components/ui/ParticleReveal";
import ShinyText from "../../components/react-bits/ShinyText";
import BlurText from "../../components/react-bits/BlurText";
import SplitText from "../../components/react-bits/SplitText";
import {
  Network,
  Plus,
  Maximize2,
  Minimize2,
  Image,
  FileText,
  Link,
  Trash2,
  Link2,
  Compass,
  Check,
  X,
  HelpCircle,
  File,
  Eye,
  Settings,
  FolderPlus,
  Pencil,
  MoveDiagonal2
} from "lucide-react";

// Default card footprint per evidence type, used whenever a node has no explicit width/height
// The header, footer and padding cost a card ~80px of vertical space, so a
// 100px-tall note left roughly one line for the body. These defaults give a
// fresh note about three readable lines before it needs resizing.
const DEFAULT_NODE_SIZE: Record<EvidenceNode["type"], { width: number; height: number }> = {
  photo: { width: 240, height: 220 },
  text: { width: 210, height: 150 },
  link: { width: 210, height: 120 },
  file: { width: 210, height: 120 }
};
const MIN_NODE_WIDTH = 150;
// Below this the body area collapses to nothing and the card is all chrome.
const MIN_NODE_HEIGHT = 110;
const MAX_NODE_WIDTH = 480;
const MAX_NODE_HEIGHT = 420;

function getNodeSize(node: EvidenceNode): { width: number; height: number } {
  const fallback = DEFAULT_NODE_SIZE[node.type] || DEFAULT_NODE_SIZE.text;
  return {
    width: node.width ?? fallback.width,
    height: node.height ?? fallback.height
  };
}

// Reusable ContextMenu styled as a Batcomputer GlassPanel
interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  children: React.ReactNode;
}

export function ContextMenu({ x, y, onClose, children }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        playMenuToggle();
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div 
      ref={menuRef}
      style={{ top: y, left: x }}
      className="absolute z-50 min-w-[170px]"
    >
      <GlassPanel 
        className="py-1 px-1 bg-bg-void/95 border-cyan-primary/50 text-xs shadow-[0_0_15px_rgba(0,243,255,0.3)]"
        clipSize="sm"
        showCornerTicks={false}
      >
        <div className="flex flex-col space-y-0.5">
          {children}
        </div>
      </GlassPanel>
    </div>
  );
}

export default function DetectiveBoardPage() {
  const cases = useAppStore((state) => state.cases);
  const activeCaseId = useAppStore((state) => state.activeCaseId);
  const evidenceNodes = useAppStore((state) => state.evidenceNodes);
  const evidenceConnections = useAppStore((state) => state.evidenceConnections);
  const addEvidenceNode = useAppStore((state) => state.addEvidenceNode);
  const updateEvidenceNodePosition = useAppStore((state) => state.updateEvidenceNodePosition);
  const resizeEvidenceNode = useAppStore((state) => state.resizeEvidenceNode);
  const commitEvidenceNode = useAppStore((state) => state.commitEvidenceNode);
  const setDraggingNode = useAppStore((state) => state.setDraggingNode);
  const broadcastDrag = useAppStore((state) => state.broadcastDrag);
  const updateEvidenceNodeContent = useAppStore((state) => state.updateEvidenceNodeContent);
  const updateEvidenceNodeNotes = useAppStore((state) => state.updateEvidenceNodeNotes);
  const deleteEvidenceNode = useAppStore((state) => state.deleteEvidenceNode);
  const addEvidenceConnection = useAppStore((state) => state.addEvidenceConnection);
  const deleteEvidenceConnection = useAppStore((state) => state.deleteEvidenceConnection);
  const updateEvidenceConnectionLabel = useAppStore((state) => state.updateEvidenceConnectionLabel);
  const addCase = useAppStore((state) => state.addCase);
  const addLog = useAppStore((state) => state.addLog);

  const [isLoading, setIsLoading] = useState(true);
  const audioPlayed = useRef(false);

  useEffect(() => {
    if (!audioPlayed.current) {
      playDetectiveBoardLoad();
      audioPlayed.current = true;
    }
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleSkipLoading = () => {
    setIsLoading(false);
  };

  const activeCase = cases.find(c => c.id === activeCaseId);
  const boardNodes = evidenceNodes.filter(n => n.caseId === activeCaseId);
  const boardConnections = evidenceConnections.filter(c => c.caseId === activeCaseId);

  // Hover, relationship and motion settings
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (activeCaseId) {
      playOpenFile();
    } else {
      playCloseFile();
    }
  }, [activeCaseId]);

  const relatedNodeIds = React.useMemo(() => {
    if (!hoveredNodeId) return new Set<string>();
    const set = new Set<string>();
    set.add(hoveredNodeId);
    boardConnections.forEach(c => {
      if (c.fromNodeId === hoveredNodeId) set.add(c.toNodeId);
      if (c.toNodeId === hoveredNodeId) set.add(c.fromNodeId);
    });
    return set;
  }, [hoveredNodeId, boardConnections]);

  // Pan and Zoom Workspace state
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Node Dragging references
  const workspaceRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Context Menu State
  const [bgMenu, setBgMenu] = useState<{ x: number, y: number, canvasX: number, canvasY: number } | null>(null);
  const [nodeMenu, setNodeMenu] = useState<{ x: number, y: number, nodeId: string } | null>(null);
  const [connMenu, setConnMenu] = useState<{ x: number, y: number, connId: string } | null>(null);

  // Node editing state
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  // Node rename state (shared by the card's inline control and the detail modal)
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState("");

  // Node resize state, mirrors draggingNodeId's transition-disabling role
  const [resizingNodeId, setResizingNodeId] = useState<string | null>(null);

  const startRenaming = (node: EvidenceNode) => {
    setRenamingNodeId(node.id);
    setRenamingTitle(node.title || "");
  };

  const commitRename = (nodeId: string) => {
    const trimmed = renamingTitle.trim();
    if (trimmed) {
      updateEvidenceNodeContent(nodeId, { title: trimmed });
    }
    setRenamingNodeId(null);
  };

  // Connection Linking state
  const [linkingFromId, setLinkingFromId] = useState<string | null>(null);

  // Evidence Detail State
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null);
  const detailNode = boardNodes.find(n => n.id === detailNodeId);

  // Rename/Label Connection state
  const [labelingConnId, setLabelingConnId] = useState<string | null>(null);
  const [connLabel, setConnLabel] = useState("");

  // Node Creation Modal (non-context-menu)
  const [showAddForm, setShowAddForm] = useState(false);
  const [formType, setFormType] = useState<"text" | "link" | "file">("text");
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");

  // New Case Creation Dialog on Empty State
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [newCaseTitle, setNewCaseTitle] = useState("");
  const [newCaseSynopsis, setNewCaseSynopsis] = useState("");

  // Track which nodes are currently revealing
  const [revealingNodes, setRevealingNodes] = useState<Record<string, boolean>>({});

  const handleCreateCase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCaseTitle.trim()) return;
    addCase({
      title: newCaseTitle,
      synopsis: newCaseSynopsis,
      status: "ACTIVE"
    });
    setNewCaseTitle("");
    setNewCaseSynopsis("");
    setShowNewCaseModal(false);
  };

  // Dragging Canvas background
  const handleBgPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // If clicking a context menu, a button, input, or inside a node card, do not start panning
    const target = e.target as HTMLElement;
    if (
      target.closest(".nocanvasdrag") || 
      target.closest(".group") || 
      target.closest("button") || 
      target.closest("input") || 
      target.closest("textarea") || 
      target.closest("a")
    ) {
      return;
    }
    if (e.button !== 0) return; // Only left-click pans
    
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    e.currentTarget.setPointerCapture(e.pointerId);
    
    // Close menus
    setBgMenu(null);
    setNodeMenu(null);
    setConnMenu(null);
  };

  const handleBgPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y
    });
  };

  const handleBgPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    setIsPanning(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Zoom Handling
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    let nextZoom = zoom;
    if (e.deltaY < 0) {
      nextZoom = Math.min(zoom * zoomFactor, 2.5);
    } else {
      nextZoom = Math.max(zoom / zoomFactor, 0.4);
    }
    setZoom(nextZoom);
  };

  // Node dragging state for transition disabling
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

  // Pointer Dragging for Nodes
  const handleNodePointerDown = (e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation(); // Always stop propagation so background panning doesn't intercept the click!

    // If clicking a button, link, action control, or input/textarea inside the card, do not start dragging!
    const target = e.target as HTMLElement;
    if (target.closest(".nocanvasdrag") || target.closest("button") || target.closest("a") || target.closest("textarea") || target.closest("input")) {
      return;
    }

    e.preventDefault(); // Prevent text selection/native drag interference!
    setBgMenu(null);
    setNodeMenu(null);
    setConnMenu(null);

    // If linking, handle target click
    if (linkingFromId) {
      if (linkingFromId !== nodeId) {
        addEvidenceConnection(linkingFromId, nodeId);
        setLinkingFromId(null);
        // Play string thrum with a 650ms delay to align with the draw animation landing
        setTimeout(() => {
          playStringThrum();
        }, 650);
      }
      return;
    }

    const node = boardNodes.find(n => n.id === nodeId);
    if (!node) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const nodeStartX = node.x;
    const nodeStartY = node.y;

    // Claim the node so incoming realtime updates leave it alone until released.
    setDraggingNode(nodeId);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;
      const nextX = nodeStartX + dx;
      const nextY = nodeStartY + dy;
      updateEvidenceNodePosition(nodeId, nextX, nextY);
      // Live position to the other knights. Throttled in the backend and never
      // persisted — the durable write happens once, below, on release.
      broadcastDrag(nodeId, nextX, nextY);
      if (draggingNodeId !== nodeId) {
        setDraggingNodeId(nodeId);
      }
    };

    const handlePointerUp = () => {
      stopDragThrum();
      setDraggingNodeId(null);
      setDraggingNode(null);
      // Position updates are memory-only during the drag; persist the result.
      commitEvidenceNode(nodeId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

  playDragThrum();
  window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  // Pointer Dragging for the resize handle at a card's bottom-right corner
  const handleResizePointerDown = (e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    e.preventDefault();

    const node = boardNodes.find(n => n.id === nodeId);
    if (!node) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const { width: startWidth, height: startHeight } = getNodeSize(node);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;
      const nextWidth = Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, Math.round(startWidth + dx)));
      const nextHeight = Math.min(MAX_NODE_HEIGHT, Math.max(MIN_NODE_HEIGHT, Math.round(startHeight + dy)));
      resizeEvidenceNode(nodeId, nextWidth, nextHeight);
      setResizingNodeId(nodeId);
    };

    const handlePointerUp = () => {
      setResizingNodeId(null);
      // Size updates are memory-only during the resize; persist the result.
      commitEvidenceNode(nodeId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  // Canvas Right Click Context Menu
  const handleBgContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    if (
      target.closest(".nocanvasdrag") ||
      target.closest(".group") ||
      target.closest("button") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest("a")
    ) {
      return;
    }
    
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calc coordinates relative to the panned/zoomed inner coordinates
    const canvasX = (x - pan.x) / zoom;
    const canvasY = (y - pan.y) / zoom;

    playMenuToggle();
    setBgMenu({ x, y, canvasX, canvasY });
    setNodeMenu(null);
    setConnMenu(null);
  };

  // Node Right Click Context Menu
  const handleNodeContextMenu = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    playMenuToggle();
    setNodeMenu({ x, y, nodeId });
    setBgMenu(null);
    setConnMenu(null);
  };

  // Connection Line Right Click Context Menu
  const handleConnectionContextMenu = (e: React.MouseEvent, connId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    playMenuToggle();
    setConnMenu({ x, y, connId });
    setBgMenu(null);
    setNodeMenu(null);
  };

  // Add node from Context Menu action
  const handleContextAddNode = (type: "text" | "photo" | "link" | "file", canvasX: number, canvasY: number) => {
    setBgMenu(null);
    if (type === "photo") {
      fileInputRef.current?.click();
      return;
    }
    setFormType(type);
    setFormTitle("");
    setFormContent("");
    setShowAddForm(true);
    // Store position for form placing
    (window as any)._pendingX = canvasX;
    (window as any)._pendingY = canvasY;
  };

  const handleAddClueAtCenter = (type: "text" | "photo" | "link" | "file") => {
    const rect = workspaceRef.current?.getBoundingClientRect();
    const width = rect?.width || 800;
    const height = rect?.height || 600;
    const canvasX = (width / 2 - pan.x) / zoom;
    const canvasY = (height / 2 - pan.y) / zoom;
    handleContextAddNode(type, canvasX, canvasY);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const x = (window as any)._pendingX !== undefined ? (window as any)._pendingX : 150;
    const y = (window as any)._pendingY !== undefined ? (window as any)._pendingY : 150;
    delete (window as any)._pendingX;
    delete (window as any)._pendingY;

    const nodeId = `node-${Math.random().toString(36).substring(7)}`;

    // Set revealing node
    setRevealingNodes(prev => ({ ...prev, [nodeId]: true }));
    setTimeout(() => {
      setRevealingNodes(prev => ({ ...prev, [nodeId]: false }));
    }, 1200);

    addEvidenceNode({
      type: formType as any,
      title: formTitle.trim() || `${formType.toUpperCase()} NOTE`,
      content: formContent.trim(),
      x,
      y,
      color: "cyan"
    });

    setShowAddForm(false);
    playPinClick();
  };

  // File uploading for photos
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const x = (bgMenu?.canvasX) ?? 150;
      const y = (bgMenu?.canvasY) ?? 150;

      const nodeId = `node-${Math.random().toString(36).substring(7)}`;
      setRevealingNodes(prev => ({ ...prev, [nodeId]: true }));
      setTimeout(() => {
        setRevealingNodes(prev => ({ ...prev, [nodeId]: false }));
      }, 1200);

      addEvidenceNode({
        type: "photo",
        title: file.name.toUpperCase(),
        content: dataUrl,
        x,
        y,
        color: "cyan"
      });
      setBgMenu(null);
      playPinClick();
    };
    reader.readAsDataURL(file);
  };

  // Center view function
  const handleCenterView = () => {
    if (boardNodes.length === 0) {
      setPan({ x: 20, y: 20 });
      setZoom(1);
      return;
    }
    // Find bounding box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    boardNodes.forEach(n => {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    });

    const rect = workspaceRef.current?.getBoundingClientRect();
    const width = rect?.width || 800;
    const height = rect?.height || 600;

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setPan({
      x: width / 2 - centerX,
      y: height / 2 - centerY
    });
    setZoom(0.95);
  };

  // Double Click Canvas adds a fast text note
  const handleBgDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest(".nocanvasdrag") ||
      target.closest(".group") ||
      target.closest("button") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest("a")
    ) {
      return;
    }
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const canvasX = (x - pan.x) / zoom;
    const canvasY = (y - pan.y) / zoom;

    const nodeId = `node-${Math.random().toString(36).substring(7)}`;
    setRevealingNodes(prev => ({ ...prev, [nodeId]: true }));
    setTimeout(() => {
      setRevealingNodes(prev => ({ ...prev, [nodeId]: false }));
    }, 1200);

    addEvidenceNode({
      type: "text",
      title: "QUICK NOTE",
      content: "Type notes here...",
      x: canvasX - 90,
      y: canvasY - 55,
      color: "cyan"
    });
    playPinClick();
  };

  // Node double click opens detail view
  const handleNodeDoubleClick = (e: React.MouseEvent, node: EvidenceNode) => {
    e.stopPropagation();
    setDetailNodeId(node.id);
    playOpenFile();
  };

  const handleSaveTextEdit = (nodeId: string) => {
    updateEvidenceNodeContent(nodeId, { content: editingText });
    setEditingNodeId(null);
  };

  // Connection labeling save
  const handleSaveConnLabel = (e: React.FormEvent) => {
    e.preventDefault();
    if (labelingConnId) {
      updateEvidenceConnectionLabel(labelingConnId, connLabel);
      setLabelingConnId(null);
      setConnLabel("");
    }
  };

  // Render node icon helper
  const getNodeIcon = (type: EvidenceNode["type"]) => {
    switch (type) {
      case "photo": return Image;
      case "text": return FileText;
      case "link": return Link;
      case "file": return File;
      default: return HelpCircle;
    }
  };

  return (
    <AnimatePresence>
      {isLoading ? (
        <motion.div 
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          className="fixed inset-0 z-[100] bg-bg-void overflow-hidden flex items-center justify-center font-mono select-none"
        >
          <div className="absolute inset-0 bg-scanline-pattern opacity-10 mix-blend-overlay" />
          
          {/* Holographic monitor horizontal expansion */}
          <motion.div
            initial={{ scaleY: 0.01, scaleX: 0, opacity: 0 }}
            animate={{ scaleY: [0.01, 0.01, 1], scaleX: [0, 1, 1], opacity: [0.8, 1, 1] }}
            transition={{ duration: 0.6, ease: "circOut" }}
            className="w-full h-full max-w-4xl max-h-[80vh] border border-cyan-primary/40 bg-cyan-primary/5 flex flex-col justify-center items-center relative"
            style={{ clipPath: "polygon(5% 0, 95% 0, 100% 5%, 100% 95%, 95% 100%, 5% 100%, 0 95%, 0 5%)" }}
          >
            {/* Flickering glitch layer */}
            <motion.div 
              animate={{ opacity: [0.3, 0.8, 0.2, 0.7, 0.1, 0.5, 0] }}
              transition={{ duration: 0.5, times: [0, 0.2, 0.4, 0.6, 0.8, 0.9, 1] }}
              className="absolute inset-0 bg-cyan-primary mix-blend-screen"
            />
            
            <div className="text-center relative z-10">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="text-cyan-primary text-3xl font-black tracking-[0.5em] ml-[0.5em] mb-4">
                  HOLOSPHERE
                </div>
                <div className="text-cyan-dim text-[13px] tracking-widest uppercase mb-8">
                  Constructing Workspace Projection
                </div>
                
                {/* Loader bar */}
                <div className="w-64 h-[2px] bg-cyan-primary/20 mx-auto relative overflow-hidden">
                  <motion.div 
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ duration: 0.6, ease: "linear" }}
                    className="absolute inset-0 bg-cyan-primary shadow-[0_0_10px_#09efaf]"
                  />
                </div>
              </motion.div>
            </div>
            
            {/* Grid overlay within monitor */}
            <div className="absolute inset-0 bg-grid-pattern opacity-10" />
          </motion.div>
        </motion.div>
      ) : (
        <div className="flex flex-col lg:flex-row h-full w-full select-none text-text-primary">
      {/* Hidden file input for Photo Uploads */}
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handlePhotoUpload}
        accept="image/*"
        className="hidden"
      />

      {/* LEFT: Mini Control HUD Panel */}
      <div className="w-full lg:w-72 bg-bg-void/80 border-b lg:border-b-0 lg:border-r border-border-hairline/20 p-4 flex flex-col justify-between shrink-0 relative z-20">
        <div className="space-y-4">
          <div className="border-b border-border-hairline/25 pb-2">
            <h2 className="font-orbitron text-xs font-black tracking-widest text-cyan-text flex items-center">
              <span className="w-1.5 h-3 bg-cyan-primary mr-2 transform -skew-x-12 inline-block shadow-[0_0_6px_#2ff1e4]" />
              <SplitText text="BOARD MATRIX ARCHIVE" delay={0.005} />
            </h2>
          </div>

          {!activeCase ? (
            <div className="p-3 text-center bg-red-threat/5 border border-red-threat/20 rounded-sm">
              <p className="text-[13px] text-red-threat font-bold tracking-widest uppercase mb-2">No Active Case</p>
              <button
                onClick={() => setShowNewCaseModal(true)}
                onMouseEnter={() => playHoverEvidence()}
                className="w-full flex items-center justify-center p-1.5 border border-red-threat/30 text-red-threat hover:bg-red-threat hover:text-bg-void transition-all text-[13px] font-black uppercase tracking-widest"
                style={{ clipPath: "polygon(0 0, 100% 0, 95% 100%, 0 100%)" }}
              >
                <FolderPlus className="w-3.5 h-3.5 mr-1" />
                CREATE CASE
              </button>
            </div>
          ) : (
            <div
              key={activeCase.id}
              className={`origin-top ${prefersReducedMotion ? "" : "animate-clip-reveal"}`}
            >
              <GlassPanel 
                className="p-3 space-y-2 bg-bg-panel/20"
                clipSize="sm" 
                showCornerTicks={false}
              >
                <div className="flex justify-between items-center">
                  <Badge variant="cyan" className="text-[12px] tracking-wider uppercase">{activeCase.status}</Badge>
                  <span className="font-mono text-[12px] text-text-dim">
                    {new Date(activeCase.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="font-orbitron text-sm font-black text-text-primary tracking-wide line-clamp-1 uppercase">{activeCase.title}</h3>
                <p className="font-share text-[13px] leading-relaxed text-text-dim italic line-clamp-3">"{activeCase.synopsis}"</p>

                <div className="border-t border-border-hairline/10 pt-2 grid grid-cols-2 gap-2 text-center text-text-dim font-mono text-[12px]">
                  <div className="bg-bg-void/40 border border-border-hairline/10 p-1.5">
                    <span className="block text-[12px] text-text-dim/60">CLUES</span>
                    <span className="text-cyan-text font-black text-xs">{boardNodes.length}</span>
                  </div>
                  <div className="bg-bg-void/40 border border-border-hairline/10 p-1.5">
                    <span className="block text-[12px] text-text-dim/60">LINKS</span>
                    <span className="text-cyan-text font-black text-xs">{boardConnections.length}</span>
                  </div>
                </div>
              </GlassPanel>
            </div>
          )}

          {/* Quick Creator */}
          <div className="space-y-2">
            <span className="text-[12px] font-share text-text-dim block uppercase tracking-widest">// QUICK ADD CLUE (TOUCH/DESKTOP)</span>
            <div className="grid grid-cols-3 gap-1.5 font-chakra text-[12px] text-center">
              <button 
                disabled={!activeCaseId}
                onClick={() => handleAddClueAtCenter("text")}
                className="p-1.5 border border-cyan-primary/20 hover:border-cyan-primary bg-bg-panel/10 hover:bg-cyan-primary/10 text-text-dim hover:text-text-primary transition-all flex flex-col items-center disabled:opacity-30 disabled:pointer-events-none"
              >
                <FileText className="w-4.5 h-4.5 mb-1 text-cyan-dim" />
                NOTE
              </button>
              <button 
                disabled={!activeCaseId}
                onClick={() => handleAddClueAtCenter("photo")}
                className="p-1.5 border border-cyan-primary/20 hover:border-cyan-primary bg-bg-panel/10 hover:bg-cyan-primary/10 text-text-dim hover:text-text-primary transition-all flex flex-col items-center disabled:opacity-30 disabled:pointer-events-none"
              >
                <Image className="w-4.5 h-4.5 mb-1 text-cyan-dim" />
                PHOTO
              </button>
              <button 
                disabled={!activeCaseId}
                onClick={() => handleAddClueAtCenter("link")}
                className="p-1.5 border border-cyan-primary/20 hover:border-cyan-primary bg-bg-panel/10 hover:bg-cyan-primary/10 text-text-dim hover:text-text-primary transition-all flex flex-col items-center disabled:opacity-30 disabled:pointer-events-none"
              >
                <Link className="w-4.5 h-4.5 mb-1 text-cyan-dim" />
                LINK
              </button>
            </div>
          </div>

          {/* Guidelines info */}
          <div className="text-[12px] leading-relaxed text-text-dim/75 font-share p-2 bg-cyan-primary/[0.02] border border-cyan-primary/10 rounded-sm">
            <strong className="text-cyan-text block mb-1">WORKSPACE HUD TUTORIAL:</strong>
            <ul className="list-disc pl-3.5 space-y-1">
              <li>Drag background to <span className="text-cyan-primary">Pan workspace</span></li>
              <li>Scroll mousewheel to <span className="text-cyan-primary">Zoom canvas</span></li>
              <li>Right-click empty space to <span className="text-cyan-primary">Add clue card</span></li>
              <li>Right-click card to <span className="text-cyan-primary">Link/Delete clue</span></li>
              <li>Double-click Note cards to <span className="text-cyan-primary">Edit text inline</span></li>
            </ul>
          </div>
        </div>

        <div className="pt-4 mt-4 border-t border-border-hairline/20 space-y-2">
          {linkingFromId && (
            <div className="p-2 bg-cyan-primary/10 border border-cyan-primary/30 rounded-sm text-center animate-hex-pulse-flicker">
              <span className="font-chakra text-[12px] text-cyan-text font-black tracking-widest block uppercase mb-1">
                CORRELATION LINK ACTIVE
              </span>
              <p className="text-[12px] text-text-primary uppercase">Click target card to connect</p>
              <button 
                onClick={() => setLinkingFromId(null)}
                className="mt-1.5 text-[12px] text-red-threat hover:underline uppercase block mx-auto font-bold"
              >
                [CANCEL LINK]
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleCenterView}
              className="flex-1 flex items-center justify-center p-2 border border-cyan-primary/30 text-cyan-text hover:bg-cyan-primary hover:text-bg-void transition-all text-[13px] font-bold tracking-widest uppercase"
              style={{ clipPath: "polygon(0 0, 100% 0, 92% 100%, 0 100%)" }}
            >
              <Compass className="w-3.5 h-3.5 mr-1" />
              FOCUS BOARD
            </button>
            <div className="flex items-center space-x-1 border border-border-hairline/25 px-2 text-[12px] font-mono text-text-dim">
              <span>ZOOM:</span>
              <span className="text-cyan-text font-bold">{Math.round(zoom * 100)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Main Interactive Canvas */}
      <div 
        ref={workspaceRef}
        className="flex-1 bg-bg-void/45 relative overflow-hidden h-[500px] lg:h-full cursor-grab active:cursor-grabbing border-t lg:border-t-0 border-border-hairline/15"
        onPointerDown={handleBgPointerDown}
        onPointerMove={handleBgPointerMove}
        onPointerUp={handleBgPointerUp}
        onWheel={handleWheel}
        onContextMenu={handleBgContextMenu}
        onDoubleClick={handleBgDoubleClick}
      >
        {/* Subtle grid mesh background that stretches with pan and scales with zoom */}
        <div
          className="absolute inset-0 canvas-bg pointer-events-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            backgroundImage: `radial-gradient(rgba(112,162,168,0.1) 1.2px, transparent 1.2px)`,
            backgroundSize: "28px 28px",
            transformOrigin: "0 0",
            transition: isPanning ? "none" : "transform 0.1s ease-out"
          }}
        />

        {/* Holographic projection scan sweep — reinforces the "live HUD projection" feel */}
        {!prefersReducedMotion && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-[0.5]">
            <div className="absolute -top-full left-0 w-full h-[200%] crt-scanlines opacity-[0.04] animate-scanline-drift" />
            <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-cyan-primary/[0.04] to-transparent animate-[beamSweep_9s_linear_infinite]" />
          </div>
        )}

        {/* Dynamic Zoom/Pan Workspace Content Container */}
        <div 
          className="absolute inset-0 origin-top-left pointer-events-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: (isPanning || draggingNodeId) ? "none" : "transform 0.1s ease-out"
          }}
        >
          {/* Infinite SVG Linking Overlay */}
          <svg className="absolute top-0 left-0 w-[5000px] h-[5000px] overflow-visible select-none">
            {boardConnections.map((conn, index) => {
              const fromNode = boardNodes.find(n => n.id === conn.fromNodeId);
              const toNode = boardNodes.find(n => n.id === conn.toNodeId);
              if (!fromNode || !toNode) return null;

              // Calculate nodes centers based on size (respects per-node resize)
              const { width: fromWidth, height: fromHeight } = getNodeSize(fromNode);
              const { width: toWidth, height: toHeight } = getNodeSize(toNode);

              const x1 = fromNode.x + fromWidth / 2;
              const y1 = fromNode.y + fromHeight / 2;
              const x2 = toNode.x + toWidth / 2;
              const y2 = toNode.y + toHeight / 2;

              // Midpoint for connection tag/label
              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;

              const isLabeling = labelingConnId === conn.id;

              const isConnHighlighted = hoveredNodeId 
                ? (conn.fromNodeId === hoveredNodeId || conn.toNodeId === hoveredNodeId)
                : false;

              const dx = x2 - x1;
              const dy = y2 - y1;
              const length = Math.sqrt(dx * dx + dy * dy) || 100;

              return (
                <g key={conn.id} className="nocanvasdrag select-none">
                  {/* Outer glow line: Draws on incrementally after the nodes build */}
                  <motion.path
                    d={`M ${x1} ${y1} L ${x2} ${y2}`}
                    stroke={isConnHighlighted ? "#00f3ff" : "#70a2a8"}
                    strokeWidth="3.5"
                    initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{
                      duration: prefersReducedMotion ? 0 : 0.8,
                      delay: prefersReducedMotion ? 0 : (boardNodes.length * 0.05) + (index * 0.1),
                      ease: "easeOut"
                    }}
                    className={`blur-[2px] transition-opacity duration-300 ${
                      hoveredNodeId
                        ? isConnHighlighted
                          ? "opacity-80"
                          : "opacity-5"
                        : "opacity-25"
                    }`}
                  />
                  
                  {/* Primary sharp connection line: Draws on as a solid connection using animated stroke-dashoffset */}
                  <motion.path
                    d={`M ${x1} ${y1} L ${x2} ${y2}`}
                    stroke={isConnHighlighted ? "#00f3ff" : "#70a2a8"}
                    strokeWidth="1.5"
                    initial={prefersReducedMotion ? { pathLength: 1, strokeDashoffset: 0 } : { pathLength: 0, strokeDashoffset: length }}
                    animate={{ pathLength: 1, strokeDashoffset: 0 }}
                    transition={{
                      pathLength: { duration: prefersReducedMotion ? 0 : 0.8, delay: prefersReducedMotion ? 0 : (boardNodes.length * 0.05) + (index * 0.1), ease: "easeOut" },
                      strokeDashoffset: { duration: prefersReducedMotion ? 0 : 0.8, delay: prefersReducedMotion ? 0 : (boardNodes.length * 0.05) + (index * 0.1), ease: "easeOut" }
                    }}
                    style={{ 
                      strokeDasharray: length,
                      pointerEvents: "stroke" 
                    }}
                    className={`cursor-pointer transition-opacity duration-300 ${
                      hoveredNodeId
                        ? isConnHighlighted
                          ? "stroke-accent-primary opacity-100 shadow-lg"
                          : "opacity-5"
                        : "stroke-cyan-primary/75 hover:stroke-accent-primary hover:opacity-100"
                    }`}
                    onContextMenu={(e) => handleConnectionContextMenu(e, conn.id)}
                  />

                  {/* Secondary dashed flow overlay: Flows infinitely to guide eye tracking of connection paths */}
                  {!prefersReducedMotion && (
                    <motion.path
                      d={`M ${x1} ${y1} L ${x2} ${y2}`}
                      stroke="#00f3ff"
                      strokeWidth="1"
                      strokeDasharray="6 12"
                      initial={{ strokeDashoffset: 100 }}
                      animate={{ strokeDashoffset: 0 }}
                      transition={{
                        repeat: Infinity,
                        duration: 4,
                        ease: "linear"
                      }}
                      className={`pointer-events-none transition-opacity duration-300 ${
                        hoveredNodeId
                          ? isConnHighlighted
                            ? "opacity-60"
                            : "opacity-0"
                          : "opacity-15"
                      }`}
                    />
                  )}

                  {/* Holographic data pulse: a glowing packet travels the link, faster/brighter when highlighted */}
                  {!prefersReducedMotion && (
                    <motion.circle
                      r={isConnHighlighted ? 3.5 : 2.2}
                      fill="#00f3ff"
                      initial={{ cx: x1, cy: y1 }}
                      animate={{ cx: [x1, x2], cy: [y1, y2] }}
                      transition={{
                        repeat: Infinity,
                        duration: isConnHighlighted ? 1.4 : 2.6,
                        ease: "linear",
                        delay: index * 0.35
                      }}
                      style={{ filter: "drop-shadow(0 0 5px #00f3ff)" }}
                      className={`pointer-events-none transition-opacity duration-300 ${
                        hoveredNodeId
                          ? isConnHighlighted
                            ? "opacity-95"
                            : "opacity-0"
                          : "opacity-45"
                      }`}
                    />
                  )}

                  {/* Optional connection label container */}
                  {conn.label ? (
                    <foreignObject 
                      x={midX - 50} 
                      y={midY - 12} 
                      width="100" 
                      height="24"
                      className={`overflow-visible pointer-events-auto transition-opacity duration-300 ${
                        hoveredNodeId && !isConnHighlighted ? "opacity-20" : "opacity-100"
                      }`}
                    >
                      <div className="flex justify-center select-none">
                        <div className="bg-bg-void border border-cyan-primary/30 px-1.5 py-0.5 rounded-sm text-[12px] font-mono tracking-widest text-cyan-text uppercase truncate max-w-full shadow-md text-center">
                          {conn.label}
                        </div>
                      </div>
                    </foreignObject>
                  ) : null}
                </g>
              );
            })}
          </svg>

          {/* Evidence Nodes */}
          <div className="absolute top-0 left-0 w-full h-full">
            {boardNodes.map((node, index) => {
              const Icon = getNodeIcon(node.type);
              const isEditing = editingNodeId === node.id;
              const isLinkingFrom = linkingFromId === node.id;
              const isRevealing = revealingNodes[node.id];
              const isRenaming = renamingNodeId === node.id;
              const { width: cardWidthPx, height: cardHeightPx } = getNodeSize(node);

              const isHighlighted = hoveredNodeId
                ? relatedNodeIds.has(node.id) 
                : false;

              const hoverEffectClass = hoveredNodeId
                ? isHighlighted
                  ? "opacity-100 scale-[1.02] shadow-[0_0_15px_rgba(0,243,255,0.3)] border-accent-primary/50"
                  : "opacity-30 scale-[0.98] blur-[0.5px]"
                : "opacity-100 scale-100";

              return (
                <motion.div
                  key={node.id}
                  initial={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.45,
                    delay: prefersReducedMotion ? 0 : index * 0.08,
                    ease: "easeOut"
                  }}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: cardWidthPx,
                    height: cardHeightPx,
                    position: "absolute"
                  }}
                  className={`pointer-events-auto group select-none ${(draggingNodeId === node.id || resizingNodeId === node.id) ? '' : 'transition-all duration-300'} ${hoverEffectClass}`}
                  onPointerDown={(e) => handleNodePointerDown(e, node.id)}
                  onMouseEnter={() => {
                    setHoveredNodeId(node.id);
                    playHoverEvidence();
                    playReticleLock();
                  }}
                  onMouseLeave={() => {
                    setHoveredNodeId(null);
                  }}
                  onContextMenu={(e) => handleNodeContextMenu(e, node.id)}
                  onDoubleClick={(e) => handleNodeDoubleClick(e, node)}
                >
                  {isRevealing ? (
                    <div className="absolute inset-0 flex items-center justify-center z-50">
                      <ParticleReveal icon={Icon} duration={900} className="w-full h-full scale-125" />
                    </div>
                  ) : null}

                  {/* Corner Reticle Hover brackets snap effect */}
                  <div className="absolute -inset-1.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                    <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-cyan-primary" />
                    <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-cyan-primary" />
                    <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-cyan-primary" />
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-cyan-primary" />
                  </div>

                  {/* Authorship mark — absent on guest boards */}
                  <KnightSigil knightId={node.createdBy} reducedMotion={prefersReducedMotion} />

                  <GlassPanel 
                    className={`p-2.5 h-full flex flex-col justify-between transition-all duration-300 relative ${
                      isLinkingFrom 
                        ? "border-amber-alert/60 shadow-[0_0_12px_rgba(255,157,46,0.3)] bg-amber-alert/[0.04]" 
                        : "bg-bg-panel/95 hover:bg-cyan-primary/[0.02]"
                    }`}
                    clipSize="sm"
                    showCornerTicks={true}
                    glow={isLinkingFrom}
                  >
                    {/* Tiny Pinned/Conspiracy HUD Glyph */}
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-cyan-primary/20 border border-cyan-primary rounded-full flex items-center justify-center shadow-[0_0_4px_#2ff1e4]">
                      <div className="w-0.5 h-0.5 bg-white rounded-full" />
                    </div>

                    <div className="flex flex-col h-full justify-between pt-1 select-none">
                      {/* Node Header with interactive click actions */}
                      <div className="flex items-center justify-between border-b border-border-hairline/15 pb-1 mb-1.5 shrink-0 select-none">
                        {isRenaming ? (
                          <input
                            autoFocus
                            value={renamingTitle}
                            onChange={(e) => setRenamingTitle(e.target.value)}
                            onBlur={() => commitRename(node.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); commitRename(node.id); }
                              if (e.key === "Escape") { e.preventDefault(); setRenamingNodeId(null); }
                            }}
                            className="nocanvasdrag font-orbitron text-[12px] font-black text-cyan-text tracking-widest uppercase bg-bg-void/60 border border-cyan-primary/40 outline-none px-1 py-0.5 w-[100px]"
                          />
                        ) : (
                          // Plain text, not BlurText: its per-character inline-block
                          // spans defeat text-overflow, so the title hard-clipped
                          // mid-character ("NURSERY R|") instead of ellipsising.
                          // flex-1/min-w-0 lets it use the width the buttons leave.
                          <span
                            className="font-orbitron text-[13px] font-black text-cyan-text tracking-wider uppercase truncate flex-1 min-w-0 mr-1.5"
                            title={node.title}
                          >
                            {node.title}
                          </span>
                        )}
                        <div className="flex items-center space-x-1.5 nocanvasdrag pointer-events-auto">
                          <button
                            title="Rename Clue"
                            onClick={(e) => {
                              e.stopPropagation();
                              startRenaming(node);
                            }}
                            className="p-0.5 hover:bg-cyan-primary/20 text-cyan-dim hover:text-cyan-text rounded transition-all cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            title="Correlate/Link Clue"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLinkingFromId(node.id);
                            }}
                            className="p-0.5 hover:bg-cyan-primary/20 text-cyan-dim hover:text-cyan-text rounded transition-all cursor-pointer"
                          >
                            <Link2 className="w-3 h-3" />
                          </button>
                          {node.type === "text" && (
                            <button
                              title="Edit text content"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingNodeId(node.id);
                                setEditingText(node.content);
                              }}
                              className="p-0.5 hover:bg-cyan-primary/20 text-cyan-dim hover:text-cyan-text rounded transition-all cursor-pointer"
                            >
                              <FileText className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            title="Delete Clue"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteEvidenceNode(node.id);
                              addLog("CLUE PURGED FROM DETECTIVE BOARD MATRIX", "warning", "BELFRY");
                              playUnpinTear();
                            }}
                            className="p-0.5 hover:bg-red-threat/25 text-text-dim hover:text-red-threat rounded transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Node Body Content */}
                      <div className="flex-1 overflow-hidden min-h-0 text-[13px] text-text-dim leading-snug select-none">
                        {node.type === "photo" ? (
                          <div className="w-full h-full min-h-0 bg-bg-void/40 border border-border-hairline/10 rounded-sm relative overflow-hidden flex items-center justify-center">
                            {node.content ? (
                              <img
                                src={node.content}
                                alt={node.title}
                                className="w-full h-full object-contain select-none"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <Image className="w-6 h-6 text-border-hairline/45" />
                            )}
                          </div>
                        ) : isEditing ? (
                          <textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onBlur={() => handleSaveTextEdit(node.id)}
                            onKeyDown={(e) => {
                              playTypeKey();
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSaveTextEdit(node.id);
                              }
                            }}
                            className="w-full h-full bg-bg-void text-text-primary border border-cyan-primary/30 p-1 font-mono text-[12px] focus:outline-none focus:border-cyan-primary resize-none nocanvasdrag overflow-y-auto scrollbar-none"
                            autoFocus
                          />
                        ) : node.type === "link" ? (
                          <div className="space-y-1 select-none">
                            <p className="line-clamp-1 italic text-text-primary text-[12px]">
                              {node.content || "UNNAMED LINK"}
                            </p>
                            <a 
                              href={node.content?.startsWith("http") ? node.content : `https://${node.content}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan-primary hover:underline text-[12px] font-mono flex items-center gap-0.5 overflow-hidden text-ellipsis whitespace-nowrap nocanvasdrag"
                            >
                              <Link className="w-2.5 h-2.5" />
                              VISIT SITE
                            </a>
                          </div>
                        ) : node.content ? (
                          <FittedText
                            text={node.content}
                            className="font-share break-words text-[14px] leading-relaxed"
                          />
                        ) : (
                          <p className="font-share text-[14px] text-text-dim/40 italic">Empty node body</p>
                        )}
                      </div>

                      {/* Node Footer */}
                      <div className="flex justify-between items-center text-[12px] font-mono text-text-dim/50 border-t border-border-hairline/10 pt-1 mt-1 shrink-0 select-none">
                        <span>X: {Math.round(node.x)} Y: {Math.round(node.y)}</span>
                        <span>{node.type.toUpperCase()}</span>
                      </div>
                    </div>
                  </GlassPanel>

                  {/* Resize handle: bottom-right corner drag grip */}
                  <div
                    className="nocanvasdrag pointer-events-auto absolute -bottom-1 -right-1 w-4 h-4 flex items-end justify-end cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity z-20 text-cyan-primary/70 hover:text-cyan-primary"
                    title="Drag to resize"
                    onPointerDown={(e) => handleResizePointerDown(e, node.id)}
                  >
                    <MoveDiagonal2 className="w-3 h-3" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Empty Canvas Prompt */}
        {!activeCaseId ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-bg-void/70 backdrop-blur-sm pointer-events-auto z-40">
            <Network className="w-16 h-16 text-cyan-dim opacity-50 animate-hex-pulse-flicker mb-4" />
            <h3 className="font-orbitron text-base font-black text-cyan-text tracking-widest uppercase mb-1">
              <SplitText text="THE BELFRY DETECTIVE BOARD" delay={0.03} />
            </h3>
            <p className="text-[13px] font-share text-text-dim max-w-sm mb-4 leading-relaxed">
              Durable multi tracking canvas is currently locked. To map conspiratorial data, select or establish an active case file.
            </p>
            <button
              onClick={() => setShowNewCaseModal(true)}
              className="px-6 py-2 border border-cyan-primary/40 text-cyan-text hover:bg-cyan-primary hover:text-bg-void transition-colors text-xs font-black uppercase tracking-widest"
              style={{ clipPath: "polygon(0 0, 100% 0, 92% 100%, 0 100%)" }}
            >
              + NEW CASE DOSSIER
            </button>
          </div>
        ) : boardNodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 pointer-events-none select-none z-10">
            <Compass className="w-10 h-10 text-cyan-dim opacity-40 animate-spin-slow mb-3" />
            <h4 className="font-orbitron text-xs font-black text-text-dim tracking-widest uppercase">
              EMPTY WORKSPACE CANVAS
            </h4>
            <p className="text-[13px] font-share text-text-dim/60 max-w-xs mt-1 leading-normal">
              Right-click anywhere inside the grid to upload photo evidence, insert links, or drop quick-notes.
            </p>
          </div>
        ) : null}

        {/* --- CONTEXT MENUS --- */}
        <AnimatePresence>
          {bgMenu && (
            <ContextMenu x={bgMenu.x} y={bgMenu.y} onClose={() => setBgMenu(null)}>
              <button 
                onClick={() => handleContextAddNode("text", bgMenu.canvasX, bgMenu.canvasY)}
                onMouseEnter={() => playHoverEvidence()}
                className="w-full text-left p-1.5 hover:bg-cyan-primary/10 text-text-primary hover:text-cyan-text transition-colors flex items-center"
              >
                <FileText className="w-3.5 h-3.5 mr-2 text-cyan-dim" />
                ADD TEXT NOTE
              </button>
              <button 
                onClick={() => handleContextAddNode("photo", bgMenu.canvasX, bgMenu.canvasY)}
                onMouseEnter={() => playHoverEvidence()}
                className="w-full text-left p-1.5 hover:bg-cyan-primary/10 text-text-primary hover:text-cyan-text transition-colors flex items-center"
              >
                <Image className="w-3.5 h-3.5 mr-2 text-cyan-dim" />
                ADD PHOTO EVIDENCE
              </button>
              <button 
                onClick={() => handleContextAddNode("link", bgMenu.canvasX, bgMenu.canvasY)}
                onMouseEnter={() => playHoverEvidence()}
                className="w-full text-left p-1.5 hover:bg-cyan-primary/10 text-text-primary hover:text-cyan-text transition-colors flex items-center"
              >
                <Link className="w-3.5 h-3.5 mr-2 text-cyan-dim" />
                ADD WEB LINK
              </button>
              <button 
                onClick={() => handleContextAddNode("file", bgMenu.canvasX, bgMenu.canvasY)}
                onMouseEnter={() => playHoverEvidence()}
                className="w-full text-left p-1.5 hover:bg-cyan-primary/10 text-text-primary hover:text-cyan-text transition-colors flex items-center"
              >
                <File className="w-3.5 h-3.5 mr-2 text-cyan-dim" />
                ADD DATA FILE
              </button>
              <div className="border-t border-border-hairline/10 my-1" />
              <button 
                onClick={handleCenterView}
                onMouseEnter={() => playHoverEvidence()}
                className="w-full text-left p-1.5 hover:bg-cyan-primary/10 text-text-primary hover:text-cyan-text transition-colors flex items-center font-mono text-[12px]"
              >
                <Compass className="w-3.5 h-3.5 mr-2 text-cyan-dim" />
                CENTER CANVAS
              </button>
            </ContextMenu>
          )}

          {nodeMenu && (
            <ContextMenu x={nodeMenu.x} y={nodeMenu.y} onClose={() => setNodeMenu(null)}>
              <button 
                onClick={() => {
                  setLinkingFromId(nodeMenu.nodeId);
                  setNodeMenu(null);
                  addLog("SELECT SECOND NODE TO COMPLETE ASSOCIATION LINKAGE", "info", "BOARD");
                }}
                onMouseEnter={() => playHoverEvidence()}
                className="w-full text-left p-1.5 hover:bg-cyan-primary/10 text-text-primary hover:text-cyan-text transition-colors flex items-center"
              >
                <Link2 className="w-3.5 h-3.5 mr-2 text-cyan-dim" />
                CONNECT TO CLUE...
              </button>
              {boardNodes.find(n => n.id === nodeMenu.nodeId)?.type === "text" && (
                <button 
                  onClick={() => {
                    const node = boardNodes.find(n => n.id === nodeMenu.nodeId);
                    if (node) {
                      setEditingNodeId(node.id);
                      setEditingText(node.content);
                    }
                    setNodeMenu(null);
                  }}
                  onMouseEnter={() => playHoverEvidence()}
                  className="w-full text-left p-1.5 hover:bg-cyan-primary/10 text-text-primary hover:text-cyan-text transition-colors flex items-center"
                >
                  <FileText className="w-3.5 h-3.5 mr-2 text-cyan-dim" />
                  EDIT CONTENT
                </button>
              )}
              <div className="border-t border-border-hairline/10 my-1" />
              <button 
                onClick={() => {
                  deleteEvidenceNode(nodeMenu.nodeId);
                  setNodeMenu(null);
                  playUnpinTear();
                }}
                onMouseEnter={() => playHoverEvidence()}
                className="w-full text-left p-1.5 hover:bg-red-threat/20 text-red-threat transition-colors flex items-center"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2 text-red-threat" />
                DELETE CLUE CARD
              </button>
            </ContextMenu>
          )}

          {connMenu && (
            <ContextMenu x={connMenu.x} y={connMenu.y} onClose={() => setConnMenu(null)}>
              <button 
                onClick={() => {
                  const conn = boardConnections.find(c => c.id === connMenu.connId);
                  if (conn) {
                    setLabelingConnId(conn.id);
                    setConnLabel(conn.label || "");
                  }
                  setConnMenu(null);
                }}
                className="w-full text-left p-1.5 hover:bg-cyan-primary/10 text-text-primary hover:text-cyan-text transition-colors flex items-center"
              >
                <FileText className="w-3.5 h-3.5 mr-2 text-cyan-dim" />
                LABEL CORRELATION
              </button>
              <div className="border-t border-border-hairline/10 my-1" />
              <button 
                onClick={() => {
                  deleteEvidenceConnection(connMenu.connId);
                  setConnMenu(null);
                  playUnlinkConnection();
                }}
                className="w-full text-left p-1.5 hover:bg-red-threat/20 text-red-threat transition-colors flex items-center"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2 text-red-threat" />
                SEVER CONNECTION
              </button>
            </ContextMenu>
          )}
        </AnimatePresence>

        {/* --- OVERLAYS / FORMS / MODALS --- */}
        {showAddForm && (
          <div className="absolute inset-0 bg-bg-void/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 pointer-events-auto">
            <GlassPanel className={`p-4 max-w-sm w-full origin-top ${prefersReducedMotion ? "" : "animate-clip-reveal"}`} clipSize="md" showCornerTicks={true}>
              <div className="flex justify-between items-center border-b border-border-hairline/25 pb-2 mb-3">
                <h3 className="font-orbitron text-xs font-black tracking-widest text-cyan-text flex items-center uppercase">
                  ADD {formType} CLUE CARD
                </h3>
                <button onClick={() => setShowAddForm(false)} className="text-text-dim hover:text-text-primary">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[12px] font-mono text-text-dim/75 tracking-wider uppercase mb-1">CARD TITLE / IDENTIFIER</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. GLYPH CORRELATION"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full bg-bg-void/80 border border-border-hairline/30 p-2 text-text-primary rounded-sm font-sans focus:outline-none focus:border-cyan-primary"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-mono text-text-dim/75 tracking-wider uppercase mb-1">
                    {formType === "link" ? "URL ADDRESS" : "CARD DESCRIPTION / RAW CONTENT"}
                  </label>
                  <textarea
                    required
                    placeholder={formType === "link" ? "www.domain.com/arg-leads" : "Paste recovered cipher fragments, text codes or descriptions."}
                    rows={4}
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    className="w-full bg-bg-void/80 border border-border-hairline/30 p-2 text-text-primary rounded-sm font-mono focus:outline-none focus:border-cyan-primary resize-none"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-1.5 text-[13px] uppercase font-bold text-text-dim hover:text-text-primary transition-colors"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 border border-cyan-primary/40 text-cyan-text hover:bg-cyan-primary hover:text-bg-void transition-colors text-[13px] font-black uppercase tracking-widest"
                    style={{ clipPath: "polygon(0 0, 100% 0, 92% 100%, 0 100%)" }}
                  >
                    DEPLOY NODE
                  </button>
                </div>
              </form>
            </GlassPanel>
          </div>
        )}

      {/* Evidence Detail Modal */}
      <AnimatePresence>
        {detailNode && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-bg-void/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-hidden"
            >
              <GlassPanel className="flex flex-col h-full bg-bg-panel/95" clipSize="md">
                <div className="flex justify-between items-center p-4 border-b border-border-hairline/20">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-cyan-primary/10 rounded-sm">
                      {React.createElement(getNodeIcon(detailNode.type), { className: "w-5 h-5 text-cyan-primary" })}
                    </div>
                    <div>
                      {renamingNodeId === detailNode.id ? (
                        <input
                          autoFocus
                          value={renamingTitle}
                          onChange={(e) => setRenamingTitle(e.target.value)}
                          onBlur={() => commitRename(detailNode.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); commitRename(detailNode.id); }
                            if (e.key === "Escape") { e.preventDefault(); setRenamingNodeId(null); }
                          }}
                          className="font-orbitron text-base font-black text-cyan-text tracking-widest uppercase bg-bg-void/60 border border-cyan-primary/40 outline-none px-2 py-0.5"
                        />
                      ) : (
                        <div className="flex items-center space-x-2">
                          <h2 className="font-orbitron text-base font-black text-cyan-text tracking-widest uppercase">
                            {detailNode.title}
                          </h2>
                          <button
                            title="Rename evidence"
                            onClick={() => startRenaming(detailNode)}
                            className="p-1 hover:bg-cyan-primary/20 text-cyan-dim hover:text-cyan-text rounded transition-all"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      <span className="font-mono text-[13px] text-text-dim">
                        ID: {detailNode.id} // TYPE: {detailNode.type.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setDetailNodeId(null);
                      playCloseFile();
                    }}
                    className="p-1 hover:bg-red-threat/20 text-text-dim hover:text-red-threat rounded transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 hud-scrollbar">
                  {/* Visual Content Preview */}
                  {detailNode.type === "photo" && detailNode.content && (
                    <div className="w-full aspect-video bg-bg-void/40 border border-border-hairline/20 rounded-sm overflow-hidden flex items-center justify-center relative">
                      <img 
                        src={detailNode.content} 
                        alt={detailNode.title} 
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

                  {detailNode.type === "text" && (
                    <div className="space-y-2">
                      <label className="text-[13px] font-orbitron font-bold text-cyan-dim uppercase tracking-widest">Text Content</label>
                      <div className="bg-bg-void/40 border border-border-hairline/20 p-4 rounded-sm font-share text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
                        {detailNode.content}
                      </div>
                    </div>
                  )}

                  {detailNode.type === "link" && (
                    <div className="space-y-2">
                      <label className="text-[13px] font-orbitron font-bold text-cyan-dim uppercase tracking-widest">Source Link</label>
                      <a 
                        href={detailNode.content} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center space-x-2 bg-bg-void/40 border border-border-hairline/20 p-4 rounded-sm text-cyan-text hover:bg-cyan-primary/10 transition-all truncate"
                      >
                        <Link className="w-4 h-4 shrink-0" />
                        <span className="truncate">{detailNode.content}</span>
                      </a>
                    </div>
                  )}

                  {/* Evidence Notes (Persisted) */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-[13px] font-orbitron font-bold text-cyan-dim uppercase tracking-widest flex items-center">
                        <FileText className="w-3.5 h-3.5 mr-1.5" />
                        ANALYST NOTES
                      </label>
                      <span className="text-[12px] font-mono text-text-dim italic">PERSISTED TO LOCAL ARCHIVE</span>
                    </div>
                    <textarea
                      value={detailNode.notes}
                      onChange={(e) => {
                        updateEvidenceNodeNotes(detailNode.id, e.target.value);
                        playTypeKey();
                      }}
                      placeholder="Enter field notes, observations, or hypotheses..."
                      className="w-full h-48 bg-bg-void/60 border border-border-hairline/30 p-4 rounded-sm font-share text-sm text-text-primary focus:outline-none focus:border-cyan-primary/50 transition-all resize-none placeholder:text-text-dim/30"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <span className="text-[12px] font-mono text-text-dim uppercase tracking-tighter">COORDINATES</span>
                      <div className="text-[13px] font-mono text-cyan-text/70 bg-bg-void/20 p-1 border border-border-hairline/10">
                        X: {Math.round(detailNode.x)} | Y: {Math.round(detailNode.y)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[12px] font-mono text-text-dim uppercase tracking-tighter">CARD SIZE</span>
                      <div className="flex items-center space-x-1 text-[13px] font-mono text-cyan-text/70 bg-bg-void/20 p-1 border border-border-hairline/10">
                        <input
                          type="number"
                          min={MIN_NODE_WIDTH}
                          max={MAX_NODE_WIDTH}
                          value={getNodeSize(detailNode).width}
                          onChange={(e) => updateEvidenceNodeContent(detailNode.id, { width: Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, Number(e.target.value) || MIN_NODE_WIDTH)) })}
                          className="w-14 bg-transparent outline-none"
                        />
                        <span>×</span>
                        <input
                          type="number"
                          min={MIN_NODE_HEIGHT}
                          max={MAX_NODE_HEIGHT}
                          value={getNodeSize(detailNode).height}
                          onChange={(e) => updateEvidenceNodeContent(detailNode.id, { height: Math.min(MAX_NODE_HEIGHT, Math.max(MIN_NODE_HEIGHT, Number(e.target.value) || MIN_NODE_HEIGHT)) })}
                          className="w-14 bg-transparent outline-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[12px] font-mono text-text-dim uppercase tracking-tighter">TIMESTAMP</span>
                      <div className="text-[13px] font-mono text-cyan-text/70 bg-bg-void/20 p-1 border border-border-hairline/10">
                        {new Date(detailNode.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-border-hairline/20 flex justify-end">
                  <button
                    onClick={() => {
                      setDetailNodeId(null);
                      playCloseFile();
                    }}
                    className="px-6 py-2 bg-cyan-primary text-bg-void text-xs font-black tracking-widest font-orbitron uppercase hover:bg-white transition-all"
                    style={{ clipPath: "polygon(0 0, 100% 0, 92% 100%, 0 100%)" }}
                  >
                    CLOSE EVIDENCE
                  </button>
                </div>
              </GlassPanel>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

        {/* Label Connection Overlay */}
        {labelingConnId && (
          <div className="absolute inset-0 bg-bg-void/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 pointer-events-auto">
            <GlassPanel className={`p-4 max-w-sm w-full origin-top ${prefersReducedMotion ? "" : "animate-clip-reveal"}`} clipSize="md" showCornerTicks={true}>
              <div className="flex justify-between items-center border-b border-border-hairline/25 pb-2 mb-3">
                <h3 className="font-orbitron text-xs font-black tracking-widest text-cyan-text flex items-center uppercase">
                  LABEL ASSOCIATION CORRELATION
                </h3>
                <button onClick={() => setLabelingConnId(null)} className="text-text-dim hover:text-text-primary">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveConnLabel} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[12px] font-mono text-text-dim/75 tracking-wider uppercase mb-1">CORRELATION LABEL / LINKING VECTOR</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. DECRYPTED BY SAME KEY / CORRESPONDENT"
                    value={connLabel}
                    onChange={(e) => setConnLabel(e.target.value)}
                    className="w-full bg-bg-void/80 border border-border-hairline/30 p-2 text-text-primary rounded-sm font-sans focus:outline-none focus:border-cyan-primary"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setLabelingConnId(null)}
                    className="px-3 py-1.5 text-[13px] uppercase font-bold text-text-dim hover:text-text-primary transition-colors"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 border border-cyan-primary/40 text-cyan-text hover:bg-cyan-primary hover:text-bg-void transition-colors text-[13px] font-black uppercase tracking-widest"
                    style={{ clipPath: "polygon(0 0, 100% 0, 92% 100%, 0 100%)" }}
                  >
                    APPLY LABEL
                  </button>
                </div>
              </form>
            </GlassPanel>
          </div>
        )}

        {/* Create Case Modal Dialog */}
        {showNewCaseModal && (
          <div className="absolute inset-0 bg-bg-void/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 pointer-events-auto">
            <GlassPanel className={`p-4 max-w-sm w-full origin-top ${prefersReducedMotion ? "" : "animate-clip-reveal"}`} clipSize="md" showCornerTicks={true}>
              <div className="flex justify-between items-center border-b border-border-hairline/25 pb-2 mb-3">
                <h3 className="font-orbitron text-xs font-black tracking-widest text-cyan-text flex items-center uppercase">
                  INITIATE NEW INVESTIGATION
                </h3>
                <button onClick={() => setShowNewCaseModal(false)} className="text-text-dim hover:text-text-primary">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateCase} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[12px] font-mono text-text-dim/75 tracking-wider uppercase mb-1">CASE IDENTIFIER TITLE</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. RED-SQUARE SIGNAL DECRYPTION"
                    value={newCaseTitle}
                    onChange={(e) => setNewCaseTitle(e.target.value)}
                    className="w-full bg-bg-void/80 border border-border-hairline/30 p-2 text-text-primary rounded-sm font-sans focus:outline-none focus:border-cyan-primary"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-mono text-text-dim/75 tracking-wider uppercase mb-1">SYNOPSIS INTEL BRIEFING</label>
                  <textarea
                    required
                    placeholder="Outline the core mysteries, sources, or links for this solving thread."
                    rows={4}
                    value={newCaseSynopsis}
                    onChange={(e) => setNewCaseSynopsis(e.target.value)}
                    className="w-full bg-bg-void/80 border border-border-hairline/30 p-2 text-text-primary rounded-sm font-sans focus:outline-none focus:border-cyan-primary resize-none"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewCaseModal(false)}
                    className="px-3 py-1.5 text-[13px] uppercase font-bold text-text-dim hover:text-text-primary transition-colors"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 border border-cyan-primary/40 text-cyan-text hover:bg-cyan-primary hover:text-bg-void transition-colors text-[13px] font-black uppercase tracking-widest"
                    style={{ clipPath: "polygon(0 0, 100% 0, 92% 100%, 0 100%)" }}
                  >
                    BOOT CASE FILE
                  </button>
                </div>
              </form>
            </GlassPanel>
          </div>
        )}
        </div>
      </div>
    )}
  </AnimatePresence>
  );
}

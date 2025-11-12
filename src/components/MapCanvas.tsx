import { useState, useRef, useEffect } from "react";
import { MapData, InteractiveElement, ElementType } from "@/types/world";
import { MapPin, User, Skull, Package, Coins, Maximize2 } from "lucide-react";

interface MapCanvasProps {
  map: MapData;
  onElementClick?: (element: InteractiveElement) => void;
  onCanvasClick?: (x: number, y: number) => void;
  mode: "view" | "edit" | "manage";
  hiddenElements?: string[];
  showLabels?: boolean;
}

const getElementIcon = (type: ElementType) => {
  switch (type) {
    case "portal": return Maximize2;
    case "npc": return User;
    case "enemy": return Skull;
    case "item": return Package;
    case "loot": return Coins;
    default: return MapPin;
  }
};

const getElementColor = (type: ElementType) => {
  switch (type) {
    case "portal": return "text-primary";
    case "npc": return "text-blue-400";
    case "enemy": return "text-red-400";
    case "item": return "text-purple-400";
    case "loot": return "text-yellow-400";
    default: return "text-foreground";
  }
};

export const MapCanvas = ({
  map,
  onElementClick,
  onCanvasClick,
  mode,
  hiddenElements = [],
  showLabels = false
}: MapCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgRect, setImgRect] = useState<DOMRect | null>(null);
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const updateRects = () => {
      if (containerRef.current) setContainerRect(containerRef.current.getBoundingClientRect());
      if (imgRef.current) setImgRect(imgRef.current.getBoundingClientRect());
    };
    updateRects();
    window.addEventListener("resize", updateRects);
    window.addEventListener("scroll", updateRects, true);
    return () => {
      window.removeEventListener("resize", updateRects);
      window.removeEventListener("scroll", updateRects, true);
    };
  }, [map.imageUrl]);

  const handleImageLoad = () => {
    if (containerRef.current && imgRef.current) {
      setContainerRect(containerRef.current.getBoundingClientRect());
      setImgRect(imgRef.current.getBoundingClientRect());
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== "edit" || !onCanvasClick) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onCanvasClick(x, y);
  };

  const elementsList = Array.isArray(map.elements) ? map.elements : [];
  const visibleElements = elementsList.filter(
    el => el.visible !== false && !hiddenElements.includes(el.id)
  );

  const computePositionStyle = (el: InteractiveElement) => {
    // If we have the image rect, position relative to the visible image
    if (imgRect && containerRect) {
      const imgLeft = imgRect.left - containerRect.left;
      const imgTop = imgRect.top - containerRect.top;
      const leftPx = imgLeft + (imgRect.width * (el.x / 100));
      const topPx = imgTop + (imgRect.height * (el.y / 100));
      return {
        left: `${leftPx}px`,
        top: `${topPx}px`,
      } as React.CSSProperties;
    }
    // fallback: percent relative to container
    return {
      left: `${el.x}%`,
      top: `${el.y}%`,
    } as React.CSSProperties;
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-muted rounded-lg overflow-hidden"
      onClick={handleCanvasClick}
      style={{ cursor: mode === "edit" ? "crosshair" : "default" }}
    >
      <img
        ref={(r) => (imgRef.current = r)}
        src={map.imageUrl}
        alt={map.name}
        className="w-full h-full object-contain"
        draggable={false}
        onLoad={handleImageLoad}
      />

      {visibleElements.map((element) => {
        const Icon = getElementIcon(element.type);
        const colorClass = getElementColor(element.type);
        const posStyle = computePositionStyle(element);

        return (
          <button
            key={element.id}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 
              ${colorClass} transition-all duration-200 hover:scale-125
              ${mode === "manage" ? "cursor-move" : "cursor-pointer"}
              drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]`}
            style={posStyle}
            onClick={(e) => {
              e.stopPropagation();
              onElementClick?.(element);
            }}
          >
            <div className="relative">
              <Icon className="w-8 h-8 animate-glow-pulse" />
              {(showLabels || mode !== "view") && (
                <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 
                  bg-background/90 px-2 py-1 rounded text-xs whitespace-nowrap
                  border border-border">
                  {element.name}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
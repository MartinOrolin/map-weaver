import React, { useState } from "react";
import { InteractiveElement, Player, MapData } from "@/types/world";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreatureImageUpload } from "@/components/ImageUpload";

interface CreatureRow {
  id: string;
  name: string;
  source: "element" | "player";
  payload: InteractiveElement | Player;
}

interface CreaturesProps {
  worldId: string;
  map: MapData;
  players: Player[] | undefined;
  onUpdateElement: (el: InteractiveElement) => Promise<void>;
  onUpdatePlayer: (pl: Player) => Promise<void>;
  onDeleteElement?: (id: string) => Promise<void>;
  onDeletePlayer?: (id: string) => Promise<void>;
  mode?: "edit" | "manage";
}

export const Creatures = ({ 
  worldId, 
  map, 
  players = [], 
  onUpdateElement, 
  onUpdatePlayer, 
  onDeleteElement, 
  onDeletePlayer,
  mode = "manage"
}: CreaturesProps) => {
  const elements = Array.isArray(map.elements) ? map.elements : [];
  const creatureElements = elements.filter(e => e.type === "npc" || e.type === "enemy");
  const mapPlayers = (players || []).filter(p => !p.mapId || p.mapId === map.id);

  const rows: CreatureRow[] = [
    ...creatureElements.map(e => ({ id: e.id, name: e.name, source: "element" as const, payload: e })),
    ...mapPlayers.map(p => ({ id: p.id, name: p.name, source: "player" as const, payload: p })),
  ];

  const [editing, setEditing] = useState<Record<string, { hp_current?: number; hp_bonus?: number }>>({});

  const startEdit = (r: CreatureRow) => {
    setEditing(prev => ({ ...prev, [r.id]: { hp_current: (r.payload as any).hp_current ?? 0, hp_bonus: (r.payload as any).hp_bonus ?? 0 } }));
  };

  const cancelEdit = (id: string) => {
    setEditing(prev => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
  };

  const saveEdit = async (r: CreatureRow) => {
    const ed = editing[r.id];
    if (!ed) return;
    if (r.source === "element") {
      const payload = { ...(r.payload as InteractiveElement), hp_current: ed.hp_current, hp_bonus: ed.hp_bonus };
      await onUpdateElement(payload);
    } else {
      const payload = { ...(r.payload as Player), hp_current: ed.hp_current, hp_bonus: ed.hp_bonus };
      await onUpdatePlayer(payload);
    }
    cancelEdit(r.id);
  };

  const handleImageUploaded = async (r: CreatureRow, imageUrl: string) => {
    if (r.source === "element") {
      const payload = { ...(r.payload as InteractiveElement), imageUrl };
      await onUpdateElement(payload);
    }
  };

  if (rows.length === 0) {
    return <div className="mt-4 text-sm text-muted-foreground">No creatures or players on this map.</div>;
  }

  return (
    <div className="mt-4 p-4 bg-card border border-border rounded-lg">
      <h3 className="text-lg font-semibold mb-3">Creatures & Players</h3>
      <div className="space-y-2">
        {rows.map(r => {
          const ed = editing[r.id];
          const isCreature = r.source === "element" && ((r.payload as InteractiveElement).type === "npc" || (r.payload as InteractiveElement).type === "enemy");
          
          return (
            <div key={r.id} className="flex items-center justify-between p-2 bg-muted rounded">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.source === "player" ? "Player" : (r.payload as any).type}</div>
              </div>
              <div className="flex items-center gap-2">
                {ed ? (
                  <>
                    <Input
                        type="number"
                        min={0}
                        max={(r.payload as any).hp_max}
                        value={ed.hp_current ?? 0}
                        onChange={(e) => {
                          const max = (r.payload as any).hp_max ?? Infinity;
                          const value = Math.min(Number(e.target.value), max);
                          setEditing(prev => ({
                            ...prev,
                            [r.id]: { ...prev[r.id], hp_current: value }
                          }));
                        }}
                        className="w-20"
                    />
                    <div className="text-sm">/ {(r.payload as any).hp_max ?? "-"} + </div>
                    <Input type="number" value={ed.hp_bonus ?? 0} onChange={(e) => setEditing(prev => ({ ...prev, [r.id]: { ...prev[r.id], hp_bonus: Number(e.target.value) } }))} className="w-20" />
                    <Button onClick={() => saveEdit(r)} className="px-3">Save</Button>
                    <Button variant="outline" onClick={() => cancelEdit(r.id)} className="px-2">Cancel</Button>
                  </>
                ) : (
                  <>
                    <div className="text-sm">AC: {(r.payload as any).ac ?? "-"}</div>
                    <div className="text-sm">
                      HP: {(r.payload as any).hp_current ?? "-"} / {(r.payload as any).hp_max ?? "-"}
                    </div>
                    <div className="text-sm">+ {(r.payload as any).hp_bonus ?? "-"}</div>
                    <Button onClick={() => startEdit(r)} className="ml-2">Edit</Button>
                    
                    {/* Show image upload button for NPCs/Enemies in edit mode */}
                    {mode === "edit" && isCreature && (
                      <CreatureImageUpload
                        worldId={worldId}
                        elementId={r.id}
                        currentImageUrl={(r.payload as any).imageUrl}
                        onImageUploaded={(url) => handleImageUploaded(r, url)}
                      />
                    )}
                    
                    {r.source === "element" && onDeleteElement && <Button variant="destructive" size="icon" onClick={async () => onDeleteElement(r.id)}>Del</Button>}
                    {r.source === "player" && onDeletePlayer && <Button variant="destructive" size="icon" onClick={async () => onDeletePlayer(r.id)}>Del</Button>}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
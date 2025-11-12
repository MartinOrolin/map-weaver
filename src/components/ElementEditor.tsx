import { useState, useEffect } from "react";
import { InteractiveElement, ElementType, MapData, Player } from "@/types/world";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2 } from "lucide-react";

interface ElementEditorProps {
  element: InteractiveElement | Player | null;
  open: boolean;
  onClose: () => void;
  onSave: (item: InteractiveElement | Player) => void;
  onDelete?: (id: string) => void;
  maps: MapData[];
  players: Player[];
  mode: "element" | "player";
}

export const ElementEditor = ({ 
  element, 
  open, 
  onClose, 
  onSave, 
  onDelete,
  maps,
  players,
  mode
}: ElementEditorProps) => {
  const [formData, setFormData] = useState<InteractiveElement | Player | null>(null);

  useEffect(() => {
    if (element) {
      setFormData(element);
    } else {
      setFormData(null);
    }
  }, [element]);

  if (!formData) return null;

  const isPlayer = (formData as any).type === "player";
  const isCreature = (formData as any).type === "npc" || (formData as any).type === "enemy" || isPlayer;

  const handleNumberChange = (key: keyof Player | keyof InteractiveElement, value: string) => {
    const num = value === "" ? undefined : Number(value);
    setFormData({ ...(formData as any), [key]: num } as any);
  };

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  const handleDelete = () => {
    if (onDelete && (formData as any).id) {
      onDelete((formData as any).id);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "player" ? "Edit Player" : isPlayer ? "Edit Player Reference" : "Edit Interactive Element"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="element-name">Name</Label>
            <Input
              id="element-name"
              value={(formData as any).name || ""}
              onChange={(e) => setFormData({ ...(formData as any), name: e.target.value } as any)}
            />
          </div>

          {/* Type selection (only in element mode) */}
          {mode === "element" && (
            <div>
              <Label htmlFor="element-type">Type</Label>
              <Select
                value={(formData as any).type as any}
                onValueChange={(value: any) => 
                  setFormData({ ...(formData as any), type: value } as any)
                }
              >
                <SelectTrigger id="element-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portal">Portal (Zoom In)</SelectItem>
                  <SelectItem value="npc">NPC</SelectItem>
                  <SelectItem value="enemy">Enemy</SelectItem>
                  <SelectItem value="item">Item</SelectItem>
                  <SelectItem value="loot">Loot</SelectItem>
                  <SelectItem value="player">Player</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Portal target selection */}
          {mode === "element" && (formData as any).type === "portal" && (
            <div>
              <Label htmlFor="target-map">Target Map</Label>
              <Select
                value={(formData as any).targetMapId || ""}
                onValueChange={(value) => 
                  setFormData({ ...(formData as any), targetMapId: value } as any)
                }
              >
                <SelectTrigger id="target-map">
                  <SelectValue placeholder="Select destination map" />
                </SelectTrigger>
                <SelectContent>
                  {maps.map((map) => (
                    <SelectItem key={map.id} value={map.id}>
                      {map.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Player reference dropdown (element mode only) */}
          {mode === "element" && (formData as any).type === "player" && (
            <div>
              <Label htmlFor="player-select">Select Existing Player</Label>
              <Select
                value={(formData as any).playerId || ""}
                onValueChange={(value) =>
                  setFormData({ ...(formData as any), playerId: value } as any)
                }
              >
                <SelectTrigger id="player-select">
                  <SelectValue placeholder="Choose a player" />
                </SelectTrigger>
                <SelectContent>
                  {players.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Player stats (player mode OR creature types in element mode) */}
          {(mode === "player" || (isCreature && !isPlayer)) && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>HP Max</Label>
                  <Input type="number" value={(formData as any).hp_max ?? ""} onChange={(e) => handleNumberChange("hp_max", e.target.value)} />
                </div>
                <div>
                  <Label>HP Current</Label>
                  <Input type="number" value={(formData as any).hp_current ?? ""} onChange={(e) => handleNumberChange("hp_current", e.target.value)} />
                </div>
                <div>
                  <Label>HP Bonus</Label>
                  <Input type="number" value={(formData as any).hp_bonus ?? ""} onChange={(e) => handleNumberChange("hp_bonus", e.target.value)} />
                </div>
                <div>
                  <Label>AC</Label>
                  <Input type="number" value={(formData as any).ac ?? ""} onChange={(e) => handleNumberChange("ac", e.target.value)} />
                </div>
              </div>
            </>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="visible">Visible to Players</Label>
            <Switch
              id="visible"
              checked={(formData as any).visible ?? true}
              onCheckedChange={(checked) => 
                setFormData({ ...(formData as any), visible: checked } as any)
              }
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1">
              Save
            </Button>
            {onDelete && (
              <Button 
                onClick={handleDelete} 
                variant="destructive"
                size="icon"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
export type ElementType = "portal" | "npc" | "enemy" | "item" | "loot" | "player";

export interface InteractiveElement {
  id: string;
  worldId?: string;
  mapId?: string;
  type: Exclude<ElementType, "player">;
  name: string;
  x: number;
  y: number;
  visible?: boolean;
  // optional combat fields for npc/enemy
  hp_max?: number;
  hp_current?: number;
  hp_bonus?: number;
  ac?: number;
  // portal specific
  targetMapId?: string;
  // creature image (for npc/enemy)
  imageUrl?: string;
}

export interface Player {
  id: string;
  worldId: string;
  mapId?: string | null;
  type: "player";
  name: string;
  hp_max?: number;
  hp_current?: number;
  hp_bonus?: number;
  ac?: number;
  visible?: boolean;
}

export interface MapData {
  id: string;
  worldId: string;
  name?: string;
  imageUrl?: string;
  level?: number;
  parentMapId?: string | null;
  elements?: InteractiveElement[];
  musicUrl?: string;
}

export interface World {
  id: string;
  name?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  rootMapId?: string | null;
  players?: Player[];
}

export interface WorldConfig {
  world: World;
  maps: MapData[];
}
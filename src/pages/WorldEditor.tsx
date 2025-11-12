import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { storage } from "@/lib/storage";
import { World, MapData, InteractiveElement, Player } from "@/types/world";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MapUpload } from "@/components/MapUpload";
import { MapCanvas } from "@/components/MapCanvas";
import { ElementEditor } from "@/components/ElementEditor";
import { MapNavigator } from "@/components/MapNavigator";
import { Creatures } from "@/components/Creatures";
import { useToast } from "@/hooks/use-toast";
import { broadcastManager } from "@/lib/broadcast";

const WorldEditor = () => {
  const { worldId } = useParams<{ worldId: string }>();
  const [world, setWorld] = useState<World | null>(null);
  const [maps, setMaps] = useState<MapData[]>([]);
  const [currentMap, setCurrentMap] = useState<MapData | null>(null);
  const [selectedElement, setSelectedElement] = useState<InteractiveElement | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [playerEditorOpen, setPlayerEditorOpen] = useState(false);
  const [playerEditing, setPlayerEditing] = useState<Player | null>(null);
  

  useEffect(() => {
    if (!worldId) return;
    let mounted = true;
    (async () => {
      try {
        await storage.init();
        if (!mounted) return;
        await loadWorldData();
      } catch (e) {
        console.error("WorldEditor init failed", e);
      }
    })();
    return () => { mounted = false; };
  }, [worldId]);

  const loadWorldData = async () => {
    if (!worldId) return;
    const loadedWorld = storage.getWorld(worldId);
    setWorld(loadedWorld);

    const loadedMaps = storage.getMapsForWorld(worldId);
    setMaps(loadedMaps);

    // choose default map (root or first)
    const firstIndex = loadedMaps.find(m => m.level === 0) || loadedMaps[0] || null;
    if (!firstIndex) {
      setCurrentMap(null);
      return;
    }
    const full = await storage.ensureMapLoaded(worldId, firstIndex.id);
    setCurrentMap(full || firstIndex);
  };

  // helper to select a map (ensures full map loaded)
  const selectMap = async (mapId: string | null) => {
    if (!worldId || !mapId) {
      setCurrentMap(null);
      return;
    }
    const full = await storage.ensureMapLoaded(worldId, mapId);
    setCurrentMap(full ?? storage.getMap(worldId, mapId));
  };

  const handleMapCreated = async (map: MapData) => {
    await loadWorldData();
    await selectMap(map.id);
    broadcastManager.broadcast({ type: 'map_update', worldId: worldId!, mapId: map.id });
  };

  const handleMapDeleted = async (mapId: string) => {
    await loadWorldData();
    const remaining = storage.getMapsForWorld(worldId!);
    const fallback = remaining.length > 0 ? await storage.ensureMapLoaded(worldId!, remaining[0].id) ?? remaining[0] : null;
    setCurrentMap(fallback);
  };

  const handleAddPlayerClick = () => {
    const newPlayer: Player = {
      id: `player_${Date.now()}`,
      worldId: worldId!,
      mapId: currentMap ? currentMap.id : undefined,
      type: "player",
      name: "New Player",
      hp_max: 10,
      hp_current: 10,
      hp_bonus: 0,
      ac: 10,
      visible: true,
    };
    setPlayerEditing(newPlayer);
    setPlayerEditorOpen(true);
  };

  const handlePlayerSave = async (p: Player) => {
    if (!worldId) return;
    await storage.addPlayer(worldId, p);
    // refresh world and maps
    const w = storage.getWorld(worldId);
    setWorld(w);
    setMaps(storage.getMapsForWorld(worldId));
    broadcastManager.broadcast({ type: "player_update", worldId, playerId: p.id });
  };

  const handlePlayerDelete = async (playerId: string) => {
  if (!worldId) return;
  await storage.deletePlayer(worldId, playerId);
  const updatedWorld = storage.getWorld(worldId);
  setWorld(updatedWorld);

  // Refresh map if the deleted player was on it
  if (currentMap) {
    const updatedMap = await storage.ensureMapLoaded(worldId, currentMap.id);
    if (updatedMap) setCurrentMap(updatedMap);
  }

  broadcastManager.broadcast({ type: "player_deleted", worldId, playerId });
};

  const handleCanvasClick = (x: number, y: number) => {
    if (!currentMap || !worldId) return;

    const newElement: InteractiveElement = {
      id: `element_${Date.now()}`,
      type: "portal",
      name: "New Element",
      x,
      y,
      visible: true,
    };

    setSelectedElement(newElement);
    setEditorOpen(true);
  };

  const handleElementClick = (element: InteractiveElement) => {
    setSelectedElement(element);
    setEditorOpen(true);
  };

  const handleElementSave = async (element: InteractiveElement) => {
    if (!worldId || !currentMap) return;

    await storage.updateElement(worldId, currentMap.id, element);
    // refresh index + full map after save
    setMaps(storage.getMapsForWorld(worldId));
    const updated = await storage.ensureMapLoaded(worldId, currentMap.id);
    if (updated) setCurrentMap(updated);

    broadcastManager.broadcast({ 
      type: 'element_update', 
      worldId, 
      mapId: currentMap.id, 
      elementId: element.id 
    });

    toast({
      title: "Element saved",
      description: `${element.name} has been updated`,
    });
  };

  const handleElementDelete = async (elementId: string) => {
    if (!worldId || !currentMap) return;

    await storage.deleteElement(worldId, currentMap.id, elementId);
    setMaps(storage.getMapsForWorld(worldId));
    const updated = await storage.ensureMapLoaded(worldId, currentMap.id);
    if (updated) setCurrentMap(updated);

    broadcastManager.broadcast({ 
      type: 'element_update', 
      worldId, 
      mapId: currentMap.id, 
      elementId 
    });

    toast({
      title: "Element deleted",
      description: "The element has been removed",
    });
  };

  const handleClick = () => {
    navigate(`/world/${worldId}/manage`);
    window.open(`/world/${worldId}/view`, '_blank');
  };

  if (!world) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/")}
              className="border-border"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-primary">{world.name}</h1>
              {world.description && (
                <p className="text-sm text-muted-foreground">{world.description}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClick}
            >
              Play
            </Button>
            <Button
              variant="outline"
              onClick={()=>navigate(`/world/${worldId}/manage`)}
            >
              Manage
            </Button>
          </div>
        </div>
      </header>

      <main className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
              <MapNavigator 
                maps={maps}
                currentMap={currentMap}
                onMapSelect={(m) => void selectMap(m.id)}
                onMapDelete={handleMapDeleted}
              />
              <div className="mt-4 flex items-center gap-2">
                <MapUpload 
                  worldId={worldId!}
                  parentMapId={currentMap?.id}
                  onMapCreated={handleMapCreated}
                />
                <Button onClick={handleAddPlayerClick}>Add player</Button>
              </div>
            </div>

            <div className="lg:col-span-3">
              {currentMap ? (
                <div className="h-[calc(100vh-200px)]">
                  <div className="mb-4">
                    <h2 className="text-2xl font-bold text-foreground">
                      {currentMap.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Click on the map to place interactive elements
                    </p>
                  </div>
                  <MapCanvas
                    map={currentMap}
                    mode="edit"
                    onCanvasClick={handleCanvasClick}
                    onElementClick={handleElementClick}
                  />

                  <Creatures
                    worldId={worldId!}
                    map={currentMap}
                    players={world?.players}
                    onUpdateElement={async (el) => {
                      await storage.updateElement(worldId!, currentMap!.id, el);
                      const updated = await storage.ensureMapLoaded(worldId!, currentMap!.id);
                      if (updated) setCurrentMap(updated);
                    }}
                    onUpdatePlayer={async (pl) => {
                      await storage.updatePlayer(worldId!, pl);
                      const w = storage.getWorld(worldId!);
                      setWorld(w);
                    }}
                    onDeleteElement={async (id) => {
                      await storage.deleteElement(worldId!, currentMap!.id, id);
                      const updated = await storage.ensureMapLoaded(worldId!, currentMap!.id);
                      if (updated) setCurrentMap(updated);
                    }}
                    onDeletePlayer={async (id) => {
                      await handlePlayerDelete(id);
                    }}
                    mode="edit"  // ← Add this prop
                  />
                </div>
              ) : (
                <div className="h-[calc(100vh-200px)] flex items-center justify-center bg-card border-2 border-dashed border-border rounded-lg">
                  <div className="text-center">
                    <p className="text-muted-foreground mb-4">
                      No map selected
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Upload a map to get started
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <ElementEditor
        mode="element"
        element={selectedElement}
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleElementSave}
        onDelete={handleElementDelete}
        maps={maps}
        players={world?.players}
      />

      <ElementEditor
        mode="player"
        element={playerEditing}
        open={playerEditorOpen}
        onClose={() => { setPlayerEditorOpen(false); setPlayerEditing(null); }}
        onSave={(pl) => { handlePlayerSave(pl as Player); setPlayerEditorOpen(false); setPlayerEditing(null); }}
        onDelete={(id) => { handlePlayerDelete(id); setPlayerEditorOpen(false); setPlayerEditing(null); }}
        maps={maps}
        players={world?.players}
      />
    </div>
  );
};

export default WorldEditor;
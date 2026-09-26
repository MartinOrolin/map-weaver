import { useParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { storage } from "@/lib/storage";
import { World, MapData, InteractiveElement, Player, ElementType } from "@/types/world";
import { MapCanvas } from "@/components/MapCanvas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Creatures } from "@/components/Creatures";
import { ElementEditor } from "@/components/ElementEditor";
import { broadcastManager } from "@/lib/broadcast";
import { useToast } from "@/hooks/use-toast";
import { io } from "socket.io-client";
import { Eye, EyeOff, Map } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { MusicPlayer } from "@/components/MusicPlayer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type MapElementType = Exclude<ElementType, "player">;

const mapElementTypes: MapElementType[] = ["npc", "enemy", "portal", "item", "loot"];

const aggregateElements = (
  elements: InteractiveElement[],
  types: MapElementType[],
): Partial<Record<MapElementType, InteractiveElement[]>> => {
  return types.reduce<Partial<Record<MapElementType, InteractiveElement[]>>>((groups, type) => {
    groups[type] = elements.filter((element) => element.type === type);
    return groups;
  }, {});
};

const WorldManage = () => {
  const { worldId } = useParams<{ worldId: string }>();
  const [world, setWorld] = useState<World | null>(null);
  const [maps, setMaps] = useState<MapData[]>([]);
  const [currentMap, setCurrentMap] = useState<MapData | null>(null);
  const [selectedElement, setSelectedElement] = useState<InteractiveElement | null>(null);
  const [hiddenElements, setHiddenElements] = useState<string[]>([]);
  const { toast } = useToast();
  const socketRef = useRef<any>(null);
  const ignoreNextUpdateRef = useRef(false);
  const currentMapRef = useRef<MapData | null>(null);
  const [playerEditorOpen, setPlayerEditorOpen] = useState(false);
  const [playerEditing, setPlayerEditing] = useState<Player | null>(null);
  const navigate = useNavigate();
  const musicPlayerRef = useRef<any>(null);
  const [autoPlayMusic, setAutoPlayMusic] = useState(true);

  useEffect(() => {
    currentMapRef.current = currentMap;
  }, [currentMap]);

  useEffect(() => {
    if (!selectedElement) return;
    const refreshed = currentMap?.elements?.find((element) => element.id === selectedElement.id);
    setSelectedElement(refreshed ?? null);
  }, [currentMap, selectedElement]);

  useEffect(() => {
    try {
      socketRef.current = io(undefined, { autoConnect: true });
      socketRef.current.on('connect', () => {
        if (worldId) socketRef.current.emit('join', { worldId });
      });
      socketRef.current.on('world:update', async ({ file, payload }) => {
        try {
          if (!worldId) return;

          if (ignoreNextUpdateRef.current) {
            ignoreNextUpdateRef.current = false;
            return;
          }

          // incoming single-map update (e.g. map_<id>.json)
          if (file && file.endsWith('.json') && !file.includes('world.json') && !file.includes('maps.json')) {
            const mapId = file.replace(/\.json$/, '');
            if (typeof storage.applyWorldFile === 'function') {
              await storage.applyWorldFile(worldId, file, payload);
            } else {
              await storage.init();
            }

            const loadedMaps = storage.getMapsForWorld(worldId);
            setMaps(loadedMaps);

            const current = currentMapRef.current;
            // Only switch/refresh currentMap in safe cases:
            // - no selection yet -> open the updated map (or fallback)
            // - the update is for the map the user is currently viewing -> refresh it
            if (!current) {
              const picked = loadedMaps.find(m => m.id === mapId) || loadedMaps.find(m => m.level === 0) || loadedMaps[0] || null;
              if (picked) {
                const full = await storage.ensureMapLoaded(worldId, picked.id);
                setCurrentMap(full ?? picked);
              }
            } else if (current.id === mapId) {
              const full = await storage.ensureMapLoaded(worldId, mapId);
              setCurrentMap(full ?? current);
            } else {
              // preserve the user's current selection (do not auto-switch)
            }
            return;
          }

          // manifest/world metadata updates: update index but preserve selection unless it disappears
          if (file && (file.includes('maps.json') || file.includes('world.json'))) {
            if (typeof storage.applyWorldFile === 'function') {
              await storage.applyWorldFile(worldId, file, payload);
            } else {
              await storage.init();
            }
            const loadedMaps = storage.getMapsForWorld(worldId);
            setMaps(loadedMaps);
            const current = currentMapRef.current;
            if (current) {
              const still = loadedMaps.find(m => m.id === current.id);
              if (still) {
                const full = await storage.ensureMapLoaded(worldId, still.id);
                setCurrentMap(full ?? still);
              } else {
                // if current map was removed on server, pick sensible fallback
                const fallback = loadedMaps.find(m => m.level === 0) || loadedMaps[0] || null;
                if (fallback) {
                  const full = await storage.ensureMapLoaded(worldId, fallback.id);
                  setCurrentMap(full ?? fallback);
                } else {
                  setCurrentMap(null);
                }
              }
            }
            return;
          }

          if (typeof storage.applyWorldFile === 'function') {
            await storage.applyWorldFile(worldId, file, payload);
          } else {
            await storage.init();
          }
          await loadWorldData();
        } catch (e) {
          console.warn('manage world:update failed', e);
        }
      });
    } catch (e) {
      console.warn('socket init failed', e);
    }
    return () => { try{ socketRef.current?.disconnect(); }catch{} };
  }, [worldId]);

  const loadWorldData = async () => {
    if (!worldId) return;

    const loadedWorld = storage.getWorld(worldId);
    setWorld(loadedWorld);

    const loadedMaps = storage.getMapsForWorld(worldId);
    setMaps(loadedMaps);

    if (currentMap) {
      const stillThere = loadedMaps.find(m => m.id === currentMap.id);
      if (stillThere) {
        const full = await storage.ensureMapLoaded(worldId, stillThere.id);
        setCurrentMap(full ?? stillThere);
      } else {
        const firstMap = loadedMaps.find(m => m.level === 0) || loadedMaps[0] || null;
        if (firstMap) {
          const full = await storage.ensureMapLoaded(worldId, firstMap.id);
          setCurrentMap(full ?? firstMap);
        } else setCurrentMap(null);
      }
    } else {
      const firstMap = loadedMaps.find(m => m.level === 0) || loadedMaps[0] || null;
      if (firstMap) {
        const full = await storage.ensureMapLoaded(worldId, firstMap.id);
        setCurrentMap(full ?? firstMap);
      } else setCurrentMap(null);
    }
  };

  // initialize storage and load data when worldId changes
  useEffect(() => {
    if (!worldId) return;
    let mounted = true;
    (async () => {
      try {
        await storage.init();
        if (!mounted) return;
        await loadWorldData();
      } catch (e) {
        console.error('storage.init failed', e);
      }
    })();
    return () => { mounted = false; };
  }, [worldId]);

  const handlePlayerSave = async (p: Player) => {
    if (!worldId) return;
    await storage.addPlayer(worldId, p);
    // refresh world and maps
    const w = storage.getWorld(worldId);
    setWorld(w);
    setMaps(storage.getMapsForWorld(worldId));
    broadcastManager.broadcast({ type: "player_update", worldId, playerId: p.id });
  };

  const handleMapChange = async (mapId: string) => {
    if (!worldId) return;
    const full = await storage.ensureMapLoaded(worldId, mapId);
    const map = full ?? storage.getMap(worldId, mapId);
    if (map) {
      setCurrentMap(map);

      if (world) {
        const updatedWorld = { ...world, rootMapId: map.id, updatedAt: new Date().toISOString() };
        ignoreNextUpdateRef.current = true;
        void storage.saveWorld(updatedWorld);
        setTimeout(() => { ignoreNextUpdateRef.current = false; }, 1000);
      }

      broadcastManager.broadcast({ type: 'map_update', worldId, mapId: map.id });
    }
  };

  const toggleElementVisibility = async (elementId: string) => {
    if (!worldId || !currentMap) return;

    const updatedElements = (currentMap.elements ?? []).map(e =>
      e.id === elementId ? { ...e, visible: !e.visible } : e
    );
    const updatedMap = { ...currentMap, elements: updatedElements };

    // update UI and ref synchronously so socket handler sees the selection
    setCurrentMap(updatedMap);
    currentMapRef.current = updatedMap;

    setHiddenElements(prev => {
      const nowVisible = updatedElements.find(e => e.id === elementId)!.visible !== false;
      return nowVisible ? prev.filter(id => id !== elementId) : [...prev, elementId];
    });

    // mark that the next incoming server broadcasts are likely our own updates
    ignoreNextUpdateRef.current = true;
    setTimeout(() => { ignoreNextUpdateRef.current = false; }, 3000);

    const updatedElement = updatedElements.find(e => e.id === elementId)!;
    try {
      await storage.updateElement(worldId, updatedMap.id, updatedElement);
      // reload the full map after persistence and sync ref
      const full = await storage.ensureMapLoaded(worldId, updatedMap.id);
      if (full) {
        setCurrentMap(full);
        currentMapRef.current = full;
      }
    } catch (err) {
      console.error('updateElement failed', err);
      toast({ title: 'Save failed', description: 'Could not persist element change', variant: 'destructive' });
    }

    broadcastManager.broadcast({
      type: 'element_update',
      worldId,
      mapId: updatedMap.id,
      elementId,
    });
  };

  const toggleElementNameVisibility = async (elementId: string) => {
    if (!worldId || !currentMap) return;

    const updatedElements = (currentMap.elements ?? []).map((element) =>
      element.id === elementId
        ? { ...element, nameVisible: element.nameVisible !== true }
        : element
    );
    const updatedElement = updatedElements.find((element) => element.id === elementId);
    if (!updatedElement) return;

    const updatedMap = { ...currentMap, elements: updatedElements };
    setCurrentMap(updatedMap);
    currentMapRef.current = updatedMap;

    try {
      await storage.updateElement(worldId, currentMap.id, updatedElement);
      broadcastManager.broadcast({
        type: "element_update",
        worldId,
        mapId: currentMap.id,
        elementId,
      });
    } catch (error) {
      console.error("Failed to update element name visibility", error);
      toast({
        title: "Save failed",
        description: "Could not persist element name visibility",
        variant: "destructive",
      });
    }
  };

  const broadcastPovSelection = (element: InteractiveElement) => {
    if (!worldId) return;
    broadcastManager.broadcast({
      type: "creature_pov",
      worldId,
      elementId: element.id,
      imageUrl: element.imageUrl,
      creatureName: element.name,
      nameVisible: element.nameVisible === true,
    });
  };

  const handleElementClick = (element: InteractiveElement) => {
    if (!worldId) return;

    setSelectedElement(element);
    broadcastPovSelection(element);

    if (element.type === "portal" && element.targetMapId) {
      (async () => {
        const full = await storage.ensureMapLoaded(worldId, element.targetMapId);
        const targetMap = full ?? storage.getMap(worldId, element.targetMapId);
        if (!targetMap) return;

        // update local selection and ref immediately so socket logic sees it
        setCurrentMap(targetMap);
        currentMapRef.current = targetMap;
        setMaps(storage.getMapsForWorld(worldId));

        // persist as rootMapId so refresh keeps this selection
        if (world) {
          const updatedWorld = { ...world, rootMapId: targetMap.id, updatedAt: new Date().toISOString() };
          ignoreNextUpdateRef.current = true;
          try {
            await storage.saveWorld(updatedWorld);
          } catch (e) {
            console.error("Failed to save rootMapId after portal navigation", e);
          }
          // keep the ignore window long enough to cover server emits sequence
          setTimeout(() => { ignoreNextUpdateRef.current = false; }, 2000);
          setWorld(updatedWorld);
        }

        // inform other in-app listeners
        broadcastManager.broadcast({
          type: 'map_update',
          worldId,
          mapId: targetMap.id,
        });

        toast({
          title: "Map changed",
          description: `Now managing ${targetMap.name}`,
        });
      })();
    }
  };

  const togglePovNameVisibility = async (nameVisible: boolean) => {
    if (!worldId || !currentMap || !selectedElement) return;

    const updatedElement = { ...selectedElement, nameVisible };
    const updatedMap = {
      ...currentMap,
      elements: (currentMap.elements || []).map((element) =>
        element.id === updatedElement.id ? updatedElement : element
      ),
    };
    setSelectedElement(updatedElement);
    setCurrentMap(updatedMap);
    currentMapRef.current = updatedMap;

    try {
      await storage.updateElement(worldId, currentMap.id, updatedElement);
      broadcastManager.broadcast({
        type: "element_update",
        worldId,
        mapId: currentMap.id,
        elementId: updatedElement.id,
      });
      broadcastPovSelection(updatedElement);
    } catch (error) {
      console.error("Failed to update POV name visibility", error);
      toast({
        title: "Save failed",
        description: "Could not persist POV name visibility",
        variant: "destructive",
      });
    }
  };

  if (!world || !currentMap) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const elementsByType = aggregateElements(currentMap.elements ?? [], mapElementTypes);

  return (
    <div className="min-h-screen bg-background p-2">
      <div className="max-w-[1600px] mx-auto">
        <header className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary">{world.name} - Manage Mode</h1>
            <p className="text-muted-foreground">Control element visibility and navigate between maps</p>
          </div>
          <div className="ml-4">
            <Button
              variant="outline"
              onClick={() => navigate(`/world/${worldId}/edit`)}
              className="bg-card"
            >
              Editor
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open(`/world/${worldId}/pov`, '_blank')}
              className="bg-card"
            >
              Open Pov
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)] gap-3">
          <div className="space-y-3">
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="flex items-center gap-2">
                  <Map className="w-5 h-5" />
                  Map Selection
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <Select value={currentMap.id} onValueChange={handleMapChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {maps.map((map) => (
                      <SelectItem key={map.id} value={map.id}>
                        {map.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-xl">Element Visibility</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <ScrollArea className="h-[calc(100vh-13rem)] pr-3">
                  {(!Array.isArray(currentMap.elements) || currentMap.elements.length === 0) ? (
                    <p className="text-sm text-muted-foreground">No elements on this map</p>
                  ) : (
                    <div className="space-y-2">
                      {mapElementTypes.map((type) => {
                        const elements = elementsByType[type] ?? [];
                        const label = type.charAt(0).toUpperCase() + type.slice(1);

                        return (
                          <Collapsible key={type} defaultOpen={elements.length > 0}>
                            <CollapsibleTrigger asChild>
                              <Button variant="outline" className="h-auto min-h-10 w-full justify-between py-2 text-left">
                                <span>{label}</span>
                                <span className="text-xs text-muted-foreground">{elements.length}</span>
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-1 space-y-1">
                              {elements.length === 0 ? (
                                <p className="px-2 py-1 text-xs text-muted-foreground">No {label.toLowerCase()} elements</p>
                              ) : (
                                elements.map((element) => (
                                  <div
                                    key={element.id}
                                    className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-2 rounded-lg bg-muted cursor-pointer ${selectedElement?.id === element.id ? "ring-2 ring-primary" : ""}`}
                                    onClick={() => handleElementClick(element)}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {element.visible === false || hiddenElements.includes(element.id) ? (
                                        <EyeOff className="w-4 h-4 text-muted-foreground shrink-0" />
                                      ) : (
                                        <Eye className="w-4 h-4 text-primary shrink-0" />
                                      )}
                                      <p className="text-sm font-medium break-words">{element.name}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <div className="flex items-center gap-1" title="Show element on World View">
                                        <Eye className="w-3 h-3 text-muted-foreground" />
                                        <Switch
                                          checked={element.visible !== false && !hiddenElements.includes(element.id)}
                                          onClick={(event) => event.stopPropagation()}
                                          onCheckedChange={() => toggleElementVisibility(element.id)}
                                          aria-label={`Show ${element.name} on World View`}
                                        />
                                      </div>
                                      <div className="flex items-center gap-1" title="Show name on World View">
                                        <span className="text-xs text-muted-foreground">N</span>
                                        <Switch
                                          checked={element.nameVisible === true}
                                          onClick={(event) => event.stopPropagation()}
                                          onCheckedChange={() => toggleElementNameVisibility(element.id)}
                                          aria-label={`Show ${element.name} name on World View`}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div>
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_18rem] gap-3 items-start">
              <div className="h-[min(72vh,52rem)] min-h-[32rem] space-y-3">

              {/* ✅ Background Music Player */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted">
                <h2 className="text-lg font-semibold text-foreground">{currentMap.name}</h2>
                <MusicPlayer
                  key={currentMap.id} // force refresh when map changes
                  musicUrl={currentMap.musicUrl}
                  autoPlayOnChange={true}
                />
              </div>

              <MapCanvas
                map={currentMap}
                mode="manage"
                onElementClick={handleElementClick}
                hiddenElements={hiddenElements}
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
              />
              </div>

              <Card className="xl:sticky xl:top-4">
                <CardHeader>
                  <CardTitle>POV Preview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold truncate">
                      {selectedElement?.name || "No element selected"}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">POV name</span>
                      <Switch
                        checked={selectedElement?.nameVisible === true}
                        disabled={!selectedElement}
                        onCheckedChange={(checked) => void togglePovNameVisibility(checked)}
                        aria-label="Show selected element name in POV view"
                      />
                    </div>
                  </div>

                  <div className="aspect-square rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden">
                    {selectedElement?.imageUrl ? (
                      <img
                        src={selectedElement.imageUrl}
                        alt={selectedElement.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">No portrait</span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold mb-2">Notes</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap min-h-16">
                      {selectedElement?.notes || "No notes for this element."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <ElementEditor
          mode="player"
          element={playerEditing}
          open={playerEditorOpen}
          onClose={() => { setPlayerEditorOpen(false); setPlayerEditing(null); }}
          onSave={(pl) => { handlePlayerSave(pl as Player); setPlayerEditorOpen(false); setPlayerEditing(null); }}
          maps={maps}
          players={world?.players}
        />
      </div>
    </div>
  );
};

export default WorldManage;
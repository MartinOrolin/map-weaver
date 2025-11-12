import { useParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { storage } from "@/lib/storage";
import { World, MapData, InteractiveElement, Player } from "@/types/world";
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

const WorldManage = () => {
  const { worldId } = useParams<{ worldId: string }>();
  const [world, setWorld] = useState<World | null>(null);
  const [maps, setMaps] = useState<MapData[]>([]);
  const [currentMap, setCurrentMap] = useState<MapData | null>(null);
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

    const updatedElements = currentMap.elements.map(e =>
      e.id === elementId ? { ...e, visible: !e.visible } : e
    );
    const updatedMap = { ...currentMap, elements: updatedElements };

    // update UI and ref synchronously so socket handler sees the selection
    setCurrentMap(updatedMap);
    currentMapRef.current = updatedMap;

    setHiddenElements(prev => {
      const nowVisible = updatedElements.find(e => e.id === elementId)!.visible;
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

  const handleElementClick = (element: InteractiveElement) => {
    if (!worldId) return;

    if (element.type === "enemy" || element.type === "npc") {
      broadcastManager.broadcast({
        type: "creature_pov",
        worldId,
        elementId: element.id,
        imageUrl: element.imageUrl,
        creatureName: element.name,
      });
      return;
    }

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

  if (!world || !currentMap) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Map className="w-5 h-5" />
                  Map Selection
                </CardTitle>
              </CardHeader>
              <CardContent>
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
              <CardHeader>
                <CardTitle>Element Visibility</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {(!Array.isArray(currentMap.elements) || currentMap.elements.length === 0) ? (
                    <p className="text-sm text-muted-foreground">No elements on this map</p>
                  ) : (
                    <div className="space-y-2">
                      {currentMap.elements.map((element) => (
                        <div
                          key={element.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-muted"
                        >
                          <div className="flex items-center gap-2">
                            {hiddenElements.includes(element.id) ? (
                              <EyeOff className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <Eye className="w-4 h-4 text-primary" />
                            )}
                            <div>
                              <p className="text-sm font-medium">{element.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {element.type}
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={!hiddenElements.includes(element.id)}
                            onCheckedChange={() => toggleElementVisibility(element.id)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <div className="h-[calc(100vh-200px)] space-y-3">

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
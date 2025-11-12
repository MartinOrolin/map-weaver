import { useParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { storage } from "@/lib/storage";
import { World, MapData, InteractiveElement } from "@/types/world";
import { MapCanvas } from "@/components/MapCanvas";
import { broadcastManager, BroadcastMessage } from "@/lib/broadcast";
import { useToast } from "@/hooks/use-toast";
import { io } from "socket.io-client";

const WorldView = () => {
  const { worldId } = useParams<{ worldId: string }>();
  const [world, setWorld] = useState<World | null>(null);
  const [currentMap, setCurrentMap] = useState<MapData | null>(null);
  const [hiddenElements, setHiddenElements] = useState<string[]>([]);
  const { toast } = useToast();
  const socketRef = useRef<any>(null);
  const ignoreNextUpdateRef = useRef(false);
  const currentMapRef = useRef<MapData | null>(null);
  const [maps, setMaps] = useState<MapData[]>([]);

  useEffect(() => {
    currentMapRef.current = currentMap;
  }, [currentMap]);

  useEffect(() => {
    if (!worldId) return;
    let mounted = true;
    (async () => {
      try {
        await storage.init();
        if (!mounted) return;

        const w = storage.getWorld(worldId);
        setWorld(w);

        const loadedMaps = storage.getMapsForWorld(worldId);
        setMaps(loadedMaps);

        if (w?.rootMapId) {
          const root = await storage.ensureMapLoaded(worldId, w.rootMapId);
          if (mounted) {
            setCurrentMap(root ?? storage.getMap(worldId, w.rootMapId));
          }
          return;
        }

        const first = loadedMaps.find(m => m.level === 0) || loadedMaps[0] || null;
        if (first) {
          const full = await storage.ensureMapLoaded(worldId, first.id);
          if (mounted) setCurrentMap(full ?? first);
        }
      } catch (e) {
        console.error("Failed to init storage in WorldView:", e);
      }
    })();

    return () => { mounted = false; };
  }, [worldId]);

  // broadcastManager subscription (in-app changes)
  useEffect(() => {
    if (!worldId) return;
    const unsub = broadcastManager.subscribe((msg: BroadcastMessage) => {
      if (msg.worldId !== worldId) return;

      if (msg.type === 'map_update' && msg.mapId) {
        (async () => {
          const m = await storage.ensureMapLoaded(worldId, msg.mapId);
          if (m) setCurrentMap(m);
        })();
        return;
      }

      (async () => {
        await storage.init();
        const w = storage.getWorld(worldId);
        setWorld(w);
        // refresh map if root changed
        if (w?.rootMapId) {
          const root = await storage.ensureMapLoaded(worldId, w.rootMapId);
          setCurrentMap(root ?? storage.getMap(worldId, w.rootMapId));
        }
      })();
    });
    return unsub;
  }, [worldId]);

  // socket.io for server-side updates
  useEffect(() => {
    if (!worldId) return;
    socketRef.current = io(undefined, { autoConnect: true });
    const sock = socketRef.current;

    sock.on('connect', () => {
      if (worldId) sock.emit('join', { worldId });
    });

    sock.on('world:update', async ({ file, payload }: { file: string, payload: any }) => {
      try {
        if (ignoreNextUpdateRef.current) {
          ignoreNextUpdateRef.current = false;
          return;
        }

        // update cache only
        if (typeof storage.applyWorldFile === 'function') {
          await storage.applyWorldFile(worldId, file, payload);
        } else {
          await storage.init();
        }

        // always refresh index in state after applying server update
        const mapsList = storage.getMapsForWorld(worldId);
        setMaps(mapsList);

        // single map update: refresh only if it affects the currently open map, or if nothing is open
        if (file && file.endsWith('.json') && !file.includes('maps.json') && !file.includes('world.json')) {
          const mapId = file.replace(/\.json$/, '');
          const current = currentMapRef.current;
          if (!current) {
            const full = await storage.ensureMapLoaded(worldId, mapId);
            if (full) setCurrentMap(full);
          } else if (current.id === mapId) {
            const updated = await storage.ensureMapLoaded(worldId, mapId);
            if (updated) setCurrentMap(updated);
          } else {
            // preserve user's selection
          }
          return;
        }

        // manifest/world.json updates: update index but preserve selection unless it was removed
        if (file && (file.includes('maps.json') || file.includes('world.json'))) {
          const maps = mapsList;
          setWorld(storage.getWorld(worldId));

          // preserve current map if still present
          const current = currentMapRef.current;
          if (current) {
            const still = maps.find(m => m.id === current.id);
            if (still) {
              const full = await storage.ensureMapLoaded(worldId, still.id);
              setCurrentMap(full ?? still);
            } else {
              // Try to fetch the per-map file directly before falling back to root;
              // this covers races where maps.json was written earlier/later than per-map file.
              let stillFull = null;
              try {
                stillFull = await storage.ensureMapLoaded(worldId, current.id);
              } catch (e) {
                /* ignore */
              }
              if (stillFull) {
                setCurrentMap(stillFull);
              } else {
                // current was removed -> pick fallback (root or first)
                const fallback = maps.find(m => m.level === 0) || maps[0] || null;
                if (fallback) {
                  const full = await storage.ensureMapLoaded(worldId, fallback.id);
                  setCurrentMap(full ?? fallback);
                } else {
                  setCurrentMap(null);
                }
              }
            }
          }
          return;
        }

        // conservative fallback: reload world data but this should be rare
        await (async () => {
          const w = storage.getWorld(worldId);
          setWorld(w);
          const maps = storage.getMapsForWorld(worldId);
          setMaps(maps);
        })();
      } catch (e) {
        console.warn('world:update handling failed', e);
      }
    });

    return () => {
      try { sock.disconnect(); } catch {}
      socketRef.current = null;
    };
  }, [worldId]);

  // useEffect(() => {
  //   if (!currentMap || !currentMap.musicUrl) return;

  //   const audio = new Audio(currentMap.musicUrl);
  //   audio.loop = true;
  //   audio.volume = 0.4; // adjust volume as needed
  //   audio.play().catch(err => console.warn("Autoplay blocked:", err));

  //   return () => {
  //     audio.pause();
  //   };
  // }, [currentMap]);

  const handleElementClick = (element: InteractiveElement) => {
    if (element.type === "portal" && element.targetMapId && worldId) {
      (async () => {
        // load full map and synchronously update ref + state so socket handler is consistent
        const full = await storage.ensureMapLoaded(worldId, element.targetMapId);
        const targetMap = full ?? storage.getMap(worldId, element.targetMapId);
        if (targetMap) {
          setCurrentMap(targetMap);
          currentMapRef.current = targetMap; // immediate sync for socket logic
          // keep index in sync too
          setMaps(storage.getMapsForWorld(worldId));
          toast({
            title: "Map changed",
            description: `Now viewing ${targetMap.name}`,
          });
        }
      })();
    }
  };

  if (!world || !currentMap) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="h-screen p-4">
        <div className="h-full">
          <MapCanvas
            map={currentMap}
            mode="view"
            showLabels={true}
            onElementClick={handleElementClick}
            hiddenElements={hiddenElements}
          />
        </div>
      </div>
    </div>
  );
};

export default WorldView;
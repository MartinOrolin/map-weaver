import { World, WorldConfig, MapData, InteractiveElement, Player } from "@/types/world";

const API_BASE = "/api";

/**
 * cache[worldId] = { world: World, maps: MapData[] }
 * maps[] in cache is treated as index (may omit heavy fields like elements).
 * Full map content is stored in per-map files: <mapId>.json
 */
let cache: Record<string, WorldConfig> | null = null;

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `${res.status} ${res.statusText}`);
  }
  // tolerant parsing: allow empty body (DELETE may return no content)
  const txt = await res.text().catch(() => "");
  if (!txt) return null;
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

/** Initialize cache by reading world.json (minimal) and maps.json (index) for each world. */
async function init(): Promise<void> {
  if (cache !== null) return;
  cache = {};
  try {
    const list = await fetchJSON(`${API_BASE}/list-worlds`);
    const folders: string[] = list.worlds || [];
    for (const id of folders) {
      try {
        // read minimal world.json (world metadata only)
        const worldObj = await fetchJSON(`${API_BASE}/world/${encodeURIComponent(id)}/config/world.json`)
          .catch(() => null);
        // read maps index (lightweight)
        const mapsIndex = await fetchJSON(`${API_BASE}/world/${encodeURIComponent(id)}/config/maps.json`)
          .catch(() => []);
        const wc: WorldConfig = {
          world: worldObj?.world ?? worldObj ?? { id, name: id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          maps: Array.isArray(mapsIndex) ? mapsIndex : [],
        };
        cache[id] = wc;
      } catch (e) {
        console.warn(`Failed to load config for ${id}:`, e);
      }
    }
  } catch (e) {
    console.warn("storage.init: could not contact server; starting with empty cache", e);
    cache = {};
  }
}

function getAllWorlds(): World[] {
  if (!cache) return [];
  return Object.values(cache)
    .map((wc) => wc?.world)
    .filter((w): w is World => !!w && !!w.id);
}

function getWorld(worldId: string): World | null {
  if (!cache) return null;
  return cache[worldId]?.world ?? null;
}

function getMapsForWorld(worldId: string): MapData[] {
  if (!cache) return [];
  return cache[worldId]?.maps ?? [];
}

/** Ensure full map data: if index entry lacks elements, try fetching per-map file. */
async function ensureMapLoaded(worldId: string, mapId: string): Promise<MapData | null> {
  if (!cache) cache = {};
  const wc = cache[worldId];
  if (!wc) return null;
  const idx = wc.maps.find(m => m.id === mapId);
  if (!idx) return null;
  // if elements present, treat as full
  if (Array.isArray(idx.elements) && idx.elements.length >= 0 && idx.elements !== undefined) {
    return idx;
  }
  // fetch per-map file
  try {
    const full = await fetchJSON(`${API_BASE}/world/${encodeURIComponent(worldId)}/config/${encodeURIComponent(mapId)}.json`);
    // merge/persist into index
    const i = wc.maps.findIndex(m => m.id === mapId);
    if (i >= 0) wc.maps[i] = full;
    else wc.maps.push(full);
    cache[worldId] = wc;
    return full;
  } catch (e) {
    // unable to fetch per-map file; return index entry as-is
    return idx;
  }
}

/** Synchronous getter that may return an index item (possibly light). Consumers that need full map should call ensureMapLoaded. */
function getMap(worldId: string, mapId?: string | null): MapData | null {
  if (!mapId || !cache) return null;
  const wc = cache[worldId];
  if (!wc) return null;
  return wc.maps.find(m => m.id === mapId) ?? null;
}

/** Persist minimal world metadata (world.json contains only world object, not maps). */
async function saveWorld(world: World): Promise<void> {
  if (!cache) cache = {};
  const wc = cache[world.id] ?? { world, maps: [] };
  wc.world = { ...wc.world, ...world };
  cache[world.id] = wc;

  const payload = wc.world; // minimal world data
  try {
    // ensure folder exists
    try {
      await fetchJSON(`${API_BASE}/world`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: world.id, name: world.name }),
      });
    } catch {}
    await fetchJSON(`${API_BASE}/world/${encodeURIComponent(world.id)}/config/world.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("Failed to persist world:", e);
  }
}

async function createWorld(id: string, name: string, config?: Partial<World>): Promise<WorldConfig> {
  if (!cache) cache = {};
  const createdAt = new Date().toISOString();
  const world: World = {
    id,
    name,
    description: config?.description ?? "",
    createdAt,
    updatedAt: createdAt,
    rootMapId: config?.rootMapId,
  };
  const wc: WorldConfig = { world, maps: [] };
  cache[id] = wc;

  try {
    await fetchJSON(`${API_BASE}/world`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name }),
    });
    // write minimal world.json
    await fetchJSON(`${API_BASE}/world/${encodeURIComponent(id)}/config/world.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(world),
    });
    // create empty maps.json
    await fetchJSON(`${API_BASE}/world/${encodeURIComponent(id)}/config/maps.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([]),
    });
  } catch (e) {
    console.error("Failed to create world on server:", e);
  }
  return wc;
}

async function deleteWorld(worldId: string): Promise<void> {
  if (cache) delete cache[worldId];
  try {
    await fetchJSON(`${API_BASE}/world/${encodeURIComponent(worldId)}`, { method: "DELETE" });
  } catch (e) {
    console.error("Failed to delete world on server:", e);
  }
}

/** Save full map: write per-map file, then update lightweight maps.json index and minimal world.json updatedAt. */
async function saveMap(worldId: string, map: MapData): Promise<void> {
  if (!cache) cache = {};
  const wc = cache[worldId] ?? { world: { id: worldId, name: worldId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, maps: [] };
  wc.world = wc.world ?? { id: worldId, name: worldId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

  const maps = wc.maps || [];
  const idx = maps.findIndex((m) => m.id === map.id);
  if (idx >= 0) maps[idx] = map;
  else maps.push(map);
  wc.maps = maps;
  cache[worldId] = wc;

  try {
    // write full per-map file
    await fetchJSON(`${API_BASE}/world/${encodeURIComponent(worldId)}/config/${encodeURIComponent(map.id)}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(map),
    });
    // update maps.json index (lightweight entries)
    const index = maps.map(m => ({
      id: m.id,
      worldId: m.worldId,
      name: m.name,
      imageUrl: m.imageUrl,
      parentMapId: m.parentMapId,
      level: m.level,
    }));
    await fetchJSON(`${API_BASE}/world/${encodeURIComponent(worldId)}/config/maps.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(index),
    });
    // update world.json updatedAt
    wc.world.updatedAt = new Date().toISOString();
    await fetchJSON(`${API_BASE}/world/${encodeURIComponent(worldId)}/config/world.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wc.world),
    }).catch(()=>{});
  } catch (e) {
    console.error("Failed to persist map to server:", e);
  }
}

/** Delete map per-file + update maps.json index + world.json metadata */
async function deleteMap(worldId: string, mapId: string): Promise<void> {
  if (!cache) cache = {};
  const wc = cache[worldId];
  if (!wc) return;

  // remove from cache immediately so UI responds
  wc.maps = (wc.maps || []).filter((m) => m.id !== mapId);
  // if rootMapId pointed to the deleted map, choose a fallback or remove it
  if (wc.world && wc.world.rootMapId === mapId) {
    const fallback = wc.maps.find(m => m.level === 0) || wc.maps[0] || null;
    wc.world.rootMapId = fallback ? fallback.id : undefined;
  }
  cache[worldId] = wc;

  try {
    // delete per-map file (handle non-JSON responses)
    const delRes = await fetch(`${API_BASE}/world/${encodeURIComponent(worldId)}/config/${encodeURIComponent(mapId)}.json`, {
      method: "DELETE",
    });
    if (!delRes.ok) {
      const txt = await delRes.text().catch(() => "");
      throw new Error(txt || `${delRes.status} ${delRes.statusText}`);
    }

    // update maps.json index on server
    const index = wc.maps.map(m => ({
      id: m.id,
      worldId: m.worldId,
      name: m.name,
      imageUrl: m.imageUrl,
      parentMapId: m.parentMapId,
      level: m.level,
    }));
    const putMaps = await fetch(`${API_BASE}/world/${encodeURIComponent(worldId)}/config/maps.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(index),
    });
    if (!putMaps.ok) {
      const txt = await putMaps.text().catch(() => "");
      throw new Error(txt || `${putMaps.status} ${putMaps.statusText}`);
    }

    // update world.json metadata (updatedAt and rootMapId if modified)
    wc.world.updatedAt = new Date().toISOString();
    const putWorld = await fetch(`${API_BASE}/world/${encodeURIComponent(worldId)}/config/world.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wc.world),
    });
    if (!putWorld.ok) {
      const txt = await putWorld.text().catch(() => "");
      console.warn("Failed to update world.json after delete:", txt || `${putWorld.status}`);
    }
  } catch (e) {
    console.error("Failed to delete map on server:", e);
  }
}

/** Apply update to cache only (no server PUT) */
async function applyWorldFile(worldId: string, filename: string, data: any): Promise<void> {
  if (!cache) cache = {};
  const wc = cache[worldId] ?? { world: { id: worldId, name: worldId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, maps: [] };
  try {
    if (filename === "world.json" || filename.endsWith("/world.json")) {
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      wc.world = parsed.world ?? parsed;
    } else if (filename === "maps.json") {
      wc.maps = Array.isArray(data) ? data : (typeof data === "string" ? JSON.parse(data) : wc.maps);
    } else if (filename.endsWith(".json")) {
      const mapObj = typeof data === "string" ? JSON.parse(data) : data;
      if (mapObj && mapObj.id) {
        const idx = (wc.maps || []).findIndex((m) => m.id === mapObj.id);
        if (idx >= 0) wc.maps[idx] = mapObj;
        else wc.maps.push(mapObj);
      }
    }
    cache[worldId] = wc;
  } catch (e) {
    // ignore parse errors for cache update
  }
}

/** Save arbitrary file (still supported) */
async function saveWorldFile(worldId: string, filename: string, data: any): Promise<void> {
  await applyWorldFile(worldId, filename, data);
  try {
    await fetchJSON(`${API_BASE}/world/${encodeURIComponent(worldId)}/config/${encodeURIComponent(filename)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: typeof data === "string" ? data : JSON.stringify(data),
    });
  } catch (e) {
    console.error("Failed to save world file:", e);
  }
}

async function deleteWorldFile(worldId: string, filename: string): Promise<void> {
  if (!cache) cache = {};
  if (cache[worldId]) {
    if (filename === "world.json") {
      delete cache[worldId];
    } else if (filename === "maps.json") {
      cache[worldId].maps = [];
    } else if (filename.endsWith(".json")) {
      const mapId = filename.replace(/\.json$/, "");
      cache[worldId].maps = (cache[worldId].maps || []).filter((m) => m.id !== mapId);
    }
  }
  try {
    await fetchJSON(`${API_BASE}/world/${encodeURIComponent(worldId)}/config/${encodeURIComponent(filename)}`, {
      method: "DELETE",
    });
  } catch (e) {
    console.error("Failed to delete world file:", e);
  }
}

// Add / update / delete players stored in world.json
async function addPlayer(worldId: string, player: Player): Promise<void> {
  if (!cache) cache = {};
  const wc = cache[worldId] ?? { world: { id: worldId, name: worldId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, maps: [] };
  wc.world = wc.world ?? { id: worldId, name: worldId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  wc.world.players = wc.world.players || [];
  wc.world.players.push(player);
  cache[worldId] = wc;
  try {
    await saveWorld(wc.world);
  } catch (e) {
    console.error("Failed to add player:", e);
  }
}

async function updatePlayer(worldId: string, player: Player): Promise<void> {
  if (!cache) cache = {};
  const wc = cache[worldId];
  if (!wc) return;
  wc.world.players = wc.world.players || [];
  const idx = wc.world.players.findIndex(p => p.id === player.id);
  if (idx >= 0) wc.world.players[idx] = player;
  else wc.world.players.push(player);
  cache[worldId] = wc;
  try {
    await saveWorld(wc.world);
  } catch (e) {
    console.error("Failed to update player:", e);
  }
}

async function deletePlayer(worldId: string, playerId: string): Promise<void> {
  if (!cache) cache = {};
  const wc = cache[worldId];
  if (!wc || !wc.world) return;
  wc.world.players = (wc.world.players || []).filter(p => p.id !== playerId);
  cache[worldId] = wc;
  try {
    await saveWorld(wc.world);
  } catch (e) {
    console.error("Failed to delete player:", e);
  }
}

/** Add/Update/Delete elements now return Promise so callers can await persistence. */
async function addElement(worldId: string, mapId: string, element: InteractiveElement): Promise<void> {
  const map = getMap(worldId, mapId);
  if (!map) return;
  map.elements = map.elements || [];
  map.elements.push(element);
  await saveMap(worldId, map);
}

async function updateElement(worldId: string, mapId: string, element: InteractiveElement): Promise<void> {
  const map = getMap(worldId, mapId);
  if (!map) return;
  map.elements = map.elements || [];
  const idx = map.elements.findIndex((e) => e.id === element.id);
  if (idx >= 0) map.elements[idx] = element;
  else map.elements.push(element);
  await saveMap(worldId, map);
}

async function deleteElement(worldId: string, mapId: string, elementId: string): Promise<void> {
  const map = getMap(worldId, mapId);
  if (!map) return;
  map.elements = (map.elements || []).filter((e) => e.id !== elementId);
  await saveMap(worldId, map);
}

export const storage = {
  init,
  getAllWorlds,
  getWorld,
  getMapsForWorld,
  getMap,
  saveWorld,
  createWorld,
  deleteWorld,
  saveMap,
  deleteMap,
  saveWorldFile,
  deleteWorldFile,
  addElement,
  updateElement,
  deleteElement,
  addPlayer,
  updatePlayer,
  deletePlayer,  
  applyWorldFile,
  ensureMapLoaded,
};
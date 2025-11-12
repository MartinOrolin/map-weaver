import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { World } from "@/types/world";
import { storage } from "@/lib/storage";
import { WorldCard } from "@/components/WorldCard";
import { CreateWorldDialog } from "@/components/CreateWorldDialog";
import { Scroll } from "lucide-react";

const WorldSelect = () => {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadWorlds();
  }, []);

  const loadWorlds = async () => {
    setLoading(true);
    setError(null);

    try {
      // Try fetching from the backend API
      const response = await fetch("/api/list-worlds");
      if (!response.ok) {
        throw new Error(`API responded with ${response.status}`);
      }

      const data = await response.json();

      // If backend returns { worlds: ["id1", "id2"] }, fetch configs for each
      const worldPromises = (data.worlds || []).map(async (worldId: string) => {
        try {
          const configRes = await fetch(`/api/world/${worldId}/config/world.json`);
          if (!configRes.ok) throw new Error();
          const cfg = await configRes.json();
          // Normalize: server may return either a World or a WorldConfig { world, maps }
          const worldObj = cfg.world ?? cfg;
          return worldObj as World;
        } catch {
          console.warn(`Could not load config for world ${worldId}`);
          return null;
        }
      });

      const loadedWorlds = (await Promise.all(worldPromises)).filter(Boolean) as World[];
      setWorlds(loadedWorlds);

      // Also update local storage cache for offline use
      // if (loadedWorlds.length > 0) {
      //   storage.saveAllWorlds?.(loadedWorlds);
      // }
    } catch (err) {
      console.error("Error loading worlds:", err);
      setError("Failed to load worlds from server. Falling back to local data.");

      // fallback to local data
      const localWorlds = storage.getAllWorlds();
      setWorlds(localWorlds);
    } finally {
      setLoading(false);
    }
  };

  const handleWorldCreated = (world: World) => {
    loadWorlds();
    navigate(`/world/${world.id}/edit`);
  };

  const handleWorldClick = (worldId: string) => {
    navigate(`/world/${worldId}/edit`);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Scroll className="w-12 h-12 text-primary animate-glow-pulse" />
            <h1 className="text-5xl font-bold text-primary">
              D&D Interactive Maps
            </h1>
          </div>
          <p className="text-xl text-muted-foreground">
            Bring your campaigns to life with interactive world maps
          </p>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <div className="text-lg text-muted-foreground">Loading worlds...</div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={loadWorlds}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/80 transition"
            >
              Retry
            </button>
          </div>
        ) : worlds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <div className="w-32 h-32 mb-8 rounded-full bg-card border-4 border-primary flex items-center justify-center shadow-[var(--shadow-glow)]">
              <Scroll className="w-16 h-16 text-primary" />
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-4">
              No Worlds Yet
            </h2>
            <p className="text-muted-foreground mb-8 text-center max-w-md">
              Create your first world to start building immersive maps for your D&D campaigns
            </p>
            <CreateWorldDialog onWorldCreated={handleWorldCreated} variant="hero" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
            {worlds.map((world) => (
              <WorldCard
                key={world.id}
                world={world}
                onClick={() => handleWorldClick(world.id)}
              />
            ))}
          </div>
        )}

        {worlds.length > 0 && !loading && (
          <CreateWorldDialog onWorldCreated={handleWorldCreated} />
        )}
      </div>
    </div>
  );
};

export default WorldSelect;

import { MapData } from "@/types/world";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Map, ArrowLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2 } from "lucide-react";
import { broadcastManager } from "@/lib/broadcast";
import { storage } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { MusicUpload } from "@/components/MusicUpload";
import { Music } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface MapNavigatorProps {
  maps: MapData[];
  currentMap: MapData | null;
  onMapSelect: (map: MapData) => void;
  onMapDelete?: (mapId: string) => void;
}

export const MapNavigator = ({ maps, currentMap, onMapSelect, onMapDelete }: MapNavigatorProps) => {
  const rootMaps = maps.filter(m => !m.parentMapId);
  const { toast } = useToast();
  
  const getChildMaps = (parentId: string) => {
    return maps.filter(m => m.parentMapId === parentId);
  };

  const getParentMap = (map: MapData) => {
    return maps.find(m => m.id === map.parentMapId);
  };

  const renderMapTree = (map: MapData, level: number = 0) => {
  const children = getChildMaps(map.id);
  const isActive = currentMap?.id === map.id;

  return (
    <div key={map.id} className="mb-1">
      <div className="flex items-center justify-between" style={{ marginLeft: level * 16 }}>
        <div className="flex items-center flex-1 gap-2">
          <Button
            variant={isActive ? "default" : "ghost"}
            className="justify-start flex-1"
            onClick={() => onMapSelect(map)}
          >
            <Map className="w-4 h-4 mr-2" />
            {map.name || map.id}
          </Button>
        </div>

        {/* Action buttons: upload music + delete */}
        <div className="flex items-center gap-1">
          {/* 🎵 Upload music dialog */}
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="p-1"
                title="Upload background music"
                onClick={(e) => e.stopPropagation()}
              >
                <Music className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload background music for {map.name || map.id}</DialogTitle>
              </DialogHeader>
              <MusicUpload
                worldId={map.worldId}
                onUploaded={async (path) => {
                  try {
                    // update map object
                    const updated = { ...map, musicUrl: path };
                    await storage.saveMap(map.worldId, updated);
                    broadcastManager.broadcast({
                      type: "map_update",
                      worldId: map.worldId,
                      mapId: map.id,
                    });
                    toast({
                      title: "Music uploaded",
                      description: `Linked music to ${map.name || map.id}`,
                    });
                  } catch (err) {
                    console.error("Failed to save map music", err);
                    toast({
                      title: "Upload failed",
                      description: "Could not save music link",
                      variant: "destructive",
                    });
                  }
                }}
              />
            </DialogContent>
          </Dialog>

          {/* 🗑️ Delete button */}
          <button
            aria-label={`Delete map ${map.name || map.id}`}
            className="text-red-500 p-1"
            onClick={async (e) => {
              e.stopPropagation();
              if (!confirm(`Delete map "${map.name || map.id}"? This cannot be undone.`)) return;
              try {
                await storage.deleteMap(map.worldId, map.id);
                onMapDelete?.(map.id);
                broadcastManager.broadcast({
                  type: "map_deleted",
                  worldId: map.worldId,
                  mapId: map.id,
                });
                toast({
                  title: "Map deleted",
                  description: `${map.name || map.id} removed`,
                });
              } catch (err) {
                console.error("Failed to delete map", err);
                toast({
                  title: "Delete failed",
                  description: "Could not delete map",
                  variant: "destructive",
                });
              }
            }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Render child maps recursively */}
      {children.length > 0 && (
        <div className="mt-1">
          {children.map((child) => renderMapTree(child, level + 1))}
        </div>
      )}
    </div>
  );
};

  return (
    <Card className="p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">Maps</h3>
        {currentMap && getParentMap(currentMap) && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => {
              const parent = getParentMap(currentMap);
              if (parent) onMapSelect(parent);
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to {getParentMap(currentMap)?.name}
          </Button>
        )}
      </div>
      <ScrollArea className="h-[400px]">
        {rootMaps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No maps yet. Upload your first map to get started.</p>
        ) : (
          rootMaps.map(map => renderMapTree(map))
        )}
      </ScrollArea>
    </Card>
  );
};

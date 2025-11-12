import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, Plus } from "lucide-react";
import { MapData } from "@/types/world";
import { storage } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";

interface MapUploadProps {
  worldId: string;
  parentMapId?: string;
  onMapCreated: (map: MapData) => void;
}

export const MapUpload = ({ worldId, parentMapId, onMapCreated }: MapUploadProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setImageUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = async () => {
    if (!name || (!imageUrl && !selectedFile)) {
      toast({
        title: "Missing information",
        description: "Please provide a name and upload an image",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      let finalImageUrl = imageUrl;

      // If a File was selected, upload it to the server and use the returned path
      if (selectedFile) {
        const fd = new FormData();
        fd.append("file", selectedFile);

        const res = await fetch(`/api/world/${worldId}/upload`, {
          method: "POST",
          body: fd, // do NOT set Content-Type header
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error || json?.detail || "Upload failed");
        }

        finalImageUrl = json.path; // e.g. /worlds/:id/maps/filename.png
      }

      const maps = storage.getMapsForWorld(worldId);
      const level = parentMapId ? (maps.find(m => m.id === parentMapId)?.level || 0) + 1 : 0;

      const newMap: MapData = {
        id: `map_${Date.now()}`,
        worldId,
        name,
        imageUrl: finalImageUrl,
        parentMapId,
        level,
        elements: [],
      };

      storage.saveMap(worldId, newMap);
      onMapCreated(newMap);

      setOpen(false);
      setName("");
      setImageUrl("");
      setSelectedFile(null);

      toast({
        title: "Map created",
        description: `${name} has been added to your world`,
      });
    } catch (err: any) {
      console.error("Upload/create error", err);
      toast({
        title: "Upload failed",
        description: err?.message || "Could not upload image",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Add Map
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload New Map</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="map-name">Map Name</Label>
            <Input
              id="map-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., World Map, Waterdeep, Tavern"
            />
          </div>
          <div>
            <Label htmlFor="map-image">Map Image</Label>
            <div className="mt-2">
              <Input
                id="map-image"
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={handleImageUpload}
                disabled={uploading}
              />
            </div>
            {imageUrl && (
              <div className="mt-4 rounded-lg border border-border overflow-hidden">
                <img src={imageUrl} alt="Preview" className="w-full h-48 object-cover" />
              </div>
            )}
          </div>
          <Button onClick={handleCreate} className="w-full" disabled={uploading}>
            <Upload className="w-4 h-4 mr-2" />
            Create Map
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
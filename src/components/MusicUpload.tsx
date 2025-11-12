import { useState } from "react";
import { Button } from "@/components/ui/button";

interface MusicUploadProps {
  worldId: string;
  onUploaded: (path: string) => void;
}

export function MusicUpload({ worldId, onUploaded }: MusicUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/world/${worldId}/upload-music`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.path) onUploaded(data.path);
    } catch (err) {
      console.error("Music upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <input
        type="file"
        accept="audio/mp3"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <Button onClick={handleUpload} disabled={!file || uploading}>
        {uploading ? "Uploading..." : "Upload Music"}
      </Button>
    </div>
  );
}

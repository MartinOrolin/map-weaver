import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ImagePlus, Upload } from "lucide-react";

interface CreatureImageUploadProps {
  worldId: string;
  elementId: string;
  currentImageUrl?: string;
  onImageUploaded: (imageUrl: string) => void;
}

export const CreatureImageUpload = ({
  worldId,
  elementId,
  currentImageUrl,
  onImageUploaded,
}: CreatureImageUploadProps) => {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState(currentImageUrl || "");
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/world/${worldId}/upload-image`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      setImageUrl(data.path);
      onImageUploaded(data.path);
      
      toast({
        title: "Image uploaded",
        description: "Creature image has been uploaded successfully",
      });

      setOpen(false);
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleUrlSubmit = () => {
    if (!imageUrl.trim()) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid image URL",
        variant: "destructive",
      });
      return;
    }

    onImageUploaded(imageUrl);
    toast({
      title: "Image URL saved",
      description: "Creature image URL has been saved",
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="ml-2">
          <ImagePlus className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Creature Image</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {currentImageUrl && (
            <div className="w-full aspect-square max-h-48 relative">
              <img
                src={currentImageUrl}
                alt="Current creature"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
          )}
          
          <div>
            <Label htmlFor="file-upload">Upload from Computer</Label>
            <div className="mt-2">
              <Input
                id="file-upload"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
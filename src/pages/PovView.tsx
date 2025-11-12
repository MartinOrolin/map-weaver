// src/pages/PovView.tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { broadcastManager } from "@/lib/broadcast";
import { Card, CardContent } from "@/components/ui/card";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PovView() {
  const { worldId } = useParams<{ worldId: string }>();
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [creatureName, setCreatureName] = useState<string>("");

  useEffect(() => {
    if (!worldId) return;

    const unsubscribe = broadcastManager.subscribe((msg) => {
      if (msg.type === "creature_pov" && msg.worldId === worldId) {
        setCurrentImage(msg.imageUrl || null);
        setCreatureName(msg.creatureName || "");
      }
    });

    return unsubscribe;
  }, [worldId]);

  const handleClose = () => {
    setCurrentImage(null);
    setCreatureName("");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background/95 backdrop-blur-sm p-4">
      <Card className="w-full max-w-4xl relative">
        {currentImage ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10"
              onClick={handleClose}
            >
              <X className="w-5 h-5" />
            </Button>
            <CardContent className="p-6">
              {creatureName && (
                <h2 className="text-2xl font-bold text-center mb-4">{creatureName}</h2>
              )}
              <div className="relative w-full aspect-square max-h-[70vh]">
                <img
                  src={currentImage}
                  alt={creatureName || "Creature"}
                  className="w-full h-full object-contain rounded-lg"
                />
              </div>
            </CardContent>
          </>
        ) : (
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              Click on an NPC or Enemy in the Manage view to see their image here.
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

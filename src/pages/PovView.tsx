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
  const [selectedName, setSelectedName] = useState<string>("");
  const [nameVisible, setNameVisible] = useState(false);

  useEffect(() => {
    if (!worldId) return;

    const unsubscribe = broadcastManager.subscribe((msg) => {
      if (msg.type === "creature_pov" && msg.worldId === worldId) {
        setCurrentImage(msg.imageUrl || null);
        setSelectedName(msg.creatureName || "");
        setNameVisible(msg.nameVisible === true);
      }
    });

    return unsubscribe;
  }, [worldId]);

  const handleClose = () => {
    setCurrentImage(null);
    setSelectedName("");
    setNameVisible(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background/95 backdrop-blur-sm p-4">
      <Card className="w-full max-w-4xl relative">
        {currentImage || selectedName ? (
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
              {nameVisible && selectedName && (
                <h2 className="text-2xl font-bold text-center mb-4">{selectedName}</h2>
              )}
              <div className="relative w-full aspect-square max-h-[70vh] rounded-lg border border-border bg-muted flex items-center justify-center">
                {currentImage ? (
                  <img
                    src={currentImage}
                    alt={selectedName || "Selected element"}
                    className="w-full h-full object-contain rounded-lg"
                  />
                ) : (
                  <p className="text-muted-foreground">No portrait available</p>
                )}
              </div>
            </CardContent>
          </>
        ) : (
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              Select an element in the Manage view to preview it here.
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

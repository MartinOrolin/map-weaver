import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { World } from "@/types/world";
import { storage } from "@/lib/storage";
import { toast } from "sonner";

interface CreateWorldDialogProps {
  onWorldCreated: (world: World) => void;
  variant?: "default" | "hero";
}

export const CreateWorldDialog = ({ onWorldCreated, variant = "default" }: CreateWorldDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error("Please enter a world name");
      return;
    }

    const newWorld: World = {
      id: `world_${Date.now()}`,
      name: name.trim(),
      description: description.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.saveWorld(newWorld);
    onWorldCreated(newWorld);
    
    toast.success(`World "${newWorld.name}" created!`);
    
    setName("");
    setDescription("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "hero" ? (
          <Button 
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-[var(--shadow-deep)] hover:shadow-[var(--shadow-glow)] transition-all"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Your First World
          </Button>
        ) : (
          <Button 
            size="icon"
            className="fixed bottom-8 right-8 h-14 w-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-[var(--shadow-deep)] hover:shadow-[var(--shadow-glow)] hover:scale-110 transition-all z-50"
          >
            <Plus className="w-6 h-6" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-card border-2 border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl text-primary">Create New World</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Begin your adventure by naming your world and adding a description.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name" className="text-foreground">World Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Forgotten Realms"
              className="bg-input border-border text-foreground"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description" className="text-foreground">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your world..."
              className="bg-input border-border text-foreground resize-none"
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="border-border">
            Cancel
          </Button>
          <Button onClick={handleCreate} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            Create World
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

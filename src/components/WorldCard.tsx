import { World } from "@/types/world";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Calendar } from "lucide-react";

interface WorldCardProps {
  world: World;
  onClick: () => void;
}

export const WorldCard = ({ world, onClick }: WorldCardProps) => {
  return (
    <Card 
      className="cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-[var(--shadow-glow)] border-2 border-border hover:border-primary bg-card"
      onClick={onClick}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <MapPin className="w-5 h-5" />
          {world.name}
        </CardTitle>
        {world.description && (
          <CardDescription className="text-muted-foreground">
            {world.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>Created {new Date(world.createdAt).toLocaleDateString()}</span>
        </div>
      </CardContent>
    </Card>
  );
};

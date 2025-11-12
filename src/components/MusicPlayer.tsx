import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Music } from "lucide-react";

interface MusicPlayerProps {
  musicUrl?: string;
  autoPlayOnChange?: boolean;
}

export const MusicPlayer = ({ musicUrl, autoPlayOnChange = true }: MusicPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // When musicUrl changes (e.g., when map changes)
  useEffect(() => {
    if (!musicUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlaying(false);
      return;
    }

    // Replace audio source when new music is set
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const newAudio = new Audio(musicUrl);
    newAudio.loop = true;
    audioRef.current = newAudio;

    if (autoPlayOnChange) {
      newAudio.play().then(() => setIsPlaying(true)).catch(err => {
        console.warn("Autoplay failed:", err);
      });
    }

    return () => {
      newAudio.pause();
      newAudio.src = "";
    };
  }, [musicUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error("Audio playback failed:", err));
    }
  };

  if (!musicUrl) {
    return (
      <div className="flex items-center text-muted-foreground text-sm">
        <Music className="w-4 h-4 mr-1" /> No music
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={togglePlay}>
        {isPlaying ? (
          <>
            <Pause className="w-4 h-4 mr-1" /> Stop Music
          </>
        ) : (
          <>
            <Play className="w-4 h-4 mr-1" /> Play Music
          </>
        )}
      </Button>
    </div>
  );
};

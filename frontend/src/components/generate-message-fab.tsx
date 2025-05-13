import { useSelectedArticles } from "@/context/selected-articles-context";
import { Button } from "@/components/ui/button";
import { MessageSquare, X } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { MessageDialog } from "@/components/message-dialog";
import { usePersona } from "@/context/persona-context";

export function GenerateMessageFab() {
  const { selectedArticles, selectedCount, clearSelectedArticles } = useSelectedArticles();
  const { activePersona } = usePersona();
  const [isVisible, setIsVisible] = useState(false);
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  
  // Animation state to handle smooth entrance/exit
  const [isAnimating, setIsAnimating] = useState(false);
  
  useEffect(() => {
    if (selectedCount > 0 && !isVisible) {
      setIsAnimating(true);
      setIsVisible(true);
    } else if (selectedCount === 0 && isVisible) {
      setIsAnimating(false);
      // Keep the component mounted but hidden after animation completes
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 300); // Match the transition duration
      return () => clearTimeout(timer);
    }
  }, [selectedCount, isVisible]);
  
  if (!isVisible && selectedCount === 0) {
    return null;
  }
  
  const handleGenerateClick = () => {
    setIsMessageOpen(true);
  };
  
  return (
    <>
      <div 
        className={cn(
          "fixed bottom-6 right-6 z-50 flex flex-col gap-3 items-end transition-all duration-300 transform",
          isAnimating 
            ? "translate-y-0 opacity-100" 
            : "translate-y-12 opacity-0"
        )}
      >
        {/* Clear selection button */}
        <Button
          size="icon"
          variant="outline"
          className="rounded-full shadow-md bg-background h-10 w-10"
          onClick={clearSelectedArticles}
        >
          <X className="h-5 w-5" />
        </Button>
        
        {/* Main action button */}
        <Button
          size="lg"
          className="rounded-full shadow-lg px-6 gap-2"
          onClick={handleGenerateClick}
        >
          <MessageSquare className="h-5 w-5" />
          <span>Generate Message ({selectedCount})</span>
        </Button>
      </div>
      
      {/* Message generation dialog */}
      <MessageDialog
        open={isMessageOpen}
        onOpenChange={setIsMessageOpen}
        articles={selectedArticles}
        persona={activePersona}
        mode="generate"
      />
    </>
  );
} 
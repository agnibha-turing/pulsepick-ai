import { useState, useEffect } from "react";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { UserRound, Briefcase, Building, MessageSquare, User, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { usePersona } from "@/context/persona-context";
import { Badge } from "@/components/ui/badge";

export interface Persona {
  recipientName: string;
  jobTitle: string;
  company: string;
  conversationContext: string;
  personalityTraits: string;
}

interface PersonaInputCardProps {
  onPersonaSubmit?: (persona: Persona) => void;
  className?: string;
}

export function PersonaInputCard({ onPersonaSubmit, className }: PersonaInputCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { activePersona, setActivePersona, isPersonaActive } = usePersona();
  
  const [persona, setPersona] = useState<Persona>({
    recipientName: "",
    jobTitle: "",
    company: "",
    conversationContext: "",
    personalityTraits: ""
  });
  
  // Initialize from context when dialog opens
  useEffect(() => {
    if (isOpen && activePersona) {
      setPersona(activePersona);
    } else if (isOpen) {
      // Reset form when opening dialog without active persona
      setPersona({
        recipientName: "",
        jobTitle: "",
        company: "",
        conversationContext: "",
        personalityTraits: ""
      });
    }
  }, [isOpen, activePersona]);

  const handleInputChange = (field: keyof Persona, value: string) => {
    setPersona(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = () => {
    // Basic validation
    if (!persona.recipientName) {
      toast.error("Please enter a recipient name");
      return;
    }

    // Update context
    setActivePersona(persona);
    
    // Call parent callback if provided
    if (onPersonaSubmit) {
      onPersonaSubmit(persona);
    }
    
    toast.success("Persona applied successfully");
    setIsOpen(false);
  };

  const handleReset = () => {
    const emptyPersona = {
      recipientName: "",
      jobTitle: "",
      company: "",
      conversationContext: "",
      personalityTraits: ""
    };
    
    setPersona(emptyPersona);
    setActivePersona(null);
    toast.info("Persona details cleared");
  };

  return (
    <div className={`${className}`}>
      {/* Trigger button */}
      <Button 
        variant={isPersonaActive ? "default" : "outline"}
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2"
        size="sm"
      >
        <UserPlus className="h-4 w-4" />
        {isPersonaActive 
          ? `For ${activePersona?.recipientName}` 
          : "Persona"}
        
        {isPersonaActive && (
          <Badge variant="secondary" className="ml-1">
            Active
          </Badge>
        )}
      </Button>
      
      {/* Persona popup dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[600px] bg-background/95 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Recipient Persona</DialogTitle>
            <DialogDescription>
              Describe who you're sending content to for better personalization
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="recipientName" className="text-sm font-medium flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                  Recipient Name
                </label>
                <Input 
                  id="recipientName"
                  placeholder="e.g. Peter Smith" 
                  value={persona.recipientName}
                  onChange={(e) => handleInputChange('recipientName', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="jobTitle" className="text-sm font-medium flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  Job Title
                </label>
                <Input 
                  id="jobTitle"
                  placeholder="e.g. Head of AI Research" 
                  value={persona.jobTitle}
                  onChange={(e) => handleInputChange('jobTitle', e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="company" className="text-sm font-medium flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                Company
              </label>
              <Input 
                id="company"
                placeholder="e.g. Siemens" 
                value={persona.company}
                onChange={(e) => handleInputChange('company', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="conversationContext" className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                Conversation Context
              </label>
              <Textarea 
                id="conversationContext"
                placeholder="e.g. We talked about MCP last time" 
                value={persona.conversationContext}
                onChange={(e) => handleInputChange('conversationContext', e.target.value)}
                className="min-h-[60px]"
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="personalityTraits" className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Personality Traits
              </label>
              <Textarea 
                id="personalityTraits"
                placeholder="e.g. He's a serious guy but appreciates subtle humor" 
                value={persona.personalityTraits}
                onChange={(e) => handleInputChange('personalityTraits', e.target.value)}
                className="min-h-[60px]"
              />
            </div>
          </div>
          
          <DialogFooter className="flex justify-between gap-2">
            {isPersonaActive && (
              <Button variant="outline" onClick={handleReset} className="mr-auto">
                Clear Persona
              </Button>
            )}
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleSubmit}>Apply Persona</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
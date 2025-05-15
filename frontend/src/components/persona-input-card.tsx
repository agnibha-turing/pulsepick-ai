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
import { 
  UserRound, 
  Briefcase, 
  Building, 
  MessageSquare, 
  User, 
  UserPlus, 
  Save,
  Trash,
  RefreshCw,
  ChevronDown,
  Check,
  Plus,
  ChevronRight,
  Settings
} from "lucide-react";
import { toast } from "sonner";
import { usePersona } from "@/context/persona-context";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

// Custom styles to override focus ring styles
const inputStyles = "focus-visible:ring-1 focus-visible:ring-offset-0";

export interface Persona {
  recipientName: string;
  jobTitle: string;
  company: string;
  conversationContext: string;
  personalityTraits: string;
}

export interface PersonaInputCardProps {
  onPersonaSubmit?: (persona: Persona) => void;
  className?: string;
  onRefreshRequest?: () => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function PersonaInputCard({ 
  onPersonaSubmit, 
  className, 
  onRefreshRequest,
  isOpen: controlledOpen,
  onOpenChange
}: PersonaInputCardProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { 
    activePersona, 
    setActivePersona, 
    isPersonaActive,
    savedPersonas,
    savePersona,
    updatePersona,
    removePersona,
    isLoading,
    error
  } = usePersona();
  const [isApplying, setIsApplying] = useState(false);
  const [showSaveButton, setShowSaveButton] = useState(false);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [initialPersona, setInitialPersona] = useState<Persona | null>(null);
  const [savedPersonasOpen, setSavedPersonasOpen] = useState(false);
  const [quickSelectOpen, setQuickSelectOpen] = useState(false);
  const [saveAnimation, setSaveAnimation] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  
  // Determine if dialog is open - controlled or uncontrolled
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  
  // Handle open state changes
  const handleOpenChange = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    } else {
      setInternalOpen(open);
    }
    // Reset creating new flag when closing
    if (!open) {
      setIsCreatingNew(false);
    }
  };
  
  const [persona, setPersona] = useState<Persona>({
    recipientName: "",
    jobTitle: "",
    company: "",
    conversationContext: "",
    personalityTraits: ""
  });
  
  // Check if the current persona is saved
  const isCurrentPersonaSaved = () => {
    if (!persona.recipientName) return false;
    
    return savedPersonas.some(
      p => p.recipientName === persona.recipientName && 
           p.company === persona.company &&
           p.jobTitle === persona.jobTitle
    );
  };
  
  // Initialize from context when dialog opens
  useEffect(() => {
    if (isOpen && activePersona) {
      setPersona(activePersona);
      setInitialPersona(activePersona);
      setIsEditingExisting(isCurrentPersonaSaved());
      setIsCreatingNew(false);
    } else if (isOpen) {
      // Reset form when opening dialog without active persona
      setPersona({
        recipientName: "",
        jobTitle: "",
        company: "",
        conversationContext: "",
        personalityTraits: ""
      });
      setInitialPersona(null);
      setIsEditingExisting(false);
      setIsCreatingNew(true);
    }
  }, [isOpen, activePersona, savedPersonas]);

  // Update showSaveButton based on form changes
  useEffect(() => {
    // Only show save button if form has values and either:
    // 1. it's a new persona not yet saved OR
    // 2. it's an existing persona that's been modified
    if (!persona.recipientName) {
      setShowSaveButton(false);
      return;
    }
    
    const isSaved = isCurrentPersonaSaved();
    const isModified = initialPersona && (
      persona.recipientName !== initialPersona.recipientName ||
      persona.jobTitle !== initialPersona.jobTitle ||
      persona.company !== initialPersona.company ||
      persona.conversationContext !== initialPersona.conversationContext ||
      persona.personalityTraits !== initialPersona.personalityTraits
    );
    
    setShowSaveButton(!isSaved || isModified);
    setIsEditingExisting(isSaved);
  }, [persona, initialPersona, savedPersonas]);

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

    setIsApplying(true);
    // Change the toast message to be more specific about what's happening
    toast.info(`Applying persona: ${persona.recipientName}`, {
      description: "Setting up persona profile",
      duration: 2000
    });

    // Update context
    setActivePersona(persona);
    
    // Call parent callback if provided
    if (onPersonaSubmit) {
      onPersonaSubmit(persona);
    }
    
    // Request article refresh to apply persona-based ranking
    if (onRefreshRequest) {
      onRefreshRequest();
    }
    
    setTimeout(() => {
      toast.success("Persona profile applied", {
        description: "Content personalization will start shortly",
        duration: 3000
      });
      setIsApplying(false);
      handleOpenChange(false);
    }, 500);
  };

  const handleSavePersona = () => {
    if (!persona.recipientName) {
      toast.error("Please enter a recipient name");
      return;
    }
    
    // Trigger save animation
    setSaveAnimation(true);
    
    setTimeout(() => {
      if (isEditingExisting && initialPersona) {
        // Update existing persona
        updatePersona(initialPersona, persona);
        if (!error) {
          toast.success("Persona updated in saved list");
        }
      } else {
        // Save as new persona
        savePersona(persona);
        if (!error) {
          toast.success("Persona saved for future use");
        }
      }
      
      setInitialPersona(persona);
      setIsEditingExisting(true);
      setIsCreatingNew(false);
      setSaveAnimation(false);
    }, 300);
  };
  
  const handleDeletePersona = () => {
    if (!persona.recipientName) return;
    
    removePersona(persona);
    if (!error) {
      toast.success("Persona removed from saved list");
    }
    
    // If we're editing this persona, reset the form
    setIsEditingExisting(false);
    setIsCreatingNew(true);
    
    // Reset the form
    setPersona({
      recipientName: "",
      jobTitle: "",
      company: "",
      conversationContext: "",
      personalityTraits: ""
    });
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
    toast.info("Persona removed");

    setInitialPersona(null);
    setIsEditingExisting(false);
    setIsCreatingNew(true);
  };
  
  const handleSelectPersona = (selected: Persona) => {
    setPersona(selected);
    setInitialPersona(selected);
    setIsEditingExisting(true);
    setIsCreatingNew(false);
    setSavedPersonasOpen(false);
  };

  const handleCreateNew = () => {
    setPersona({
      recipientName: "",
      jobTitle: "",
      company: "",
      conversationContext: "",
      personalityTraits: ""
    });
    setInitialPersona(null);
    setIsEditingExisting(false);
    setIsCreatingNew(true);
    setSavedPersonasOpen(false);
  };

  // Quick-apply persona from outside the dialog
  const handleQuickApplyPersona = (selected: Persona) => {
    setQuickSelectOpen(false);
    setIsApplying(true);
    toast.info(`Applying persona: ${selected.recipientName}`, {
      description: "Setting up persona profile",
      duration: 2000
    });
    
    // Update context
    setActivePersona(selected);
    
    // Call parent callback if provided
    if (onPersonaSubmit) {
      onPersonaSubmit(selected);
    }
    
    // Request article refresh to apply persona-based ranking
    if (onRefreshRequest) {
      onRefreshRequest();
    }
    
    setTimeout(() => {
      toast.success("Persona profile applied", {
        description: "Content personalization will start shortly",
        duration: 3000
      });
      setIsApplying(false);
    }, 500);
  };
  
  // Helper to get initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };
  
  // Check if persona matches active persona
  const isActivePersona = (p: Persona) => {
    return activePersona && 
           p.recipientName === activePersona.recipientName && 
           p.company === activePersona.company && 
           p.jobTitle === activePersona.jobTitle;
  };

  return (
    <div className={`${className}`}>
      {/* Split button with dropdown */}
      <div className="flex">
        <Button 
          variant={isPersonaActive ? "default" : "outline"}
          size="sm"
          disabled={isApplying}
          onClick={() => handleOpenChange(true)}
          className="rounded-r-none border-r-0 flex items-center gap-1 min-w-0 px-2"
        >
          {isApplying ? (
            <>
              <RefreshCw className="animate-spin h-3.5 w-3.5" />
              <span className="hidden sm:inline ml-1">Persona</span>
            </>
          ) : (
            <>
              <UserPlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline ml-1">
                {isPersonaActive 
                  ? activePersona?.recipientName.split(' ')[0] 
                  : "Persona"}
              </span>
              
              {isPersonaActive && (
                <Badge variant="secondary" className="hidden sm:inline-flex ml-1 py-0 h-4 text-[10px]">
                  Active
                </Badge>
              )}
            </>
          )}
        </Button>

        <DropdownMenu open={quickSelectOpen} onOpenChange={setQuickSelectOpen}>
          <DropdownMenuTrigger asChild>
            <Button 
              variant={isPersonaActive ? "default" : "outline"}
              size="sm"
              disabled={isApplying}
              className="rounded-l-none px-1 border-l-0"
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent className="w-[300px] px-0 py-0 shadow-lg" align="end" sideOffset={5}>
            <div className="px-3 py-2 font-medium text-sm flex items-center justify-between border-b">
              <span>Select Persona</span>
              {savedPersonas.length > 0 && (
                <Badge variant="secondary" className="font-normal">
                  {savedPersonas.length}
                </Badge>
              )}
            </div>
            
            {savedPersonas.length > 0 ? (
              <div style={{ 
                maxHeight: '200px', 
                overflowY: 'auto',
                scrollBehavior: 'smooth',
                WebkitOverflowScrolling: 'touch'
              }}>
                {savedPersonas.map((savedPersona, index) => (
                  <div 
                    key={index}
                    className={cn(
                      "px-3 py-2 cursor-pointer hover:bg-muted transition-colors duration-150",
                      isActivePersona(savedPersona) ? "bg-muted/50" : ""
                    )}
                    onClick={() => handleQuickApplyPersona(savedPersona)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border shrink-0">
                        <AvatarFallback className="text-sm bg-primary/10 text-primary font-medium">
                          {getInitials(savedPersona.recipientName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="font-medium flex items-center gap-2 text-sm truncate">
                          {savedPersona.recipientName}
                          {isActivePersona(savedPersona) && (
                            <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {savedPersona.jobTitle} {savedPersona.company ? `· ${savedPersona.company}` : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No saved personas yet
              </div>
            )}
            
            <div 
              className="px-3 py-2 cursor-pointer flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 border-t"
              onClick={() => {
                setQuickSelectOpen(false);
                handleOpenChange(true);
              }}
            >
              <UserPlus className="h-4 w-4" />
              <span className="text-sm font-medium">
                {savedPersonas.length > 0 ? "Manage Personas" : "Create New Persona"}
              </span>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Persona popup dialog */}
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-[600px] bg-background/95 backdrop-blur-md p-4 pt-3">
          <DialogHeader className="pb-0">
            <DialogTitle className="text-xl">Recipient Persona</DialogTitle>
            <DialogDescription>
              Describe who you're sending content to for better personalization
            </DialogDescription>
          </DialogHeader>
          
          {/* Saved personas selector */}
          <div className="mt-2 mb-2">
            <Popover open={savedPersonasOpen} onOpenChange={setSavedPersonasOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className={cn("w-full justify-between h-9", inputStyles)}
                  disabled={isLoading}
                >
                  <div className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-muted-foreground" />
                    {isLoading ? "Loading personas..." : "Select saved persona"}
                  </div>
                  <Badge variant="secondary">{savedPersonas.length}</Badge>
                </Button>
              </PopoverTrigger>
              
              <PopoverContent className="w-[450px] p-0" align="start">
                <div className="p-2 border-b">
                  <h3 className="font-medium px-2 py-1.5">Saved Personas</h3>
                  {error && (
                    <div className="px-2 py-1 text-sm text-destructive">
                      {error}
                    </div>
                  )}
                </div>
                
                {/* Enhanced scrollable div with focus capture and event handling */}
                <div 
                  className="overflow-y-auto focus:outline-none" 
                  style={{ 
                    maxHeight: '250px',
                    overscrollBehavior: 'contain',
                    WebkitOverflowScrolling: 'touch'
                  }}
                  tabIndex={0}
                  onMouseEnter={(e) => e.currentTarget.focus()}
                >
                  {/* Create new option */}
                  <div
                    className={cn(
                      "mx-2 my-1 p-2 rounded-md cursor-pointer flex items-center gap-3",
                      isCreatingNew 
                        ? "bg-primary/5 border border-primary/20" 
                        : "hover:bg-muted border border-transparent"
                    )}
                    onClick={handleCreateNew}
                  >
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Plus className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className="font-medium">Create new persona</p>
                      <p className="text-xs text-muted-foreground truncate">
                        Set up a new recipient profile
                      </p>
                    </div>
                    {isCreatingNew && (
                      <Check className="h-4 w-4 text-primary ml-auto shrink-0" />
                    )}
                  </div>
                  
                  {/* Saved personas */}
                  {savedPersonas.map((savedPersona, index) => (
                    <div
                      key={index}
                      className={cn(
                        "mx-2 my-1 p-2 rounded-md cursor-pointer flex items-center gap-3",
                        persona.recipientName === savedPersona.recipientName && !isCreatingNew
                          ? "bg-primary/5 border border-primary/20" 
                          : "hover:bg-muted border border-transparent"
                      )}
                      onClick={() => handleSelectPersona(savedPersona)}
                    >
                      <Avatar className="h-10 w-10 border shrink-0">
                        <AvatarFallback className="text-sm bg-primary/10 text-primary">
                          {getInitials(savedPersona.recipientName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="font-medium truncate">{savedPersona.recipientName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {savedPersona.jobTitle} {savedPersona.company ? `· ${savedPersona.company}` : ''}
                        </p>
                      </div>
                      {persona.recipientName === savedPersona.recipientName && !isCreatingNew && (
                        <Check className="h-4 w-4 text-primary ml-auto shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="mb-0.5">
            <h2 className="text-sm font-medium text-muted-foreground">
              {isEditingExisting ? "Edit Persona" : "New Persona"}
            </h2>
          </div>

          <motion.div 
            className="space-y-3"
            animate={saveAnimation ? { scale: 0.99, opacity: 0.9 } : { scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="recipientName" className="text-sm font-medium flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                  Recipient Name
                </label>
                <Input 
                  id="recipientName"
                  placeholder="e.g. Peter Smith" 
                  value={persona.recipientName}
                  onChange={(e) => handleInputChange('recipientName', e.target.value)}
                  className={inputStyles}
                />
              </div>
              
              <div className="space-y-1">
                <label htmlFor="jobTitle" className="text-sm font-medium flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  Job Title
                </label>
                <Input 
                  id="jobTitle"
                  placeholder="e.g. Head of AI Research" 
                  value={persona.jobTitle}
                  onChange={(e) => handleInputChange('jobTitle', e.target.value)}
                  className={inputStyles}
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <label htmlFor="company" className="text-sm font-medium flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                Company
              </label>
              <Input 
                id="company"
                placeholder="e.g. Siemens" 
                value={persona.company}
                onChange={(e) => handleInputChange('company', e.target.value)}
                className={inputStyles}
              />
            </div>
            
            <div className="space-y-1">
              <label htmlFor="conversationContext" className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                Conversation Context
              </label>
              <Textarea 
                id="conversationContext"
                placeholder="e.g. We talked about MCP last time" 
                value={persona.conversationContext}
                onChange={(e) => handleInputChange('conversationContext', e.target.value)}
                className={cn("min-h-[50px] max-h-[100px] resize-none", inputStyles)}
              />
            </div>
            
            <div className="space-y-1">
              <label htmlFor="personalityTraits" className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Personality Traits
              </label>
              <Textarea 
                id="personalityTraits"
                placeholder="e.g. He's a serious guy but appreciates subtle humor" 
                value={persona.personalityTraits}
                onChange={(e) => handleInputChange('personalityTraits', e.target.value)}
                className={cn("min-h-[50px] max-h-[100px] resize-none", inputStyles)}
              />
            </div>
          </motion.div>
          
          <DialogFooter className="flex gap-2 flex-wrap sm:flex-nowrap mt-3">
            <div className="flex gap-2 mr-auto">
              {(isEditingExisting || isPersonaActive) && (
                <Button variant="outline" onClick={handleReset} className="text-muted-foreground">
                  Clear
                </Button>
              )}
              
              {isEditingExisting && (
                <Button 
                  variant="outline" 
                  onClick={handleDeletePersona} 
                  className="text-destructive hover:bg-destructive/10"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Trash className="h-4 w-4 mr-1.5" />
                  )}
                  Delete
                </Button>
              )}
            </div>
              
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
                
              {showSaveButton && (
                <Button 
                  variant="outline" 
                  onClick={handleSavePersona}
                  className={`relative overflow-hidden ${saveAnimation ? 'animate-pulse' : ''}`}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1.5" />
                  )}
                  Save
                  {saveAnimation && (
                    <span className="absolute inset-0 bg-primary/10 animate-pulse" />
                  )}
                </Button>
              )}
              
              <Button 
                onClick={handleSubmit} 
                className="px-6"
                disabled={isApplying || isLoading}
              >
                {isApplying || isLoading ? (
                  <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                ) : null}
                Apply Persona
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
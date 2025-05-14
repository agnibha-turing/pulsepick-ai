import { useState, useEffect, useCallback } from "react";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DisplayArticle } from "@/services/article-service";
import { Persona } from "@/components/persona-input-card";
import { Linkedin, Twitter, Mail, Slack, RefreshCw, ScrollText, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { generateMessage } from "@/services/message-service";

interface MessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articles: DisplayArticle[];
  persona?: Persona | null;
  mode: "share" | "generate";
}

export function MessageDialog({ open, onOpenChange, articles, persona, mode }: MessageDialogProps) {
  const isSingleArticle = articles.length === 1;
  const article = articles[0]; // For single article share mode
  
  const [linkedinMessage, setLinkedinMessage] = useState("");
  const [twitterMessage, setTwitterMessage] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [slackMessage, setSlackMessage] = useState("");
  
  // Loading states for each platform
  const [isLoading, setIsLoading] = useState({
    linkedin: false,
    twitter: false,
    email: false,
    slack: false
  });
  
  // Legacy client-side fallback generator
  const generateShareMessages = useCallback((article: DisplayArticle) => {
    const messages = {
      linkedin: `I found this valuable insight on ${article.title} that might interest my network. #PulsePick #ProfessionalInsights ${article.categories.map(c => `#${c.replace(/\s+/g, '')}`).join(' ')}`,
      twitter: `Check out this key insight: "${article.title}" via @PulsePick ${article.categories.map(c => `#${c.replace(/\s+/g, '')}`).join(' ')}`,
      email: `Subject: Thought you might find this interesting\n\nHi${persona?.recipientName ? ' ' + persona.recipientName : ''},\n\nI came across this article that I think could be relevant to our discussion:\n\n"${article.title}"\n\n${article.summary[0]}\n\nBest regards,`,
      slack: `*Here's an insight I found valuable:*\n"${article.title}"\n>${article.summary[0]}\nvia PulsePick`
    };
    
    setLinkedinMessage(messages.linkedin);
    setTwitterMessage(messages.twitter);
    setEmailMessage(messages.email);
    setSlackMessage(messages.slack);
  }, [persona]);
  
  // Function to generate messages for all platforms
  const generateAllMessages = useCallback(async () => {
    setIsLoading({
      linkedin: true,
      twitter: true,
      email: true,
      slack: true
    });
    
    try {
      // Generate messages for all platforms in parallel
      const [emailMsg, linkedinMsg, twitterMsg, slackMsg] = await Promise.all([
        generateMessage({ articles, persona, platform: "email" }),
        generateMessage({ articles, persona, platform: "linkedin" }),
        generateMessage({ articles, persona, platform: "twitter" }),
        generateMessage({ articles, persona, platform: "slack" })
      ]);
      
      setEmailMessage(emailMsg);
      setLinkedinMessage(linkedinMsg);
      setTwitterMessage(twitterMsg);
      setSlackMessage(slackMsg);
    } catch (error) {
      console.error("Error generating initial messages:", error);
      // If API fails, use client-side fallback generators
      generateShareMessages(article);
    } finally {
      setIsLoading({
        linkedin: false,
        twitter: false,
        email: false,
        slack: false
      });
    }
  }, [articles, persona, article, generateShareMessages]);
  
  // Generate initial messages when dialog opens or articles/persona change
  useEffect(() => {
    if (open) {
      generateAllMessages();
    }
  }, [open, generateAllMessages]);
  
  // Regenerate messages with API
  const handleRegenerateCaption = async (platform: string) => {
    // Set loading state for the specific platform
    setIsLoading(prev => ({ ...prev, [platform]: true }));
    
    try {
      // Call the API with regenerate flag
      const message = await generateMessage({
        articles,
        persona,
        platform: platform as "email" | "linkedin" | "twitter" | "slack",
        regenerate: true
      });
      
      // Update the appropriate message state
      switch(platform) {
        case "linkedin":
          setLinkedinMessage(message);
          break;
        case "twitter":
          setTwitterMessage(message);
          break;
        case "email":
          setEmailMessage(message);
          break;
        case "slack":
          setSlackMessage(message);
          break;
      }
      
      toast.success("Message regenerated", {
        description: "New AI-powered message created",
      });
    } catch (error) {
      console.error(`Error regenerating ${platform} message:`, error);
      toast.error(`Failed to regenerate message for ${platform}`);
    } finally {
      // Clear loading state
      setIsLoading(prev => ({ ...prev, [platform]: false }));
    }
  };
  
  // Handle sharing
  const handleShare = (platform: string) => {
    toast.success(`Ready to send via ${platform}`, {
      description: "Message copied to clipboard",
    });
    onOpenChange(false);
  };
  
  // Copy message to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>
            Generate Personalized Message
          </DialogTitle>
          <DialogDescription>
            Create and share content using selected articles
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-2">
          {/* Selected articles summary - always shown */}
          <div className="border rounded-md p-3 bg-muted/20">
            <h3 className="text-sm font-medium mb-2">Selected Articles</h3>
            <div className="space-y-2 h-[100px] overflow-y-auto pr-2">
              {articles.map((article) => (
                <div key={article.id} className="flex items-start gap-2 text-sm">
                  <span className="text-muted-foreground mt-0.5">•</span>
                  <div>
                    <p className="font-medium">{article.title}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {article.categories.slice(0, 2).map(cat => (
                        <Badge key={cat} variant="secondary" className="text-xs">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Persona info if available - always shown if persona exists */}
          {persona && (
            <div className="border rounded-md p-3 bg-primary/5">
              <h3 className="text-sm font-medium mb-1">Personalizing for</h3>
              <p className="text-sm">
                <span className="font-medium">{persona.recipientName}</span>
                {persona.jobTitle && `, ${persona.jobTitle}`}
                {persona.company && ` at ${persona.company}`}
              </p>
              {persona.personalityTraits && (
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium">Note:</span> {persona.personalityTraits}
                </p>
              )}
            </div>
          )}
          
          {/* Platform tabs for both single and multi-article modes */}
          <Tabs defaultValue="email" className="mt-2">
            <TabsList className="grid grid-cols-4 mb-4">
              <TabsTrigger value="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">Email</span>
              </TabsTrigger>
              <TabsTrigger value="linkedin" className="flex items-center gap-2">
                <Linkedin className="h-4 w-4" />
                <span className="hidden sm:inline">LinkedIn</span>
              </TabsTrigger>
              <TabsTrigger value="twitter" className="flex items-center gap-2">
                <Twitter className="h-4 w-4" />
                <span className="hidden sm:inline">X/Twitter</span>
              </TabsTrigger>
              <TabsTrigger value="slack" className="flex items-center gap-2">
                <Slack className="h-4 w-4" />
                <span className="hidden sm:inline">Slack</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="email" className="space-y-4">
              <div className="relative">
                <Textarea 
                  value={emailMessage} 
                  onChange={(e) => setEmailMessage(e.target.value)}
                  className="min-h-[200px] h-[200px] font-mono text-sm"
                />
                {isLoading.email && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground mt-2">Generating email message...</p>
                  </div>
                )}
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => handleRegenerateCaption("email")} disabled={isLoading.email}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading.email ? 'animate-spin' : ''}`} />
                  Regenerate
                </Button>
                <Button variant="default" onClick={() => copyToClipboard(emailMessage)}>
                  <ScrollText className="h-4 w-4 mr-2" />
                  Copy to Clipboard
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="linkedin" className="space-y-4">
              <div className="relative">
                <Textarea 
                  value={linkedinMessage} 
                  onChange={(e) => setLinkedinMessage(e.target.value)}
                  className="min-h-[200px] h-[200px] font-mono text-sm"
                />
                {isLoading.linkedin && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground mt-2">Generating LinkedIn post...</p>
                  </div>
                )}
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => handleRegenerateCaption("linkedin")} disabled={isLoading.linkedin}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading.linkedin ? 'animate-spin' : ''}`} />
                  Regenerate
                </Button>
                <Button variant="default" onClick={() => copyToClipboard(linkedinMessage)}>
                  <ScrollText className="h-4 w-4 mr-2" />
                  Copy to Clipboard
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="twitter" className="space-y-4">
              <div className="relative">
                <Textarea 
                  value={twitterMessage} 
                  onChange={(e) => setTwitterMessage(e.target.value)}
                  className="min-h-[200px] h-[200px] font-mono text-sm"
                />
                {isLoading.twitter && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground mt-2">Generating X/Twitter post...</p>
                  </div>
                )}
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => handleRegenerateCaption("twitter")} disabled={isLoading.twitter}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading.twitter ? 'animate-spin' : ''}`} />
                  Regenerate
                </Button>
                <Button variant="default" onClick={() => copyToClipboard(twitterMessage)}>
                  <ScrollText className="h-4 w-4 mr-2" />
                  Copy to Clipboard
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="slack" className="space-y-4">
              <div className="relative">
                <Textarea 
                  value={slackMessage} 
                  onChange={(e) => setSlackMessage(e.target.value)}
                  className="min-h-[200px] h-[200px] font-mono text-sm"
                />
                {isLoading.slack && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground mt-2">Generating Slack message...</p>
                  </div>
                )}
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => handleRegenerateCaption("slack")} disabled={isLoading.slack}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading.slack ? 'animate-spin' : ''}`} />
                  Regenerate
                </Button>
                <Button variant="default" onClick={() => copyToClipboard(slackMessage)}>
                  <ScrollText className="h-4 w-4 mr-2" />
                  Copy to Clipboard
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
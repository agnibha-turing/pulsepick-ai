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
import { Linkedin, Twitter, Mail, MessageSquare, RefreshCw, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  
  // Generate initial messages when dialog opens or articles/persona change
  useEffect(() => {
    if (open) {
      if (isSingleArticle) {
        // Single article sharing
        generateShareMessages(article);
      } else {
        // Multiple article message generation
        generateMultiArticleMessages(articles, persona);
      }
    }
  }, [open, articles, persona, mode]);
  
  // Generate share messages for a single article
  const generateShareMessages = (article: DisplayArticle) => {
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
  };
  
  // Generate personalized multi-article messages for each platform
  const generateMultiArticleMessages = (articles: DisplayArticle[], persona?: Persona | null) => {
    // LinkedIn message - Professional, concise with hashtags
    let linkedinMsg = `I wanted to share some key industry insights that might be valuable${persona?.recipientName ? ' for professionals like ' + persona.recipientName : ''}:\n\n`;
    articles.forEach((article, i) => {
      if (i < 3) { // Only include first 3 articles explicitly for LinkedIn
        linkedinMsg += `• "${article.title}"\n`;
      }
    });
    if (articles.length > 3) {
      linkedinMsg += `...and ${articles.length - 3} more insights\n\n`;
    }
    linkedinMsg += `#ProfessionalInsights #PulsePick`;
    if (articles[0]?.categories?.[0]) {
      linkedinMsg += ` #${articles[0].categories[0].replace(/\s+/g, '')}`;
    }
    
    // Twitter/X message - Very concise
    let twitterMsg = `Check out these top insights I've curated`;
    if (persona?.recipientName) {
      twitterMsg += ` for ${persona.recipientName}`;
    }
    twitterMsg += `:\n\n`;
    articles.forEach((article, i) => {
      if (i < 2) { // Only include first 2 articles for Twitter due to character limit
        twitterMsg += `${i+1}. ${article.title.substring(0, 60)}${article.title.length > 60 ? '...' : ''}\n`;
      }
    });
    if (articles.length > 2) {
      twitterMsg += `...and ${articles.length - 2} more\n`;
    }
    twitterMsg += `\n#PulsePick`;
    
    // Email message - More comprehensive and formal
    let emailMsg = `Subject: Curated Industry Insights${persona?.recipientName ? ' for ' + persona.recipientName : ''}\n\n`;
    emailMsg += `Hi${persona?.recipientName ? ' ' + persona.recipientName : ''},\n\n`;
    emailMsg += `I thought you might find these recent insights valuable${persona?.jobTitle ? ' for your role as ' + persona.jobTitle : ''}:\n\n`;
    
    articles.forEach((article, index) => {
      emailMsg += `${index + 1}. "${article.title}"\n`;
      emailMsg += `   ${article.summary[0].substring(0, 100)}...\n\n`;
    });
    
    if (persona?.conversationContext) {
      emailMsg += `This reminded me of our conversation about ${persona.conversationContext}.\n\n`;
    }
    
    // Adjust tone based on personality traits
    if (persona?.personalityTraits) {
      const hasHumor = persona.personalityTraits.toLowerCase().includes('humor');
      const isSerious = persona.personalityTraits.toLowerCase().includes('serious');
      
      if (hasHumor) {
        emailMsg += "Hope these provide some useful food for thought – and perhaps even a bit of intellectual entertainment!\n\n";
      } else if (isSerious) {
        emailMsg += "I believe these insights might provide valuable perspectives for your consideration.\n\n";
      } else {
        emailMsg += "I'd be interested to hear your thoughts on these when you have a moment.\n\n";
      }
    } else {
      emailMsg += "I'd be interested to hear your thoughts on these when you have a moment.\n\n";
    }
    
    emailMsg += "Best regards,";
    
    // Slack message - More casual, formatted for Slack
    let slackMsg = `*Curated insights${persona?.recipientName ? ' for ' + persona.recipientName : ''}:*\n\n`;
    
    articles.forEach((article, index) => {
      slackMsg += `*${index + 1}. ${article.title}*\n`;
      slackMsg += `>${article.summary[0].substring(0, 100)}...\n\n`;
    });
    
    if (persona?.conversationContext) {
      slackMsg += `_Related to our discussion about ${persona.conversationContext}_\n\n`;
    }
    
    slackMsg += `Let me know what you think! 👍`;
    
    setLinkedinMessage(linkedinMsg);
    setTwitterMessage(twitterMsg);
    setEmailMessage(emailMsg);
    setSlackMessage(slackMsg);
  };
  
  // Regenerate messages
  const handleRegenerateCaption = (platform: string) => {
    if (isSingleArticle) {
      const messages = {
        linkedin: `I wanted to share this valuable industry insight from PulsePick: "${article.title}". This could impact our strategy in the ${article.categories[0]} sector. #ThoughtLeadership #${article.categories[0].replace(/\s+/g, '')} #IndustryInsights`,
        twitter: `Key finding: ${article.summary[0].substring(0, 100)}... (via @PulsePick) #${article.categories[0].replace(/\s+/g, '')}`,
        email: `Subject: Strategic insight to consider\n\nHi${persona?.recipientName ? ' ' + persona.recipientName : ''},\n\nThis recent analysis could be valuable for our upcoming planning:\n\n"${article.title}"\n\nKey points:\n- ${article.summary[0]}\n\nLet's discuss this at our next meeting.\n\nBest,`,
        slack: `*Strategic insight alert* 📊\n"${article.title}"\n>${article.summary[0]}\nSource: ${article.source}`
      };

      switch(platform) {
        case "linkedin":
          setLinkedinMessage(messages.linkedin);
          break;
        case "twitter":
          setTwitterMessage(messages.twitter);
          break;
        case "email":
          setEmailMessage(messages.email);
          break;
        case "slack":
          setSlackMessage(messages.slack);
          break;
      }
    } else {
      // Regenerate multi-article messages with slight variations
      let linkedinMsg = `I've curated some valuable industry insights that might interest my network${persona?.recipientName ? ', especially for professionals like ' + persona.recipientName : ''}.\n\n`;
      articles.forEach((article, i) => {
        if (i < 3) {
          linkedinMsg += `• ${article.title}\n`;
        }
      });
      if (articles.length > 3) {
        linkedinMsg += `...plus ${articles.length - 3} more key findings\n\n`;
      }
      linkedinMsg += `#MarketInsights #PulsePick`;
      
      let twitterMsg = `Just compiled these essential insights${persona?.recipientName ? ' for ' + persona.recipientName : ''}:\n\n`;
      articles.forEach((article, i) => {
        if (i < 2) {
          twitterMsg += `${i+1}. "${article.title.substring(0, 50)}${article.title.length > 50 ? '...' : ''}"\n`;
        }
      });
      if (articles.length > 2) {
        twitterMsg += `...and more via @PulsePick\n`;
      }
      
      let emailMsg = `Subject: Important Industry Updates${persona?.recipientName ? ' for ' + persona.recipientName : ''}\n\n`;
      emailMsg += `Hi${persona?.recipientName ? ' ' + persona.recipientName : ''},\n\n`;
      emailMsg += `I've compiled these recent developments that could be valuable for ${persona?.jobTitle ? 'your work as ' + persona.jobTitle : 'your strategic planning'}:\n\n`;
      
      articles.forEach((article, index) => {
        emailMsg += `${index + 1}. "${article.title}"\n`;
        emailMsg += `   Summary: ${article.summary[0].substring(0, 120)}...\n\n`;
      });
      
      if (persona?.conversationContext) {
        emailMsg += `This builds on our previous discussion about ${persona.conversationContext}.\n\n`;
      }
      
      emailMsg += persona?.personalityTraits?.toLowerCase().includes('serious') 
        ? "These insights merit careful consideration for their strategic implications.\n\n" 
        : "Would love to discuss these findings when you have time.\n\n";
      
      emailMsg += "Regards,";
      
      let slackMsg = `*Strategic insights compilation* 📊\n\n`;
      
      articles.forEach((article, index) => {
        slackMsg += `*${index + 1}. ${article.title}*\n`;
        slackMsg += `>${article.summary[0].substring(0, 80)}...\n\n`;
      });
      
      slackMsg += `Thoughts? 🤔`;
      
      setLinkedinMessage(linkedinMsg);
      setTwitterMessage(twitterMsg);
      setEmailMessage(emailMsg);
      setSlackMessage(slackMsg);
    }
    
    toast.success("Message regenerated", {
      description: "New AI-powered message created",
    });
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
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto">
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
            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2">
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
                <span className="hidden sm:inline">Twitter</span>
              </TabsTrigger>
              <TabsTrigger value="slack" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Slack</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="email" className="space-y-4">
              <Textarea 
                value={emailMessage} 
                onChange={(e) => setEmailMessage(e.target.value)}
                className="min-h-[200px] h-[200px] font-mono text-sm overflow-y-auto"
              />
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => handleRegenerateCaption("email")}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
                <div className="space-x-2">
                  <Button variant="outline" onClick={() => copyToClipboard(emailMessage)}>
                    <ScrollText className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button onClick={() => handleShare("Email")}>Send</Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="linkedin" className="space-y-4">
              <Textarea 
                value={linkedinMessage} 
                onChange={(e) => setLinkedinMessage(e.target.value)}
                className="min-h-[200px] h-[200px] font-mono text-sm overflow-y-auto"
              />
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => handleRegenerateCaption("linkedin")}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
                <div className="space-x-2">
                  <Button variant="outline" onClick={() => copyToClipboard(linkedinMessage)}>
                    <ScrollText className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button onClick={() => handleShare("LinkedIn")}>Post</Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="twitter" className="space-y-4">
              <Textarea 
                value={twitterMessage} 
                onChange={(e) => setTwitterMessage(e.target.value)}
                className="min-h-[200px] h-[200px] font-mono text-sm overflow-y-auto"
              />
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => handleRegenerateCaption("twitter")}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
                <div className="space-x-2">
                  <Button variant="outline" onClick={() => copyToClipboard(twitterMessage)}>
                    <ScrollText className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button onClick={() => handleShare("Twitter")}>Post</Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="slack" className="space-y-4">
              <Textarea 
                value={slackMessage} 
                onChange={(e) => setSlackMessage(e.target.value)}
                className="min-h-[200px] h-[200px] font-mono text-sm overflow-y-auto"
              />
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => handleRegenerateCaption("slack")}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
                <div className="space-x-2">
                  <Button variant="outline" onClick={() => copyToClipboard(slackMessage)}>
                    <ScrollText className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button onClick={() => handleShare("Slack")}>Send</Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
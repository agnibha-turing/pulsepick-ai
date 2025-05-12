import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DisplayArticle } from "@/services/article-service";
import { Share, BookmarkPlus, Linkedin, Twitter, Mail, MessageSquare, ArrowUpRight, ChevronDown } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface ArticleCardProps {
  article: DisplayArticle;
}

// Extended interface to handle optional author field
interface ExtendedArticle extends DisplayArticle {
  author?: string;
}

export function ArticleCard({ article }: ArticleCardProps) {
  // Treat article as ExtendedArticle to handle optional author field
  const extendedArticle = article as ExtendedArticle;

  const [shareOpen, setShareOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);
  
  // Platform-specific share messages
  const [linkedinMessage, setLinkedinMessage] = useState(
    `I found this valuable insight on ${article.title} that might interest my network. #PulsePick #ProfessionalInsights ${article.categories.map(c => `#${c.replace(/\s+/g, '')}`).join(' ')}`
  );
  
  const [twitterMessage, setTwitterMessage] = useState(
    `Check out this key insight: "${article.title}" via @PulsePick ${article.categories.map(c => `#${c.replace(/\s+/g, '')}`).join(' ')}`
  );
  
  const [emailMessage, setEmailMessage] = useState(
    `Subject: Thought you might find this interesting\n\nHi,\n\nI came across this article that I think could be relevant to our discussion:\n\n"${article.title}"\n\n${article.summary[0]}\n\nBest regards,`
  );
  
  const [slackMessage, setSlackMessage] = useState(
    `*Here's an insight I found valuable:*\n"${article.title}"\n>${article.summary[0]}\nvia PulsePick`
  );

  const handleShare = (platform: string) => {
    toast.success(`Shared on ${platform}`, {
      description: "Content shared and archived for compliance",
    });
    setShareOpen(false);
  };

  const handleRegenerateCaption = (platform: string) => {
    const messages = {
      linkedin: `I wanted to share this valuable industry insight from PulsePick: "${article.title}". This could impact our strategy in the ${article.categories[0]} sector. #ThoughtLeadership #${article.categories[0].replace(/\s+/g, '')} #IndustryInsights`,
      twitter: `Key finding: ${article.summary[0].substring(0, 100)}... (via @PulsePick) #${article.categories[0].replace(/\s+/g, '')}`,
      email: `Subject: Strategic insight to consider\n\nHi team,\n\nThis recent analysis could be valuable for our upcoming planning:\n\n"${article.title}"\n\nKey points:\n- ${article.summary[0]}\n\nLet's discuss this at our next meeting.\n\nBest,`,
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
    
    toast.success("Caption regenerated", {
      description: "New AI-powered caption created",
    });
  };

  // Function to open the article URL
  const openArticleUrl = () => {
    window.open(article.url, '_blank');
  };

  // We'll use the backend-provided keywords if available
  const keywords = article.keywords || [];
  const displayCategories = article.categories.slice(0, 3);
  const extraCategories = article.categories.length > 3 ? article.categories.length - 3 : 0;

  return (
    <>
      <Card className="overflow-hidden transition-all flex flex-col h-[400px] w-full relative group hover:shadow-md">
        <CardHeader className="pb-2 flex-shrink-0">
          {/* Source info and date */}
          <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs text-primary font-medium">
              {article.source.charAt(0).toUpperCase()}
            </div>
            <span>{article.source}</span>
            <span>•</span>
            <span>{new Date(article.date).toLocaleDateString()}</span>
          </div>
        </CardHeader>
        
        {/* Arrow link indicator at top right */}
        <div 
          className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
          onClick={openArticleUrl}
        >
          <ArrowUpRight className="h-5 w-5 text-primary hover:scale-110 transition-transform" />
        </div>
        
        <div className="px-6 flex-grow flex flex-col overflow-hidden">
          {/* Title with hover effect - now clickable */}
          <div 
            className="mb-3 h-[72px] overflow-hidden relative cursor-pointer"
            onClick={openArticleUrl}
          >
            <h3 className="text-lg font-bold leading-tight hover:text-primary hover:underline transition-colors">
              {article.title}
            </h3>
          </div>
          
          {/* Summary with Read More option */}
          <div className="mb-3 overflow-hidden">
            <p className={`text-sm text-muted-foreground ${expanded ? "" : "line-clamp-3"}`}>
              {article.summary[0]}
            </p>
            <Button 
              variant="ghost" 
              size="sm" 
              className="p-0 h-6 text-xs text-primary flex items-center gap-1 mt-1"
              onClick={() => expanded ? setExpanded(false) : setDetailsOpen(true)}
            >
              {expanded ? "Show less" : "Read more"}
              <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </Button>
          </div>
          
          {/* Tags container - Fixed position at bottom of content area */}
          <div className="mt-auto mb-4">
            {/* Categories */}
            <div className="flex flex-wrap gap-1 mb-2">
              {displayCategories.map((category) => (
                <Badge key={category} variant="secondary" className="text-xs font-medium">
                  {category}
                </Badge>
              ))}
              {extraCategories > 0 && (
                <Badge variant="outline" className="text-xs">
                  +{extraCategories}
                </Badge>
              )}
            </div>
            
            {/* Keywords */}
            <div className="flex flex-wrap gap-1">
              {keywords.slice(0, 3).map((keyword) => (
                <Badge key={keyword} variant="outline" className="text-xs bg-background/50 border-primary/20 text-muted-foreground">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        
        <CardFooter className="py-3 px-6 border-t mt-auto bg-muted/10 flex justify-between">
          <Button 
            variant={saved ? "default" : "outline"} 
            size="sm"
            onClick={() => setSaved(!saved)}
            className="gap-2"
          >
            <BookmarkPlus className="h-4 w-4" />
            <span>Save</span>
          </Button>
          
          <Button 
            onClick={() => setShareOpen(true)}
            size="sm"
            className="gap-2"
          >
            <Share className="h-4 w-4" />
            <span>Share</span>
          </Button>
        </CardFooter>
      </Card>
      
      {/* Article Detail Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs text-primary font-medium">
                {article.source.charAt(0).toUpperCase()}
              </div>
              <span>{article.source}</span>
              <span>•</span>
              <span>{new Date(article.date).toLocaleDateString()}</span>
            </div>
            <DialogTitle className="text-xl">{article.title}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 my-4">
            {/* Full summary */}
            <div>
              <h4 className="font-medium mb-2">Summary</h4>
              <div className="space-y-2">
                {article.summary.map((paragraph, i) => (
                  <p key={i} className="text-sm text-muted-foreground">{paragraph}</p>
                ))}
              </div>
            </div>
            
            {/* Categories and keywords */}
            <div>
              <h4 className="font-medium mb-2">Categories</h4>
              <div className="flex flex-wrap gap-1 mb-4">
                {article.categories.map((category) => (
                  <Badge key={category} variant="secondary" className="text-xs font-medium">
                    {category}
                  </Badge>
                ))}
              </div>
              
              {keywords.length > 0 && (
                <>
                  <h4 className="font-medium mb-2">Keywords</h4>
                  <div className="flex flex-wrap gap-1">
                    {keywords.map((keyword) => (
                      <Badge key={keyword} variant="outline" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </>
              )}
            </div>
            
            {/* Additional metadata if available */}
            {extendedArticle.author && (
              <div>
                <h4 className="font-medium mb-1">Author</h4>
                <p className="text-sm">{extendedArticle.author}</p>
              </div>
            )}
          </div>
          
          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
            <div className="flex gap-2">
              <Button 
                variant={saved ? "default" : "outline"} 
                onClick={() => setSaved(!saved)}
                className="gap-2"
              >
                <BookmarkPlus className="h-4 w-4" />
                <span>Save</span>
              </Button>
              <Button onClick={() => {
                setShareOpen(true);
                setDetailsOpen(false);
              }}>
                <Share className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button onClick={openArticleUrl}>
                <ArrowUpRight className="h-4 w-4 mr-2" />
                Visit Source
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Share Dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Share Content</DialogTitle>
            <DialogDescription>
              Choose a platform and customize your message
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="linkedin" className="mt-2">
            <TabsList className="grid grid-cols-4 mb-4">
              <TabsTrigger value="linkedin" className="flex items-center gap-2">
                <Linkedin className="h-4 w-4" />
                <span className="hidden sm:inline">LinkedIn</span>
              </TabsTrigger>
              <TabsTrigger value="twitter" className="flex items-center gap-2">
                <Twitter className="h-4 w-4" />
                <span className="hidden sm:inline">Twitter</span>
              </TabsTrigger>
              <TabsTrigger value="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">Email</span>
              </TabsTrigger>
              <TabsTrigger value="slack" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Slack</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="linkedin" className="space-y-4">
              <Textarea 
                value={linkedinMessage} 
                onChange={(e) => setLinkedinMessage(e.target.value)}
                className="min-h-[100px]"
              />
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => handleRegenerateCaption("linkedin")}>Regenerate</Button>
                <div className="space-x-2">
                  <Button variant="outline" onClick={() => {
                    navigator.clipboard.writeText(linkedinMessage);
                    toast.success("Caption copied to clipboard");
                  }}>Copy</Button>
                  <Button onClick={() => handleShare("LinkedIn")}>Post</Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="twitter" className="space-y-4">
              <Textarea 
                value={twitterMessage} 
                onChange={(e) => setTwitterMessage(e.target.value)}
                className="min-h-[100px]"
              />
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => handleRegenerateCaption("twitter")}>Regenerate</Button>
                <div className="space-x-2">
                  <Button variant="outline" onClick={() => {
                    navigator.clipboard.writeText(twitterMessage);
                    toast.success("Caption copied to clipboard");
                  }}>Copy</Button>
                  <Button onClick={() => handleShare("Twitter")}>Post</Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="email" className="space-y-4">
              <Textarea 
                value={emailMessage} 
                onChange={(e) => setEmailMessage(e.target.value)}
                className="min-h-[100px]"
              />
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => handleRegenerateCaption("email")}>Regenerate</Button>
                <div className="space-x-2">
                  <Button variant="outline" onClick={() => {
                    navigator.clipboard.writeText(emailMessage);
                    toast.success("Caption copied to clipboard");
                  }}>Copy</Button>
                  <Button onClick={() => handleShare("Email")}>Send</Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="slack" className="space-y-4">
              <Textarea 
                value={slackMessage} 
                onChange={(e) => setSlackMessage(e.target.value)}
                className="min-h-[100px]"
              />
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => handleRegenerateCaption("slack")}>Regenerate</Button>
                <div className="space-x-2">
                  <Button variant="outline" onClick={() => {
                    navigator.clipboard.writeText(slackMessage);
                    toast.success("Caption copied to clipboard");
                  }}>Copy</Button>
                  <Button onClick={() => handleShare("Slack")}>Send</Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <p className="text-xs text-muted-foreground text-center mt-4">
            Activity will be archived for compliance
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

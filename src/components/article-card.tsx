
import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Article } from "@/services/article-service";
import { Share, Heart, BookmarkPlus, Linkedin, Twitter, Mail, MessageSquare } from "lucide-react";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  article: Article;
}

export function ArticleCard({ article }: ArticleCardProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  
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
      slack: `*Strategic insight alert* 📊\n"${article.title}"\n>${article.summary[0]}\nSource: ${article.source} | Relevance score: ${article.trendingScore}/100`
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

  // Extract keywords from the article
  const getKeywords = () => {
    // Extract important words from title and summary
    const combinedText = `${article.title} ${article.summary.join(' ')}`;
    
    // These would typically come from an AI service, but for demo we'll extract:
    // 1. Any capitalized terms (likely proper nouns)
    // 2. Common industry terms based on the categories
    
    const keywords = [];
    
    // Add some industry-specific keywords based on categories
    if (article.categories.includes("BFSI")) {
      keywords.push("Finance", "Banking", "Investment");
    }
    if (article.categories.includes("Retail")) {
      keywords.push("Commerce", "Customer Experience", "Sales");
    }
    if (article.categories.includes("Tech")) {
      keywords.push("Innovation", "Digital", "Software");
    }
    if (article.categories.includes("Healthcare")) {
      keywords.push("Medical", "Patient Care", "Treatment");
    }
    
    // Extract percentage statistics from summary
    const percentageMatches = combinedText.match(/\d+%/g);
    if (percentageMatches) {
      keywords.push(...percentageMatches.slice(0, 2));
    }
    
    // Extract AI-related terms if present
    if (combinedText.toLowerCase().includes("ai") || 
        combinedText.toLowerCase().includes("artificial intelligence")) {
      keywords.push("AI");
    }
    
    // Limit to 5 keywords max
    return [...new Set(keywords)].slice(0, 5);
  };

  const keywords = getKeywords();
  const displayCategories = article.categories.slice(0, 3);
  const extraCategories = article.categories.length > 3 ? article.categories.length - 3 : 0;

  return (
    <>
      <Card className="overflow-hidden transition-all hover:shadow-md dark:hover:border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start gap-2 mb-1">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm bg-primary/20 flex items-center justify-center text-[8px]">
                {article.source.charAt(0)}
              </div>
              <span className="text-xs text-muted-foreground">{article.source}</span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">{new Date(article.date).toLocaleDateString()}</span>
            </div>
            <Badge variant="outline" className="text-xs px-2 bg-primary/10 border-primary/20">
              {article.trendingScore}
            </Badge>
          </div>
          
          <CardTitle className="text-lg font-bold line-clamp-2">
            {article.title}
          </CardTitle>
          
          <CardDescription className="line-clamp-2 mt-1">
            {article.summary[0]}
          </CardDescription>
          
          {/* Categories */}
          <div className="flex flex-wrap gap-1 mt-2">
            {displayCategories.map((category) => (
              <Badge key={category} variant="secondary" className="text-xs">
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
          <div className="flex flex-wrap gap-1 mt-2">
            {keywords.map((keyword) => (
              <Badge key={keyword} variant="outline" className="text-xs bg-background border-primary/30 text-muted-foreground">
                {keyword}
              </Badge>
            ))}
          </div>
        </CardHeader>
        
        <CardFooter className="pt-1 pb-4 flex justify-between items-center">
          <div className="flex gap-2">
            <Button 
              variant={saved ? "default" : "outline"} 
              size="icon" 
              onClick={() => setSaved(!saved)}
              className="h-9 w-9"
            >
              <BookmarkPlus className="h-4 w-4" />
              <span className="sr-only">Save for later</span>
            </Button>
            <Button 
              variant={liked ? "default" : "outline"} 
              size="icon" 
              onClick={() => setLiked(!liked)}
              className="h-9 w-9"
            >
              <Heart className="h-4 w-4" />
              <span className="sr-only">Like</span>
            </Button>
          </div>
          <Button 
            onClick={() => setShareOpen(true)}
            className="gap-2"
          >
            <Share className="h-4 w-4" />
            <span>Share</span>
          </Button>
        </CardFooter>
      </Card>
      
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

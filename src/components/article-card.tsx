
import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Article } from "@/services/article-service";
import { Share, Heart, BookmarkPlus } from "lucide-react";
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
  const [shareMessage, setShareMessage] = useState(`Check out this interesting article: "${article.title}" #PulsePick`);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const handleShare = (platform: string) => {
    toast.success(`Shared on ${platform}`, {
      description: "Content shared and archived for compliance",
    });
    setShareOpen(false);
  };

  const handleRegenerateCaption = () => {
    // In a real app, this would call an AI service to regenerate the caption
    setShareMessage(`I thought this would be relevant for you: "${article.title}" - via PulsePick #AI #SalesInsights`);
    toast.success("Caption regenerated", {
      description: "New AI-powered caption created",
    });
  };

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
          
          <div className="flex flex-wrap gap-1 mt-3">
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
              <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
              <TabsTrigger value="twitter">Twitter</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="slack">Slack</TabsTrigger>
            </TabsList>
            
            <TabsContent value="linkedin" className="space-y-4">
              <Textarea 
                value={shareMessage} 
                onChange={(e) => setShareMessage(e.target.value)}
                className="min-h-[100px]"
              />
              <div className="flex justify-between">
                <Button variant="outline" onClick={handleRegenerateCaption}>Regenerate</Button>
                <div className="space-x-2">
                  <Button variant="outline" onClick={() => {
                    navigator.clipboard.writeText(shareMessage);
                    toast.success("Caption copied to clipboard");
                  }}>Copy</Button>
                  <Button onClick={() => handleShare("LinkedIn")}>Post</Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="twitter" className="space-y-4">
              <Textarea 
                value={shareMessage} 
                onChange={(e) => setShareMessage(e.target.value)}
                className="min-h-[100px]"
              />
              <div className="flex justify-between">
                <Button variant="outline" onClick={handleRegenerateCaption}>Regenerate</Button>
                <div className="space-x-2">
                  <Button variant="outline" onClick={() => {
                    navigator.clipboard.writeText(shareMessage);
                    toast.success("Caption copied to clipboard");
                  }}>Copy</Button>
                  <Button onClick={() => handleShare("Twitter")}>Post</Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="email" className="space-y-4">
              <Textarea 
                value={shareMessage} 
                onChange={(e) => setShareMessage(e.target.value)}
                className="min-h-[100px]"
              />
              <div className="flex justify-between">
                <Button variant="outline" onClick={handleRegenerateCaption}>Regenerate</Button>
                <div className="space-x-2">
                  <Button variant="outline" onClick={() => {
                    navigator.clipboard.writeText(shareMessage);
                    toast.success("Caption copied to clipboard");
                  }}>Copy</Button>
                  <Button onClick={() => handleShare("Email")}>Send</Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="slack" className="space-y-4">
              <Textarea 
                value={shareMessage} 
                onChange={(e) => setShareMessage(e.target.value)}
                className="min-h-[100px]"
              />
              <div className="flex justify-between">
                <Button variant="outline" onClick={handleRegenerateCaption}>Regenerate</Button>
                <div className="space-x-2">
                  <Button variant="outline" onClick={() => {
                    navigator.clipboard.writeText(shareMessage);
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

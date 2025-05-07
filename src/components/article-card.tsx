
import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Article } from "@/services/article-service";
import { Share, Linkedin, Twitter } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface ArticleCardProps {
  article: Article;
}

export function ArticleCard({ article }: ArticleCardProps) {
  const [isSharing, setIsSharing] = useState(false);
  
  const handleShare = (platform: string) => {
    setIsSharing(true);
    
    // In a real app, this would use the Web Share API or platform-specific sharing
    setTimeout(() => {
      setIsSharing(false);
      toast.success(`Article shared on ${platform}`, {
        description: `"${article.title}" has been shared.`,
      });
    }, 500);
  };

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md dark:hover:shadow-primary/5">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-lg font-bold line-clamp-2">{article.title}</CardTitle>
          <Badge variant="outline" className="text-xs px-2 py-0 h-6 bg-primary bg-opacity-10 text-primary border-primary/10">
            {article.trendingScore}
          </Badge>
        </div>
        <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
          <span>{article.source}</span>
          <span>{new Date(article.date).toLocaleDateString()}</span>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <ul className="list-disc list-inside space-y-1 text-sm pl-1">
          {article.summary.map((point, index) => (
            <li key={index} className="text-muted-foreground">
              <span className="text-foreground">{point}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="pt-2 flex justify-between items-center">
        <div className="flex gap-1">
          {article.categories.map((category) => (
            <Badge key={category} variant="secondary" className="text-xs">
              {category}
            </Badge>
          ))}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" disabled={isSharing}>
              <Share className="h-4 w-4" />
              <span className="sr-only">Share article</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleShare("LinkedIn")}>
              <Linkedin className="mr-2 h-4 w-4" />
              <span>LinkedIn</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleShare("Twitter")}>
              <Twitter className="mr-2 h-4 w-4" />
              <span>Twitter</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  );
}

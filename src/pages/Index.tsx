
import { useState, useEffect } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArticleCard } from "@/components/article-card";
import { FilterChips } from "@/components/filter-chips";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getArticles, Article } from "@/services/article-service";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Share, Filter, BookmarkPlus } from "lucide-react";

const AVAILABLE_INDUSTRIES = ["All", "BFSI", "Retail", "Tech", "Healthcare"];
const AVAILABLE_CONTENT_TYPES = ["Articles", "Social Posts", "Newsletters", "Reports"];
const AVAILABLE_TIME_PERIODS = ["Today", "7 Days", "30 Days", "Custom"];

const Index = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeIndustry, setActiveIndustry] = useState("All");
  const [contentTypes, setContentTypes] = useState<string[]>(["Articles"]);
  const [timePeriod, setTimePeriod] = useState("7 Days");
  const [minRelevance, setMinRelevance] = useState([50]);

  useEffect(() => {
    const fetchArticles = async () => {
      setLoading(true);
      try {
        let filters = [...activeFilters];
        if (activeIndustry !== "All") {
          filters.push(activeIndustry);
        }
        
        const articlesData = await getArticles(filters);
        setArticles(articlesData);
      } catch (error) {
        console.error("Error fetching articles:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, [activeFilters, activeIndustry]);

  const toggleContentType = (type: string) => {
    setContentTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground font-bold">P</div>
            <span className="font-bold text-xl hidden sm:inline-block">Pulse<span className="text-primary">Pick</span></span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Avatar className="h-8 w-8">
              <AvatarImage src="" alt="User" />
              <AvatarFallback className="bg-primary/10 text-primary">JS</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      {/* Industry Tabs - Sticky below header */}
      <div className="sticky top-16 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="container px-4 py-2 overflow-x-auto scrollbar-none">
          <Tabs 
            defaultValue={activeIndustry} 
            onValueChange={setActiveIndustry}
            className="w-full"
          >
            <TabsList className="w-full flex justify-start p-0 h-10 bg-transparent space-x-2">
              {AVAILABLE_INDUSTRIES.map(industry => (
                <TabsTrigger 
                  key={industry}
                  value={industry} 
                  className="px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {industry}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 container px-0 sm:px-4">
        {/* Filter button for mobile */}
        <div className="lg:hidden fixed bottom-5 right-5 z-10">
          <Button 
            size="icon" 
            className="rounded-full shadow-lg h-12 w-12"
            onClick={() => setSidebarOpen(true)}
          >
            <Filter />
          </Button>
        </div>
        
        {/* Mobile sidebar */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-[300px] sm:w-[400px] p-0">
            <SheetHeader className="p-6 pb-2">
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="p-6 pt-2">
              {renderFilterContent()}
            </div>
          </SheetContent>
        </Sheet>
        
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-[300px] p-6 border-r sticky top-32 self-start">
          {renderFilterContent()}
        </aside>
        
        {/* Main feed */}
        <main className="flex-1 p-4 sm:p-6">
          <h1 className="text-2xl font-bold mb-4">
            {activeIndustry === "All" ? "All Industries" : activeIndustry} Content
          </h1>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-card rounded-lg p-6 space-y-3 border">
                  <div className="flex justify-between items-start">
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                  <div className="pt-4 flex justify-between">
                    <div className="flex gap-2">
                      <Skeleton className="h-9 w-9 rounded-md" />
                      <Skeleton className="h-9 w-9 rounded-md" />
                    </div>
                    <Skeleton className="h-9 w-20 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {articles.length === 0 ? (
                <div className="text-center py-12">
                  <h3 className="text-xl font-medium">No content found</h3>
                  <p className="text-muted-foreground mt-2">
                    Try changing your filters or check back later
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {articles.map(article => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 PulsePick. AI-powered content curation for sales professionals.</p>
          <p className="text-xs mt-1">Activity will be archived for compliance.</p>
        </div>
      </footer>
    </div>
  );

  function renderFilterContent() {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="font-medium mb-3">Content Type</h3>
          <div className="flex flex-col gap-2">
            {AVAILABLE_CONTENT_TYPES.map(type => (
              <div 
                key={type} 
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => toggleContentType(type)}
              >
                <div 
                  className={`w-4 h-4 rounded border ${
                    contentTypes.includes(type) 
                      ? "bg-primary border-primary" 
                      : "border-input"
                  } flex items-center justify-center`}
                >
                  {contentTypes.includes(type) && (
                    <div className="w-2 h-2 bg-primary-foreground rounded-sm" />
                  )}
                </div>
                <span>{type}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-medium mb-3">Time Period</h3>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_TIME_PERIODS.map(period => (
              <Button 
                key={period} 
                variant={timePeriod === period ? "default" : "outline"} 
                size="sm" 
                onClick={() => setTimePeriod(period)}
                className="flex-1"
              >
                {period}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-medium mb-3">
            Min Relevance: {minRelevance[0]}%
          </h3>
          <Slider
            defaultValue={minRelevance}
            max={100}
            step={5}
            min={50}
            onValueChange={setMinRelevance}
          />
        </div>
        
        <div>
          <Button variant="ghost" className="w-full justify-start gap-2" size="sm">
            <BookmarkPlus size={16} />
            Saved for Later
          </Button>
        </div>
      </div>
    )
  }
};

export default Index;

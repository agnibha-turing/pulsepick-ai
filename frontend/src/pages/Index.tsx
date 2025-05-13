import { useState, useEffect } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArticleCard } from "@/components/article-card";
import { FilterChips } from "@/components/filter-chips";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getArticles, DisplayArticle } from "@/services/article-service";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { PersonaInputCard, Persona } from "@/components/persona-input-card";
import { usePersona } from "@/context/persona-context";
import { useSelectedArticles } from "@/context/selected-articles-context";
import { GenerateMessageFab } from "@/components/generate-message-fab";
import { toast } from "sonner";
import { 
  Share, 
  Filter, 
  BookmarkPlus, 
  Bell, 
  Search, 
  Menu,
  Home,
  User,
  Settings,
  SlidersHorizontal,
  PlusCircle,
  MessageSquare
} from "lucide-react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

const AVAILABLE_INDUSTRIES = ["All", "BFSI", "Retail", "Technology", "Healthcare", "Other"];
const AVAILABLE_CONTENT_TYPES = ["Articles", "Social Posts", "Newsletters", "Reports"];
const AVAILABLE_TIME_PERIODS = ["Today", "7 Days", "30 Days", "Custom"];

const Index = () => {
  const [articles, setArticles] = useState<DisplayArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(false);
  const [activeIndustry, setActiveIndustry] = useState("All");
  const [contentTypes, setContentTypes] = useState<string[]>(["Articles"]);
  const [timePeriod, setTimePeriod] = useState("7 Days");
  const [minRelevance, setMinRelevance] = useState([50]);
  const { activePersona, setActivePersona, isPersonaActive } = usePersona();
  const { selectedArticles, selectedCount } = useSelectedArticles();

  useEffect(() => {
    const fetchArticles = async () => {
      setLoading(true);
      try {
        const filters = [...activeFilters];
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

  const handleGenerateMessage = () => {
    toast.info(`Preparing to generate message with ${selectedArticles.length} selected articles`);
    
    console.log("Selected articles:", selectedArticles);
    console.log("Active persona:", activePersona);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Enhanced Header/Navbar */}
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur-md shadow-sm">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-black dark:bg-white rounded flex items-center justify-center text-white dark:text-black font-bold">
                P
              </div>
              <span className="font-bold text-xl hidden sm:inline-block">Pulse<span className="text-black dark:text-white">Pick</span></span>
            </div>
            
            <div className="hidden md:flex">
              <NavigationMenu>
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger className="bg-transparent">Discover</NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <ul className="grid gap-3 p-4 w-[400px] md:w-[500px] lg:w-[600px] grid-cols-2">
                        {["All Content", "Trending Now", "Recent Publications", "My Industry"].map((item) => (
                          <li key={item} className="row-span-1">
                            <NavigationMenuLink asChild>
                              <a
                                className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                                href="#"
                              >
                                <div className="text-sm font-medium leading-none">{item}</div>
                              </a>
                            </NavigationMenuLink>
                          </li>
                        ))}
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger className="bg-transparent">Analyze</NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <ul className="grid gap-3 p-4 w-[400px] md:w-[500px] grid-cols-2">
                        {["Market Trends", "Competitor Analysis", "Industry Reports", "Custom Insights"].map((item) => (
                          <li key={item} className="row-span-1">
                            <NavigationMenuLink asChild>
                              <a
                                className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                                href="#"
                              >
                                <div className="text-sm font-medium leading-none">{item}</div>
                              </a>
                            </NavigationMenuLink>
                          </li>
                        ))}
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search content..."
                className="h-9 w-[180px] lg:w-[280px] rounded-md border border-input bg-background px-3 py-1 pl-8 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
            
            <Button size="icon" variant="ghost" className="relative hidden sm:flex">
              <Bell className="h-5 w-5" />
              <span className="absolute -right-0 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                3
              </span>
            </Button>
            
            <ThemeToggle />
            
            <Avatar className="h-9 w-9 cursor-pointer border-2 border-transparent hover:border-primary/30 transition-all">
              <AvatarImage src="" alt="User" />
              <AvatarFallback className="bg-primary/10 text-primary">JS</AvatarFallback>
            </Avatar>
            
            <Button variant="outline" size="icon" className="md:hidden" onClick={() => setMobileSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
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
        {/* Filter button for mobile - REMOVED since it conflicts with Generate Message FAB and is redundant with hamburger menu */}
        
        {/* Mobile sidebar */}
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent side="left" className="w-[300px] sm:w-[400px] p-0 lg:hidden">
            <SheetHeader className="p-6 pb-2">
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="p-6 pt-2">
              {renderFilterContent()}
            </div>
          </SheetContent>
        </Sheet>
        
        {/* Desktop sidebar */}
        <aside className={`hidden lg:block w-[300px] p-6 border-r sticky top-32 self-start ${desktopSidebarOpen ? 'block' : 'lg:hidden'}`}>
          {renderFilterContent()}
        </aside>
        
        {/* Main feed */}
        <main className="flex-1 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">
                {activeIndustry === "All" ? "All Industries" : activeIndustry}
              </h1>
              {isPersonaActive && activePersona?.recipientName && (
                <p className="text-sm text-muted-foreground mt-1">
                  Content ranked for <span className="font-medium">{activePersona.recipientName}</span>
                  {activePersona.jobTitle && ` (${activePersona.jobTitle})`}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <PersonaInputCard className="w-auto" />
              <Button 
                variant="outline" 
                size="sm" 
                className="hidden sm:flex gap-2"
                onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span>Filter</span>
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <BookmarkPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Saved</span>
              </Button>
            </div>
          </div>
          
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

      {/* Message generation FAB */}
      <GenerateMessageFab />

      {/* Selection hint */}
      {!loading && articles.length > 0 && selectedCount === 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 
          bg-primary/90 backdrop-blur-sm text-primary-foreground 
          rounded-full px-5 py-2.5 shadow-lg flex items-center gap-2.5
          animate-pulse max-w-[90%] sm:max-w-md border border-primary/20">
          <div className="bg-primary-foreground/20 rounded-full p-1.5 flex-shrink-0">
            <MessageSquare className="h-4 w-4" />
          </div>
          <span className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
            Select articles to create a message
          </span>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container px-4 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-sm text-muted-foreground">© 2025 PulsePick. AI-powered content curation for sales professionals.</p>
          <div className="flex gap-4 mt-3 sm:mt-0">
            <Button variant="ghost" size="sm">Privacy</Button>
            <Button variant="ghost" size="sm">Terms</Button>
            <Button variant="ghost" size="sm">Support</Button>
          </div>
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
          <h3 className="font-medium mb-3">Saved Items</h3>
          <Button variant="outline" className="w-full justify-start gap-2" size="sm">
            <BookmarkPlus size={16} />
            Saved for Later
          </Button>
        </div>
      </div>
    )
  }
};

export default Index;

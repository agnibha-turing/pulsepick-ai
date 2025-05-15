import { useState, useEffect, useCallback } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArticleCard } from "@/components/article-card";
import { FilterChips } from "@/components/filter-chips";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getArticles, DisplayArticle, batchScoreArticles, startBatchScoreArticles, getBatchScoreStatus } from "@/services/article-service";
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
import { motion, AnimatePresence } from "framer-motion";
import { 
  Share, 
  Filter, 
  BookmarkPlus, 
  Bell, 
  Search, 
  Menu,
  Home,
  User,
  UserPlus,
  Settings,
  SlidersHorizontal,
  PlusCircle,
  MessageSquare,
  RefreshCw,
  ChevronDown,
  Check
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
import { cn } from "@/lib/utils";

const AVAILABLE_INDUSTRIES = ["All", "BFSI", "Retail", "Technology", "Healthcare", "Other"];
const AVAILABLE_CONTENT_TYPES = ["Articles", "Social Posts", "Newsletters", "Reports"];
const AVAILABLE_TIME_PERIODS = ["Today", "7 Days", "30 Days", "Custom"];

// Add these animation variants outside the component
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { 
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1,
    transition: { 
      type: "spring", 
      stiffness: 200, 
      damping: 25 
    }
  }
};

const emptyStateVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { 
      type: "spring", 
      stiffness: 300, 
      damping: 25 
    }
  }
};

// Extended DisplayArticle interface to include personalization properties
interface EnhancedArticle extends DisplayArticle {
  personaScore?: number;
}

const Index = () => {
  const [articles, setArticles] = useState<DisplayArticle[]>([]);
  const [personalizedArticles, setPersonalizedArticles] = useState<EnhancedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPersonalized, setLoadingPersonalized] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("All");
  const [activeIndustry, setActiveIndustry] = useState("All");
  const [contentTypes, setContentTypes] = useState<string[]>(["Articles"]);
  const [timePeriod, setTimePeriod] = useState("7 Days");
  const [minRelevance, setMinRelevance] = useState([50]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { activePersona, setActivePersona, isPersonaActive, savedPersonas } = usePersona();
  const { selectedArticles, selectedCount } = useSelectedArticles();
  const [personaApplied, setPersonaApplied] = useState(false);
  const [llmEnhanced, setLlmEnhanced] = useState(false);
  const [personaDialogOpen, setPersonaDialogOpen] = useState(false);

  // New state for tracking all articles from all tabs
  const [allTabsArticles, setAllTabsArticles] = useState<DisplayArticle[]>([]);
  const [loadedIndustries, setLoadedIndustries] = useState<Set<string>>(new Set(["All"]));
  const [isLoadingAllTabs, setIsLoadingAllTabs] = useState(false);
  const [isBatchPersonalizing, setIsBatchPersonalizing] = useState(false);

  // Add a new state for tracking when personalization was last done
  const [lastPersonalizationTime, setLastPersonalizationTime] = useState<number | null>(null);
  const [lastPersonaId, setLastPersonaId] = useState<string | null>(null);

  // New state for async processing
  const [scoringTaskId, setScoringTaskId] = useState<string | null>(null);
  const [scoringProgress, setScoringProgress] = useState<number>(0);
  const [progressTotal, setProgressTotal] = useState<number>(0);
  const [progressProcessed, setProgressProcessed] = useState<number>(0);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  // Fetch regular articles (recency-based sorting)
  const fetchArticles = useCallback(async (industry: string = activeIndustry) => {
    if (industry === activeIndustry) {
      setLoading(true);
    }
    
    try {
      const filters = [...activeFilters];
      if (industry !== "All") {
        filters.push(industry);
      }
      
      // Always fetch with no persona for regular tabs
      const result = await getArticles(filters, null);
      
      // Update the appropriate state
      if (industry === activeIndustry) {
        setArticles(result.articles);
        setLastUpdated(result.lastUpdated);
      }
      
      // Add to the collection of all articles
      setAllTabsArticles(prevArticles => {
        // Create a new array with all existing articles
        const newArticles = [...prevArticles];
        
        // Add the newly fetched articles, avoiding duplicates
        result.articles.forEach(article => {
          if (!newArticles.some(a => a.id === article.id)) {
            newArticles.push(article);
          }
        });
        
        return newArticles;
      });
      
      // Mark this industry as loaded
      setLoadedIndustries(prev => {
        const newSet = new Set(prev);
        newSet.add(industry);
        return newSet;
      });
      
    } catch (error) {
      console.error(`Error fetching articles for ${industry}:`, error);
      if (industry === activeIndustry) {
        toast.error("Failed to load articles");
      }
    } finally {
      if (industry === activeIndustry) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [activeFilters, activeIndustry]);

  // Fetch articles for all industries to build our complete article set
  const fetchAllIndustryTabs = useCallback(async () => {
    setIsLoadingAllTabs(true);
    
    try {
      // Fetch the "All" tab first if not already loaded
      if (!loadedIndustries.has("All")) {
        await fetchArticles("All");
      }
      
      // Then fetch the rest of the industries
      const industryPromises = AVAILABLE_INDUSTRIES
        .filter(industry => industry !== "All" && !loadedIndustries.has(industry))
        .map(industry => fetchArticles(industry));
      
      await Promise.all(industryPromises);
      
      toast.success("Content loaded for personalization", {
        description: "Ready to personalize content based on your preferences",
        duration: 3000
      });
      
    } catch (error) {
      console.error("Error loading all industries:", error);
    } finally {
      setIsLoadingAllTabs(false);
    }
  }, [fetchArticles, loadedIndustries]);

  // New function to handle incremental updates from batch scoring
  const updateArticlesWithScores = useCallback((
    articles: DisplayArticle[], 
    scores: Array<{ id: number, relevance_score: number }>
  ): EnhancedArticle[] => {
    // Create a map of id -> score for quick lookup
    const scoreMap: { [id: string]: number } = {};
    scores.forEach(item => {
      scoreMap[item.id.toString()] = item.relevance_score;
    });
    
    // Create a copy of articles with scores applied
    const scoredArticles = articles.map(article => {
      // Only update articles that have been scored
      if (scoreMap[article.id]) {
        return {
          ...article,
          personaScore: scoreMap[article.id]
        } as EnhancedArticle;
      }
      // Keep existing personaScore or use default
      const enhanced = article as EnhancedArticle;
      return {
        ...article,
        personaScore: enhanced.personaScore || 0.5
      } as EnhancedArticle;
    });
    
    // Remove duplicates (by ID)
    const uniqueArticles = Array.from(
      new Map(scoredArticles.map(article => [article.id, article])).values()
    );
    
    // Sort by personalization score (descending)
    uniqueArticles.sort((a, b) => (b.personaScore || 0) - (a.personaScore || 0));
    
    return uniqueArticles;
  }, []);

  // Updated version with async processing
  const personalizeArticles = useCallback(async () => {
    if (!isPersonaActive || !activePersona) return;
    
    setIsBatchPersonalizing(true);
    
    try {
      // Make sure we have articles from all tabs
      if (allTabsArticles.length === 0 || loadedIndustries.size < 2) {
        await fetchAllIndustryTabs();
      }
      
      toast.info("Personalizing content...", {
        description: "Using AI to find the most relevant articles for your persona",
        duration: 5000
      });
      
      // Get the IDs of all the unique articles
      const uniqueArticleIds = Array.from(
        new Set(allTabsArticles.map(article => article.id))
      );
      
      // Clear personalized articles during processing
      setPersonalizedArticles([]);
      
      // Start async batch scoring
      const taskResult = await startBatchScoreArticles(uniqueArticleIds, activePersona);
      
      // Store task ID for polling
      setScoringTaskId(taskResult.taskId);
      setProgressTotal(taskResult.totalArticles);
      setProgressProcessed(0);
      setScoringProgress(0);
      
      // Start polling for updates
      setIsPolling(true);
      
      // Track that we've personalized for this persona
      setLastPersonaId(activePersona.recipientName);
      setLastPersonalizationTime(Date.now());
      setPersonaApplied(true);
      setLlmEnhanced(true);
      
    } catch (error) {
      console.error("Error personalizing articles:", error);
      toast.error("Failed to personalize content");
      setIsBatchPersonalizing(false);
    }
  }, [
    isPersonaActive, 
    activePersona, 
    allTabsArticles, 
    loadedIndustries, 
    fetchAllIndustryTabs
  ]);
  
  // Add polling effect
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    
    const pollForResults = async () => {
      if (!scoringTaskId || !isPolling) return;
      
      try {
        const status = await getBatchScoreStatus(scoringTaskId);
        
        // Update progress indicators
        setScoringProgress(status.progressPercentage);
        setProgressProcessed(status.processed);
        
        // Check if processing is complete
        if (status.status === "completed") {
          // Only update articles when processing is completely finished
          if (status.results && status.results.length > 0) {
            const updatedArticles = updateArticlesWithScores(allTabsArticles, status.results);
            setPersonalizedArticles(updatedArticles);
          }
          
          setIsPolling(false);
          setIsBatchPersonalizing(false);
          setScoringTaskId(null);
          
          toast.success("Content personalized successfully", {
            description: `Found ${status.results.length} articles ranked for ${activePersona?.recipientName}`,
            duration: 3000
          });
        }
      } catch (error) {
        console.error("Error polling for batch status:", error);
        setIsPolling(false);
        setIsBatchPersonalizing(false);
      }
    };
    
    if (isPolling && scoringTaskId) {
      // Initial poll immediately
      pollForResults();
      
      // Set up polling interval - reduce to 1 second for faster updates
      pollInterval = setInterval(pollForResults, 1000);
    }
    
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [isPolling, scoringTaskId, allTabsArticles, activePersona, updateArticlesWithScores]);

  // Simplified tab change handler - just switch tabs, no personalization triggering
  const handleTabChange = (value: string) => {
    if (value === "Personalized") {
      // Simply switch to the personalized tab
      setActiveTab("Personalized");
    } else {
      // Switch to a regular industry tab
      setActiveTab(value);
      setActiveIndustry(value);
    }
  };

  // Fetch regular articles on mount and when filters change
  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  // Fetch articles for all tabs in the background
  useEffect(() => {
    // Start loading all tabs in the background
    if (!isLoadingAllTabs && loadedIndustries.size < AVAILABLE_INDUSTRIES.length) {
      fetchAllIndustryTabs();
    }
  }, [fetchAllIndustryTabs, isLoadingAllTabs, loadedIndustries]);

  // Start personalization in the background as soon as persona changes
  useEffect(() => {
    // Only personalize if:
    // 1. We have a persona active AND
    // 2. We have NOT personalized for this specific persona yet
    // 3. AND we're not already in the process of personalizing
    const shouldStartPersonalization = 
      isPersonaActive && 
      activePersona?.recipientName &&
      lastPersonaId !== activePersona.recipientName && 
      !isBatchPersonalizing &&
      !isPolling;
    
    if (shouldStartPersonalization) {
      // Start personalization immediately, regardless of current tab
      personalizeArticles();
      
      // Show notification that personalization has started
      toast.info(
        `Personalizing content for ${activePersona.recipientName}`,
        {
          description: "Content is being personalized in the background. Switch to the Personalized tab to see results.",
          duration: 5000
        }
      );
    }
  }, [
    isPersonaActive, 
    activePersona, 
    lastPersonaId, 
    isBatchPersonalizing,
    isPolling,
    personalizeArticles
  ]);

  // Switch to personalized tab ONLY when persona is initially activated
  useEffect(() => {
    // This should run only when a persona is first applied
    const isNewPersona = isPersonaActive && 
                        activePersona?.recipientName && 
                        (!lastPersonaId || lastPersonaId !== activePersona.recipientName);
    
    if (isNewPersona) {
      setActiveTab("Personalized");
    }
  }, [isPersonaActive, activePersona?.recipientName, lastPersonaId]);

  // Handle refresh button click
  const handleRefresh = async () => {
    setRefreshing(true);
    toast.info("Refreshing articles...");
    
    try {
      // Refresh the current active view
      if (activeTab === "Personalized" && isPersonaActive) {
        // For personalized view, we need to rebuild our article collection
        // Clear existing collections
        setAllTabsArticles([]);
        setLoadedIndustries(new Set());
        
        // Refetch and personalize
        await fetchAllIndustryTabs();
        await personalizeArticles();
      } else {
        // Just refresh the current industry tab
        await fetchArticles();
      }
      
      // Add a small delay before showing success message
      setTimeout(() => {
        toast.success("Articles refreshed successfully");
      }, 500);
    } catch (error) {
      // If there was an error, it will be handled in fetchArticles
      // and we don't need to show the success message
    }
  };

  // Determine which articles to display
  const displayArticles = activeTab === "Personalized" ? personalizedArticles : articles;
  const isPersonalizedView = activeTab === "Personalized";
  const isLoading = (isPersonalizedView ? isBatchPersonalizing : loading) || refreshing;

  // Function to open the persona dialog
  const handleOpenPersonaDialog = () => {
    setPersonaDialogOpen(true);
  };

  // Render the empty state for personalized tab when no persona
  const renderPersonalizedEmptyState = () => {
    // Don't call hooks inside this render function - use values from parent component
    return (
      <div className="text-center py-12 max-w-md mx-auto">
        <div className="bg-primary/5 p-6 rounded-lg mb-6">
          <UserPlus className="h-12 w-12 text-primary/70 mx-auto mb-4" />
        </div>
        <h3 className="text-xl font-medium">Personalize Your Content</h3>
        <p className="text-muted-foreground mt-3 mb-6">
          Create a persona to see articles that matter most to you or your recipients. 
          Content will be intelligently ranked based on relevance to job role, industry, and interests.
        </p>
        <div className="flex justify-center">
          <div className="flex">
            <Button 
              onClick={handleOpenPersonaDialog} 
              className="gap-2 px-4 rounded-r-none border-r-0 bg-black text-white hover:bg-black/90"
              variant="default"
            >
              <UserPlus className="h-3.5 w-3.5" />
              {savedPersonas.length > 0 ? "Manage Personas" : "Create Persona"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="default"
                  className="rounded-l-none px-1.5 border-l-0 bg-black text-white hover:bg-black/90"
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[280px] px-0 py-1.5 shadow-lg" align="end" sideOffset={5}>
                <div className="px-3 py-2 font-medium text-sm flex items-center justify-between">
                  <span>Select Persona</span>
                  {savedPersonas.length > 0 && (
                    <Badge variant="secondary" className="font-normal">
                      {savedPersonas.length}
                    </Badge>
                  )}
                </div>
                
                {savedPersonas.length > 0 ? (
                  <>
                    {savedPersonas.map((savedPersona, index) => (
                      <div 
                        key={index}
                        className={cn(
                          "px-3 py-2 cursor-pointer hover:bg-muted transition-colors duration-150",
                          activePersona && activePersona.recipientName === savedPersona.recipientName ? "bg-muted/50" : ""
                        )}
                        onClick={() => {
                          setActivePersona(savedPersona);
                          personalizeArticles();
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border">
                            <AvatarFallback className="text-sm bg-primary/10 text-primary font-medium">
                              {savedPersona.recipientName.split(' ').map(name => name[0]).join('').toUpperCase().substring(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium flex items-center gap-2">
                              {savedPersona.recipientName}
                              {activePersona && activePersona.recipientName === savedPersona.recipientName && (
                                <Check className="h-3.5 w-3.5 text-primary" />
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {savedPersona.jobTitle} {savedPersona.company ? `· ${savedPersona.company}` : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <DropdownMenuSeparator className="my-1" />
                  </>
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No saved personas yet
                  </div>
                )}
                
                <div 
                  className="px-3 py-2 cursor-pointer flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
                  onClick={handleOpenPersonaDialog}
                >
                  <UserPlus className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {savedPersonas.length > 0 ? "Manage Personas" : "Create New Persona"}
                  </span>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    );
  };

  const formatLastUpdated = (timestamp: string) => {
    try {
      // Ensure timestamp is treated as UTC if it doesn't include timezone info
      if (!timestamp.endsWith('Z') && !timestamp.includes('+')) {
        timestamp = timestamp + 'Z';
      }
      
      // Create date object (will automatically convert to local time zone)
      const date = new Date(timestamp);
      
      console.log("Original timestamp:", timestamp);
      console.log("Parsed date in local time:", date.toString());
      
      return new Intl.DateTimeFormat('en-US', { 
        dateStyle: 'short', 
        timeStyle: 'short',
        hour12: false  // Use 24-hour format instead of AM/PM
      }).format(date);
    } catch (e) {
      console.error("Error formatting timestamp:", e);
      return 'Unknown';
    }
  };

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

  // Add a progress indicator component
  const renderProgressIndicator = () => {
    // Show progress indicator when in personalized view and either loading or polling
    if (!(isPersonalizedView && (isLoading || isPolling))) return null;
    
    return (
      <div className="mb-6 max-w-3xl mx-auto bg-card/80 border rounded-lg p-5 shadow-lg backdrop-blur-md transition-all duration-300">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 gap-2">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 p-2.5 rounded-full">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">
                Personalizing for <span className="font-semibold">{activePersona?.recipientName}</span>
              </p>
              <p className="text-xs text-muted-foreground">Analyzing article relevance</p>
            </div>
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-primary font-medium px-3 py-1 self-start sm:self-auto">
            {progressProcessed > 0 ? `${progressProcessed}/${progressTotal} articles` : 'Starting...'}
          </Badge>
        </div>
        
        <div className="mt-4 space-y-2">
          <div className="relative w-full h-2.5 bg-primary/10 rounded-full overflow-hidden">
            <div 
              className="absolute left-0 top-0 h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${scoringProgress}%` }}
            ></div>
          </div>
          
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground flex items-center">
              <RefreshCw className="h-3 w-3 mr-1.5 animate-spin text-primary" />
              {scoringProgress > 0 
                ? `${scoringProgress}% complete` 
                : 'Initializing...'}
            </p>
            <p className="text-xs text-muted-foreground">
              Articles will appear when complete
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Enhanced Header/Navbar */}
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-md shadow-sm" style={{ isolation: 'isolate' }}>
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
                      <ul className="grid gap-3 p-4 w-[400px] md:w-[500px] lg:w-[600px] grid-cols-2">
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

      {/* Modified Industry Tabs */}
      <div className="sticky top-16 z-20 border-b translucent-navbar shadow-sm">
        <div className="container px-4 py-2 overflow-x-auto scrollbar-none">
          <Tabs 
            defaultValue={activeTab} 
            value={activeTab}
            onValueChange={handleTabChange}
            className="w-full"
          >
            <TabsList className="w-full flex justify-start p-0 h-10 bg-transparent space-x-2">
              {/* Personalized Tab - Always Visible */}
              <TabsTrigger 
                key="Personalized"
                value="Personalized" 
                className="px-4 py-2 rounded-md border border-transparent transition-all duration-200
                hover:bg-background/60 hover:border-border/30
                data-[state=active]:bg-primary data-[state=active]:text-primary-foreground
                data-[state=active]:shadow-sm data-[state=active]:border-transparent
                outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 !ring-0
                flex items-center gap-1.5"
              >
                <User className="h-3.5 w-3.5" />
                {isPersonaActive && activePersona?.recipientName 
                  ? `For ${activePersona.recipientName.split(' ')[0]}` 
                  : "Personalized"}
              </TabsTrigger>
              
              {/* Original Industry Tabs */}
              {AVAILABLE_INDUSTRIES.map(industry => (
                <TabsTrigger 
                  key={industry}
                  value={industry} 
                  className="px-4 py-2 rounded-md border border-transparent transition-all duration-200
                  hover:bg-background/60 hover:border-border/30
                  data-[state=active]:bg-primary data-[state=active]:text-primary-foreground
                  data-[state=active]:shadow-sm data-[state=active]:border-transparent
                  outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 !ring-0"
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
                {activeTab === "Personalized" 
                  ? "Personalized Content" 
                  : (activeTab === "All" ? "All Industries" : activeTab)}
              </h1>
              {isPersonaActive && activePersona?.recipientName && activeTab === "Personalized" && (
                <div className="text-sm text-muted-foreground mt-1 flex items-center flex-wrap">
                  <span>
                    Content ranked for <span className="font-medium">{activePersona.recipientName}</span>
                    {activePersona.jobTitle && ` (${activePersona.jobTitle})`}
                  </span>
                  {personaApplied && (
                    <Badge variant="outline" className="ml-2 bg-primary/10 text-primary text-xs">
                      AI Personalized
                    </Badge>
                  )}
                </div>
              )}
              {lastUpdated && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last updated (local time): {formatLastUpdated(lastUpdated)}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={handleRefresh}
                disabled={loading || refreshing || isBatchPersonalizing || isLoadingAllTabs}
              >
                <RefreshCw className={`h-4 w-4 ${
                  refreshing || isBatchPersonalizing || isLoadingAllTabs ? 'animate-spin' : ''
                }`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <PersonaInputCard 
                className="w-auto persona-button" 
                onRefreshRequest={personalizeArticles} 
                isOpen={personaDialogOpen}
                onOpenChange={setPersonaDialogOpen}
              />
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
          
          {isLoading ? (
            <>
              {/* Show progress indicator during loading in personalized view */}
              {isPersonalizedView && renderProgressIndicator()}
              
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
            </>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab + (isPersonaActive ? 'persona' : 'no-persona')}
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={containerVariants}
              >
                {activeTab === "Personalized" && !isPersonaActive ? (
                  <motion.div variants={emptyStateVariants}>
                    {renderPersonalizedEmptyState()}
                  </motion.div>
                ) : displayArticles.length === 0 ? (
                  <motion.div variants={emptyStateVariants} className="text-center py-12">
                    <h3 className="text-xl font-medium">No content found</h3>
                    <p className="text-muted-foreground mt-2">
                      Try changing your filters or check back later
                    </p>
                  </motion.div>
                ) : (
                  <>
                    {/* Progress indicator - show in both loading and when articles are being displayed */}
                    {isPersonalizedView && isPolling && renderProgressIndicator()}
                    
                    {/* Articles grid */}
                    <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" variants={containerVariants}>
                      {displayArticles.map(article => {
                        // Cast to EnhancedArticle to access personaScore
                        const enhancedArticle = article as EnhancedArticle;
                        
                        return (
                          <motion.div 
                            key={article.id} 
                            variants={itemVariants}
                            initial="hidden"
                            animate="visible"
                            transition={{ 
                              type: "spring", 
                              stiffness: 200, 
                              damping: 25
                            }}
                            className={isPersonalizedView && enhancedArticle.personaScore ? 
                              `ring-1 ring-primary/10 ${enhancedArticle.personaScore > 0.7 ? 'ring-2 ring-primary/20' : ''}` : 
                              undefined
                            }
                          >
                            <ArticleCard article={article} />
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>

      {/* Message generation FAB */}
      <GenerateMessageFab />

      {/* Selection hint */}
      {!loading && displayArticles.length > 0 && selectedCount === 0 && (
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

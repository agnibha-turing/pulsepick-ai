import { useState, useEffect, useCallback, useRef } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArticleCard } from "@/components/article-card";
import { FilterChips } from "@/components/filter-chips";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getArticles, DisplayArticle, batchScoreArticles, startBatchScoreArticles, getBatchScoreStatus, triggerArticleFetch, triggerReranking } from "@/services/article-service";
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
  Check,
  ArrowUpDown,
  CalendarDays,
  Clock3,
  Calendar,
  CalendarRange
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
const AVAILABLE_TIME_PERIODS = ["Today", "3 Days", "7 Days", "All"];

// Add this interface near other interfaces at the top of the file
interface BatchScoreStatus {
  status: string;
  processed: number;
  total: number;
  progressPercentage: number;
  results: Array<{ id: number, relevance_score: number }>;
  lastUpdated: string;
  message?: string;
  error?: string;
}

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
  const [timePeriod, setTimePeriod] = useState("All");
  const [minRelevance, setMinRelevance] = useState([50]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { activePersona, setActivePersona, isPersonaActive, savedPersonas } = usePersona();
  const { selectedArticles, selectedCount } = useSelectedArticles();
  const [personaApplied, setPersonaApplied] = useState(false);
  const [llmEnhanced, setLlmEnhanced] = useState(false);
  const [personaDialogOpen, setPersonaDialogOpen] = useState(false);

  // New state to track if this is the initial load
  const [isInitialLoad, setIsInitialLoad] = useState(true);

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

  // Use a ref to track personalization in progress to avoid duplicate toasts
  const personalizationInProgressRef = useRef(false);

  // Create a constant for maximum articles to display
  const MAX_DISPLAY_ARTICLES = 100;

  // New state to track if there are new articles since last personalization
  const [hasNewArticles, setHasNewArticles] = useState(false);

  // Add a new state variable for displayed article count - near other state declarations
  const [displayedArticleCount, setDisplayedArticleCount] = useState<number>(0);

  // Add state to track article counts by industry
  const [industryCounts, setIndustryCounts] = useState<{[key: string]: number}>({
    "BFSI": 0,
    "Retail": 0, 
    "Healthcare": 0,
    "Technology": 0,
    "Other": 0
  });

  // Add a computed total count (excluding "All")
  const totalIndustryArticlesCount = Object.values(industryCounts).reduce((sum, count) => sum + count, 0);

  // Add new state for sources at the top with other state declarations
  const [availableSources, setAvailableSources] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  // Add a new filterArticles function that applies all filters to the current articles
  const filterArticles = useCallback((articlesToFilter: DisplayArticle[]) => {
    // Start with all articles
    let filtered = [...articlesToFilter];
    
    // Filter by time period
    if (timePeriod !== "All") {
      const now = new Date();
      const cutoffDate = new Date();
      
      switch(timePeriod) {
        case "Today":
          cutoffDate.setDate(now.getDate() - 1);
          break;
        case "3 Days":
          cutoffDate.setDate(now.getDate() - 3);
          break;
        case "7 Days":
          cutoffDate.setDate(now.getDate() - 7);
          break;
        default:
          // "All" option - since we only have data for 7 days, this is the same as 7 days
          cutoffDate.setDate(now.getDate() - 7);
          break;
      }
      
      filtered = filtered.filter(article => {
        const articleDate = new Date(article.date);
        return articleDate >= cutoffDate;
      });
    }
    
    // Filter by selected sources
    if (selectedSources.length > 0) {
      filtered = filtered.filter(article => 
        selectedSources.includes(article.source)
      );
    }
    
    return filtered;
  }, [timePeriod, selectedSources]);

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
        
        // Update displayed count when manually loading a tab
        setDisplayedArticleCount(result.articles.length);
      }
      
      // Update industry counts if this is an industry tab (not "All")
      if (industry !== "All" && AVAILABLE_INDUSTRIES.includes(industry)) {
        setIndustryCounts(prev => ({
          ...prev,
          [industry]: result.articles.length
        }));
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
  }, [activeFilters, activeIndustry, AVAILABLE_INDUSTRIES]);

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

  // Re-personalize existing articles without fetching new ones
  const personalizeArticles = useCallback(async () => {
    if (!isPersonaActive || !activePersona) return;
    
    // Set the in-progress ref to true
    personalizationInProgressRef.current = true;
    setIsBatchPersonalizing(true);
    
    try {
      // Show an initial toast indicating process is starting
      toast.info("Re-ranking articles...", {
        description: "Analyzing content relevance for your persona",
        duration: 4000
      });
      
      // Use existing articles - no fetching of new articles
      if (allTabsArticles.length === 0) {
        toast.error("No articles to personalize");
        setIsBatchPersonalizing(false);
        personalizationInProgressRef.current = false;
        return;
      }
      
      // Get the IDs of all the unique articles
      const uniqueArticleIds = Array.from(
        new Set(allTabsArticles.map(article => article.id))
      );
      
      // Limit to maximum display limit to avoid processing unnecessary articles
      const limitedArticleIds = uniqueArticleIds.slice(0, MAX_DISPLAY_ARTICLES);
      
      // Start async batch scoring with the limited set
      const taskResult = await startBatchScoreArticles(limitedArticleIds, activePersona);
      
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
      
      // Reset new articles flag since we've just re-ranked
      setHasNewArticles(false);
      
      // Update the displayed count for personalized articles, with a delay to allow for personalization
      setTimeout(() => {
        setDisplayedArticleCount(personalizedArticles.length);
      }, 2000);
      
    } catch (error) {
      console.error("Error personalizing articles:", error);
      toast.error("Failed to personalize content");
      setIsBatchPersonalizing(false);
      // Reset in-progress ref on error
      personalizationInProgressRef.current = false;
    }
  }, [
    isPersonaActive, 
    activePersona, 
    allTabsArticles
  ]);
  
  // Polling effect with toast tracking - optimized for a single large batch
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    
    const pollForResults = async () => {
      if (!scoringTaskId || !isPolling) return;
      
      try {
        const status = await getBatchScoreStatus(scoringTaskId);
        
        // Special handling for expired or failed tasks
        if (status.status === "expired" || status.status === "failed") {
          console.warn(`Task ${scoringTaskId} ${status.status}: ${
            (status as BatchScoreStatus).message || (status as BatchScoreStatus).error || "No details available"
          }`);
          setIsPolling(false);
          setIsBatchPersonalizing(false);
          
          // Reset in-progress ref on error
          personalizationInProgressRef.current = false;
          
          // Show a more informative notification
          toast.info(`Personalization ${status.status}`, {
            description: (status as BatchScoreStatus).message || "Using available scores to personalize content.",
            duration: 5000
          });
          
          // Still try to use any results we have
          if (status.results && status.results.length > 0) {
            console.log(`Using ${status.results.length} partial results for personalization`);
            const updatedArticles = updateArticlesWithScores(allTabsArticles, status.results);
            setPersonalizedArticles(updatedArticles);
          } else {
            // Don't automatically retry - this causes duplicate tasks
            console.log("No results available from expired task");
            toast.info("Personalization expired", {
              description: "You can retry manually if needed",
              duration: 3000
            });
          }
          
          return;
        }
        
        // For single large batches, implement smooth progress animation
        // We want gradual progress even if backend reports jumps
        if (status.progressPercentage > scoringProgress) {
          // For smoother animation, move only 10% closer to the actual value
          // This creates a gradual "catching up" effect for better UX
          const smoothedProgress = Math.min(
            scoringProgress + Math.max(2, Math.ceil((status.progressPercentage - scoringProgress) / 5)),
            status.progressPercentage
          );
          setScoringProgress(smoothedProgress);
        }
        setProgressProcessed(status.processed);
        
        // Check if processing is complete
        if (status.status === "completed") {
          // With a single larger batch, ensure we display a complete progress animation
          // Only update articles when progress bar reaches 100%
          if (scoringProgress < 100) {
            // Animate to 100% before showing results
            setScoringProgress(100);
            
            // Add a fixed minimum delay of 2 seconds to ensure progress bar animation is visible
            // This creates a more satisfying UX where users can see the progress complete
            setTimeout(() => {
              if (status.results && status.results.length > 0) {
                const updatedArticles = updateArticlesWithScores(allTabsArticles, status.results);
                
                // Delay showing articles until progress bar animation is fully complete
                // Add another small delay after progress reaches 100% for visual satisfaction
                setTimeout(() => {
                  setPersonalizedArticles(updatedArticles);
                  setIsPolling(false);
                  setIsBatchPersonalizing(false);
                  setScoringTaskId(null);
                  
                  // Only show success toast if personalization is still in progress
                  if (personalizationInProgressRef.current) {
                    toast.success(`Content personalized for ${activePersona?.recipientName}`, {
                      description: `${status.results?.length || 0} articles ranked based on relevance to ${activePersona?.jobTitle || 'recipient'}`,
                      duration: 4000
                    });
                    // Reset the ref after showing toast
                    personalizationInProgressRef.current = false;
                  }
                }, 1000); // Increased delay for showing articles (1 second) after progress hits 100%
              } else {
                setIsPolling(false);
                setIsBatchPersonalizing(false);
                setScoringTaskId(null);
                // Reset in-progress ref when done
                personalizationInProgressRef.current = false;
              }
            }, 2000); // Increased delay to ensure animation is visible for single batch
          } else {
            // Progress already at 100%, still add a delay for consistent experience
            if (status.results && status.results.length > 0) {
              const updatedArticles = updateArticlesWithScores(allTabsArticles, status.results);
              
              // Add consistent delay even when already at 100%
              setTimeout(() => {
                setPersonalizedArticles(updatedArticles);
                setIsPolling(false);
                setIsBatchPersonalizing(false);
                setScoringTaskId(null);
                
                // Only show success toast if personalization is still in progress
                if (personalizationInProgressRef.current) {
                  toast.success(`Content personalized for ${activePersona?.recipientName}`, {
                    description: `${status.results?.length || 0} articles ranked based on relevance to ${activePersona?.jobTitle || 'recipient'}`,
                    duration: 4000
                  });
                  // Reset the ref after showing toast
                  personalizationInProgressRef.current = false;
                }
              }, 1000);
            } else {
              setIsPolling(false);
              setIsBatchPersonalizing(false);
              setScoringTaskId(null);
              // Reset in-progress ref when done
              personalizationInProgressRef.current = false;
            }
          }
        }
      } catch (error) {
        console.error("Error polling for batch status:", error);
        setIsPolling(false);
        setIsBatchPersonalizing(false);
        // Reset in-progress ref on error
        personalizationInProgressRef.current = false;
        
        // Show a non-blocking notification
        toast.error("Personalization error", {
          description: "Using default article ranking. Try again later.",
          duration: 3000
        });
      }
    };
    
    if (isPolling && scoringTaskId) {
      // Initial poll immediately
      pollForResults();
      
      // For a single large batch, poll less frequently to reduce server load
      // but frequently enough to provide visual feedback
      pollInterval = setInterval(pollForResults, 1500);
    }
    
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [isPolling, scoringTaskId, allTabsArticles, activePersona, updateArticlesWithScores, scoringProgress]);

  // Fetch regular articles on mount and when filters change
  useEffect(() => {
    const initialLoad = async () => {
      setLoading(true);
      try {
        // Only do the full refresh on initial load, not when switching tabs
        if (isInitialLoad) {
          // On initial load/page reload, fetch fresh articles and rerank
          const fetchPromise = triggerArticleFetch();
          toast.info("Discovering new content...", {
            description: "Fetching the latest articles from sources",
            duration: 3000
          });
          
          await fetchPromise;
          
          const rerankPromise = triggerReranking();
          toast.info("Processing content...", {
            description: "Analyzing and organizing articles",
            duration: 3000
          });
          
          await rerankPromise;
          
          // Slight delay to allow backend to process
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Mark initial load as complete
          setIsInitialLoad(false);
        }
        
        // Then fetch the articles from database
        await fetchArticles();
        
        // Set initial displayed count
        setDisplayedArticleCount(articles.length);
        
        // Only show success toast on initial load, not tab switching
        if (isInitialLoad) {
          toast.success("Content ready", {
            description: "Your feed has been updated with the latest articles",
            duration: 3000
          });
        }
      } catch (error) {
        console.error("Error during initial load:", error);
        // Fall back to just loading existing data if the fetch/rerank fails
        fetchArticles();
        
        if (isInitialLoad) {
          toast.error("Could not fetch new content", {
            description: "Showing existing articles from database",
            duration: 3000
          });
        }
      } finally {
        setLoading(false);
      }
    };
    
    initialLoad();
  }, [fetchArticles, isInitialLoad]);

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
      
      // Show notification that personalization process is continuing
      setTimeout(() => {
        toast.info(
          `Personalizing for ${activePersona.recipientName}`,
          {
            description: "Content analysis is running in the background. Switch to the Personalized tab (if not already) to see results.",
            duration: 4000
          }
        );
      }, 2000); // Show this message 2 seconds after the initial one
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

  // Handle refresh button click - fetch fresh articles from external sources
  const handleRefresh = async () => {
    // This function is only for the general tabs, not the personalized tab
    // For personalized tab, use personalizeArticles() instead
    
    setRefreshing(true);
    
    try {
      // First, trigger fresh article fetch from external sources
      const fetchPromise = triggerArticleFetch();
      toast.info("Discovering new content...", {
        description: "Fetching the latest articles from sources",
        duration: 4000
      });
      
      await fetchPromise;
      
      // Then trigger reranking
      const rerankPromise = triggerReranking();
      toast.info("Processing content...", {
        description: "Analyzing and organizing articles",
        duration: 4000
      });
      
      await rerankPromise;
      
      // Slight delay to allow backend to process new articles
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check how many articles we had before
      const previousCount = articles.length;
      
      // Just refresh the current industry tab
      await fetchArticles();
      
      // Update displayed count after refresh
      setDisplayedArticleCount(articles.length);
      
      // Track if new articles were added
      if (articles.length > previousCount) {
        setHasNewArticles(true);
        toast.success(`${articles.length - previousCount} new articles added`, {
          description: "Switch to Personalized tab and re-rank to personalize them",
          duration: 5000
        });
      } else {
        toast.success("Content refreshed", {
          description: "No new articles found",
          duration: 4000
        });
      }
    } catch (error) {
      console.error("Error during refresh:", error);
      toast.error("An error occurred while refreshing", {
        description: "Please try again later",
        duration: 4000
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Determine which articles to display (with cap at 100)
  const allArticles = activeTab === "Personalized" ? personalizedArticles : articles;
  // Apply the maximum limit for display
  const unfilteredDisplayArticles = allArticles.slice(0, MAX_DISPLAY_ARTICLES);
  const displayArticles = filterArticles(unfilteredDisplayArticles);
  const totalArticleCount = allArticles.length;
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
    
    // Simplified status message for fast processing
    const getStatusMessage = () => {
      if (refreshing) {
        return "Refreshing personalization";
      } else if (scoringProgress < 90) {
        return "Personalizing content for recipient";
      } else {
        return "Almost ready!";
      }
    };
    
    // Helper to get initials from name
    const getInitials = (name: string) => {
      if (!name) return "?";
      return name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    };
    
    return (
      <div className="mb-6 max-w-3xl mx-auto bg-card/80 border rounded-lg p-5 shadow-lg backdrop-blur-md transition-all duration-300">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 gap-2">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border">
              <AvatarFallback className="bg-primary/20 text-primary font-medium">
                {getInitials(activePersona?.recipientName || "")}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm">
                Personalizing for <span className="font-semibold">{activePersona?.recipientName}</span>
              </p>
              <p className="text-xs text-muted-foreground">{getStatusMessage()}</p>
            </div>
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-primary font-medium px-3 py-1 self-start sm:self-auto">
            {scoringProgress < 90 
              ? 'Personalizing...' 
              : `${progressTotal} articles`}
          </Badge>
        </div>
        
        <div className="mt-4 space-y-2">
          <div className="relative w-full h-2.5 bg-primary/10 rounded-full overflow-hidden">
            <div 
              className="absolute left-0 top-0 h-full bg-primary transition-all duration-300 ease-out rounded-full"
              style={{ width: `${scoringProgress}%` }}
            ></div>
          </div>
          
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground flex items-center">
              <RefreshCw className="h-3 w-3 mr-1.5 animate-spin text-primary" />
              {scoringProgress < 90
                ? 'Using AI to analyze articles'
                : 'Finalizing your feed...'}
            </p>
            <p className="text-xs text-muted-foreground">
              {refreshing ? "Preparing updated content" : "Using AI + cache for speed"}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Modified tab change handler
  const handleTabChange = (value: string) => {
    if (value === "Personalized") {
      // Simply switch to the personalized tab
      setActiveTab("Personalized");
      // Update displayed count based on personalized articles
      setDisplayedArticleCount(personalizedArticles.length);
    } else {
      // Switch to a regular industry tab - loading handled by the effect
      setActiveTab(value);
      setActiveIndustry(value);
      // Update displayed count based on current articles after a short delay to let them load
      setTimeout(() => {
        setDisplayedArticleCount(articles.length);
      }, 300);
    }
  };

  // Add a component to render the new content notification
  const renderNewContentPrompt = () => {
    // Don't show when:
    // 1. There are no new articles, or
    // 2. We're not in the personalized tab, or
    // 3. Personalization is already happening, or
    // 4. A new persona was just applied (personalization happens automatically)
    if (!hasNewArticles || 
        !isPersonaActive || 
        activeTab !== "Personalized" || 
        isBatchPersonalizing || 
        lastPersonalizationTime && (Date.now() - lastPersonalizationTime < 10000)) return null;
    
    return (
      <div className="mb-4 bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
        <ArrowUpDown className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-medium text-sm">New content available</h4>
          <p className="text-sm text-muted-foreground mt-1">
            New articles have been added. Click the "Re-rank" button to include them in your personalized feed.
          </p>
          <Button 
            variant="default" 
            size="sm" 
            className="mt-3 bg-primary hover:bg-primary/90"
            onClick={personalizeArticles}
            disabled={isBatchPersonalizing}
          >
            Re-rank now
          </Button>
        </div>
      </div>
    );
  };

  // Add effect to collect unique sources from articles
  useEffect(() => {
    // Extract unique sources from all articles
    const sources = Array.from(new Set(allTabsArticles.map(article => article.source)));
    
    // Sort sources alphabetically for better UX
    sources.sort();
    
    // Only update available sources when they change, to avoid unnecessary re-renders
    if (JSON.stringify(sources) !== JSON.stringify(availableSources)) {
      setAvailableSources(sources);
      
      // Initialize selected sources only once when sources are first loaded
      // This prevents overriding user selections when new articles are loaded
      if (selectedSources.length === 0 && sources.length > 0) {
        setSelectedSources([...sources]);
      }
    }
  }, [allTabsArticles, availableSources, selectedSources]);

  // Add a toggleSource function
  const toggleSource = (source: string) => {
    setSelectedSources(prev => {
      if (prev.includes(source)) {
        // Don't allow removing the last source - at least one must be selected
        if (prev.length === 1) {
          toast.info("At least one source must be selected");
          return prev;
        }
        return prev.filter(s => s !== source);
      } else {
        return [...prev, source];
      }
    });
  };

  // Add a function to handle select all/deselect all sources
  const handleToggleAllSources = () => {
    if (selectedSources.length === availableSources.length) {
      // Deselect all except one (we need at least one selected)
      if (availableSources.length > 0) {
        setSelectedSources([availableSources[0]]);
      }
    } else {
      // Select all
      setSelectedSources([...availableSources]);
    }
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
            {/* Total Articles Count - Animated */}
            <AnimatePresence mode="popLayout">
              <motion.div
                key={`article-count-${totalIndustryArticlesCount}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="hidden md:flex items-center bg-black/5 dark:bg-white/10 px-3 py-1.5 rounded-full"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                  <path d="M16 6H3" />
                  <path d="M21 12H3" />
                  <path d="M21 18H3" />
                </svg>
                <span className="text-xs text-muted-foreground font-medium mr-1">Articles:</span>
                <motion.span 
                  key={totalIndustryArticlesCount}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs font-bold text-primary"
                >
                  {totalIndustryArticlesCount}
                </motion.span>
              </motion.div>
            </AnimatePresence>
            
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
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">              
              {isPolling && (
                <Badge variant="outline" className="bg-primary/10 text-primary font-medium py-1 px-3 flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  <span>Personalizing</span>
                </Badge>
              )}
              
              {/* Mobile-only article count */}
              <Badge variant="outline" className="md:hidden bg-black/5 text-foreground font-medium py-1 px-3 flex items-center gap-1.5">
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                    <path d="M16 6H3" />
                    <path d="M21 12H3" />
                    <path d="M21 18H3" />
                  </svg>
                </div>
                <span className="text-primary font-bold">{totalIndustryArticlesCount}</span>
              </Badge>
            </div>
            
            {hasNewArticles && (
              <Badge variant="outline" className="bg-green-500/10 text-green-600 font-medium py-1 px-3">
                New content available
              </Badge>
            )}
          </div>
          
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
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">
                  {activeTab === "Personalized" 
                    ? "Personalized Content" 
                    : (activeTab === "All" ? "All Industries" : activeTab)}
                </h1>
                <div className="relative h-[22px] w-[34px] flex items-center justify-center mt-1">
                  <AnimatePresence initial={false}>
                    <motion.div
                      key={`${activeTab}-count-${isLoading ? 'loading' : 'loaded'}`}
                      initial={{ opacity: 0, position: 'absolute' }}
                      animate={{ opacity: 1, position: 'absolute' }}
                      exit={{ opacity: 0, position: 'absolute' }}
                      transition={{ 
                        opacity: { duration: 0.25, ease: "easeInOut" }
                      }}
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ width: '100%', height: '100%' }}
                    >
                      {isLoading ? (
                        <div className="bg-primary/30 text-primary-foreground/70 font-semibold text-xs rounded px-1.5 py-0 inline-flex items-center justify-center min-w-[28px]">
                          <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                        </div>
                      ) : displayArticles.length > 0 ? (
                        <div className="bg-primary text-primary-foreground font-semibold text-xs rounded px-1.5 py-0 inline-flex items-center justify-center min-w-[28px]">
                          {totalArticleCount > MAX_DISPLAY_ARTICLES 
                            ? `${displayArticles.length}` 
                            : displayArticles.length}
                        </div>
                      ) : (
                        <div className="bg-primary/10 text-primary/30 font-semibold text-xs rounded px-1.5 py-0 inline-flex items-center justify-center min-w-[28px]">
                          0
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
              {isPersonaActive && activePersona?.recipientName && activeTab === "Personalized" && (
                <div className="text-sm text-muted-foreground mt-1 flex items-center flex-wrap gap-2">
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
              {activeTab === "Personalized" ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  onClick={personalizeArticles}
                  disabled={loading || refreshing || isBatchPersonalizing || isLoadingAllTabs}
                >
                  <ArrowUpDown className={`h-4 w-4 ${
                    isBatchPersonalizing ? 'animate-spin' : ''
                  }`} />
                  <span className="hidden sm:inline">Re-rank</span>
                </Button>
              ) : (
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
              )}
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
                    
                    {/* New content notification prompt */}
                    {renderNewContentPrompt()}
                    
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
        {/* Source Filter */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium">Sources</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs" 
              onClick={handleToggleAllSources}
            >
              {selectedSources.length === availableSources.length ? "Deselect All" : "Select All"}
            </Button>
          </div>
          
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2">
            {availableSources.map(source => {
              // Generate logo or icon based on source name
              let logo = null;
              switch(source) {
                case "Google News":
                  logo = (
                    <div className="w-7 h-7 flex items-center justify-center bg-background border border-border text-foreground rounded-md shadow-sm">
                      <span className="font-semibold text-xs">G</span>
                    </div>
                  );
                  break;
                case "TechCrunch":
                  logo = (
                    <div className="w-7 h-7 flex items-center justify-center bg-background border border-border text-foreground rounded-md shadow-sm">
                      <span className="font-semibold text-xs">TC</span>
                    </div>
                  );
                  break;
                case "Y Combinator Hacker News":
                  logo = (
                    <div className="w-7 h-7 flex items-center justify-center bg-background border border-border text-foreground rounded-md shadow-sm">
                      <span className="font-semibold text-xs">Y</span>
                    </div>
                  );
                  break;
                default:
                  // Default icon for other sources
                  logo = (
                    <div className="w-7 h-7 flex items-center justify-center bg-background border border-border text-foreground rounded-md shadow-sm">
                      <span className="font-semibold text-xs">{source.charAt(0)}</span>
                    </div>
                  );
              }
              
              return (
                <div 
                  key={source} 
                  className={`flex items-center gap-3 border rounded-md p-2 cursor-pointer transition-all
                    ${selectedSources.includes(source) 
                      ? 'bg-primary/10 border-primary/30' 
                      : 'border-border hover:border-primary/30 hover:bg-muted/30'}`}
                  onClick={() => toggleSource(source)}
                >
                  {logo}
                  <span className="text-sm truncate flex-1">{source}</span>
                  <div 
                    className={`w-5 h-5 rounded-md flex-shrink-0 ${
                      selectedSources.includes(source) 
                        ? "bg-primary" 
                        : "border border-input"
                    } flex items-center justify-center`}
                  >
                    {selectedSources.includes(source) && (
                      <Check className="h-3.5 w-3.5 text-primary-foreground" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="font-medium mb-3">Time Period</h3>
          <div className="grid grid-cols-2 gap-2">
            {["Today", "3 Days", "7 Days", "All"].map(period => {
              // Icons for each time period
              let icon = null;
              switch(period) {
                case "Today":
                  icon = <CalendarDays className="h-4 w-4" />;
                  break;
                case "3 Days":
                  icon = <Clock3 className="h-4 w-4" />;
                  break;
                case "7 Days":
                  icon = <Calendar className="h-4 w-4" />;
                  break;
                case "All":
                  icon = <CalendarRange className="h-4 w-4" />;
                  break;
              }
              
              return (
                <div
                  key={period}
                  className={`flex items-center gap-2 p-2 border rounded-md cursor-pointer transition-all
                    ${timePeriod === period 
                      ? 'bg-primary text-primary-foreground border-primary' 
                      : 'bg-card hover:bg-muted border-border'}`}
                  onClick={() => setTimePeriod(period)}
                >
                  {icon}
                  <span className="text-sm font-medium">{period}</span>
                </div>
              );
            })}
          </div>
        </div>
        
        <div>
          <h3 className="font-medium mb-3">Saved Items</h3>
          <div 
            className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-muted/30 transition-all"
          >
            <BookmarkPlus size={18} />
            <span className="text-sm font-medium">Saved for Later</span>
          </div>
        </div>
      </div>
    )
  }
};

export default Index;

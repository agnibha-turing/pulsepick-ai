
import { useState, useEffect } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArticleCard } from "@/components/article-card";
import { FilterChips } from "@/components/filter-chips";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getArticles, Article } from "@/services/article-service";

const AVAILABLE_FILTERS = ["BFSI", "Retail"];

const Index = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  useEffect(() => {
    const fetchArticles = async () => {
      setLoading(true);
      try {
        const articlesData = await getArticles(activeFilters);
        setArticles(articlesData);
      } catch (error) {
        console.error("Error fetching articles:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, [activeFilters]);

  const handleFilterChange = (filter: string) => {
    setActiveFilters(prev => 
      prev.includes(filter)
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  return (
    <ThemeProvider defaultTheme="dark">
      <div className="min-h-screen flex flex-col bg-background">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
          <div className="container flex h-16 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl">Article<span className="text-primary">Spark</span></span>
            </div>
            <ThemeToggle />
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 container px-4 py-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">AI Article Recommendations</h1>
            <p className="text-muted-foreground">
              Discover trending AI articles tailored for your industry to share with clients and prospects.
            </p>
          </div>

          {/* Filters */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
              <h2 className="text-lg font-medium">Filter by Industry</h2>
              {activeFilters.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setActiveFilters([])}
                  className="text-muted-foreground text-sm h-8"
                >
                  Clear filters
                </Button>
              )}
            </div>
            <FilterChips 
              filters={AVAILABLE_FILTERS} 
              activeFilters={activeFilters}
              onFilterChange={handleFilterChange}
            />
          </div>

          {/* Articles Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-card rounded-lg p-6 space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/4" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                  <div className="pt-2 flex justify-between">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-5 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {articles.length === 0 ? (
                <div className="text-center py-12">
                  <h3 className="text-xl font-medium">No articles found</h3>
                  <p className="text-muted-foreground mt-2">Try changing your filters or check back later</p>
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

        {/* Footer */}
        <footer className="border-t py-6">
          <div className="container px-4 text-center text-sm text-muted-foreground">
            <p>© 2025 ArticleSpark. AI-powered article recommendations for sales professionals.</p>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
};

export default Index;

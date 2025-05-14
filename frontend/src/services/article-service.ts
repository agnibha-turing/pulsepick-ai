import { Persona } from "@/components/persona-input-card";

export interface BackendArticle {
  id: number;
  title: string;
  url: string;
  author: string;
  published_at: string;
  summary: string;
  industry: string;
  relevance_score: number;
  keywords?: string[];
  source: {
    id: number;
    name: string;
    type: string;
  };
}

// Frontend display interface - used by components
export interface DisplayArticle {
  id: string;
  title: string;
  summary: string[];
  trendingScore: number;
  categories: string[];
  keywords: string[];
  date: string;
  source: string;
  url: string;
}

// Response interface from the backend
export interface ArticleResponse {
  articles: BackendArticle[];
  last_updated: string;
}

const mockArticles: BackendArticle[] = [
  {
    id: 1,
    title: "How AI is Transforming the Banking Industry",
    url: "https://example.com/article1",
    author: "Financial Technology Today",
    published_at: "2025-05-02T10:00:00Z",
    summary: "AI-powered fraud detection systems reduce financial crimes by 37%. Automated customer service handling 68% of routine banking inquiries. Personalized financial advice increasing customer engagement by 42%.",
    industry: "bfsi",
    relevance_score: 0.92,
    keywords: ["Finance", "Banking", "AI", "Fraud Detection", "Customer Service"],
    source: {
      id: 1,
      name: "Financial Technology Today",
      type: "news_site"
    }
  },
  {
    id: 2,
    title: "Retail Revolution: AI-Driven Customer Experience",
    url: "https://example.com/article2",
    author: "Retail Innovation Weekly",
    published_at: "2025-05-03T09:30:00Z",
    summary: "Smart recommendation engines boosting sales by 28% in top retailers. Visual search technology reducing product discovery time by 65%. AI inventory management reducing overstocking costs by 31%.",
    industry: "retail",
    relevance_score: 0.85,
    keywords: ["Commerce", "Customer Experience", "AI", "Recommendations", "Visual Search"],
    source: {
      id: 2,
      name: "Retail Innovation Weekly",
      type: "news_site"
    }
  },
  {
    id: 3,
    title: "Insurance Companies Embrace Generative AI for Risk Assessment",
    url: "https://example.com/article3",
    author: "Insurance Technology Review",
    published_at: "2025-05-01T14:15:00Z",
    summary: "Generative AI models improving risk prediction accuracy by 41%. Claim processing times reduced by 73% with automated systems. New AI tools detecting fraudulent claims patterns missed by humans.",
    industry: "bfsi",
    relevance_score: 0.78,
    keywords: ["Insurance", "AI", "Risk Assessment", "Fraud Detection", "Claims Processing"],
    source: {
      id: 3,
      name: "Insurance Technology Review",
      type: "news_site"
    }
  },
  {
    id: 4,
    title: "AI Shopping Assistants: The Future of E-Commerce",
    url: "https://example.com/article4",
    author: "Digital Commerce Trends",
    published_at: "2025-05-04T11:45:00Z",
    summary: "Virtual shopping assistants increasing average order value by 23%. Voice commerce adoption growing 47% year-over-year. AI-powered size recommendation reducing returns by 34%.",
    industry: "retail",
    relevance_score: 0.88,
    keywords: ["E-Commerce", "AI", "Shopping Assistants", "Voice Commerce", "Returns"],
    source: {
      id: 4,
      name: "Digital Commerce Trends",
      type: "news_site"
    }
  },
  {
    id: 9,
    title: "AI-Driven Diagnostics Reducing Hospital Wait Times by 47%",
    url: "https://example.com/article9",
    author: "Medical Innovation Today",
    published_at: "2025-05-02T08:30:00Z",
    summary: "Machine learning algorithms identifying critical cases 8 minutes faster on average. Remote monitoring technology decreasing readmission rates by 36%. Predictive analytics helping optimize staff scheduling during peak hours.",
    industry: "healthcare",
    relevance_score: 0.91,
    keywords: ["Healthcare", "AI", "Diagnostics", "Wait Times", "Machine Learning"],
    source: {
      id: 9,
      name: "Medical Innovation Today",
      type: "news_site"
    }
  },
  {
    id: 13,
    title: "Tech Giants Competing for AI Chip Dominance",
    url: "https://example.com/article13",
    author: "Silicon Trends",
    published_at: "2025-05-02T15:20:00Z",
    summary: "New neural processing units showing 4.3x performance gains over previous generation. Edge AI capabilities enabling 78% reduction in cloud computing dependencies. Specialized ML hardware market projected to reach $67B by 2026.",
    industry: "technology",
    relevance_score: 0.93,
    keywords: ["Tech", "AI Chip", "Hardware", "Neural Processing", "Cloud Computing"],
    source: {
      id: 13,
      name: "Silicon Trends",
      type: "news_site"
    }
  }
];

// API URL - using relative path to work with the proxy
const API_URL = "/api/articles";

// Convert API article format to display format for UI components
const transformToDisplayArticle = (article: BackendArticle): DisplayArticle => {
  // Convert summary string to array - take the original as first item
  const summaryArray = [article.summary];
  
  // Add some extracted sentences if summary is long enough
  if (article.summary.length > 100) {
    const sentences = article.summary.match(/[^.!?]+[.!?]+/g) || [];
    if (sentences.length > 1) {
      summaryArray.push(sentences[1].trim());
    }
  }
  
  // Convert industry to category array
  const categories: string[] = [];
  if (article.industry) {
    // Convert first letter to uppercase for consistent display
    const industry = article.industry.toUpperCase();
    categories.push(industry);
  }
  
  return {
    id: article.id.toString(),
    title: article.title,
    summary: summaryArray,
    trendingScore: Math.round(article.relevance_score * 100), // Convert to 0-100 scale
    categories: categories,
    keywords: article.keywords || ["AI", "Technology", "Innovation", "Digital", article.industry],
    date: article.published_at,
    source: article.source?.name || article.author || "Unknown Source",
    url: article.url
  };
};

export const getArticles = async (
  filters: string[] = [], 
  persona: Persona | null = null,
  useLLM: boolean = true
): Promise<{ articles: DisplayArticle[], lastUpdated: string, personaApplied?: boolean, llmEnhanced?: boolean }> => {
  try {
    // Try to fetch from backend first
    let apiUrl = API_URL;
    let method = "GET";
    let body = null;
    
    // Add industry filter if a specific one is requested (except "All")
    if (filters.length === 1 && filters[0] !== "All") {
      apiUrl += `?industry=${filters[0].toLowerCase()}`;
    } else if (filters.length > 0) {
      // For multiple filters, we might need a different endpoint or additional query params
      apiUrl += `?balanced=true`;
    }
    
    // If persona is provided, switch to POST request with persona in body
    if (persona) {
      method = "POST";
      
      // Add query parameter for LLM usage
      if (apiUrl.includes('?')) {
        apiUrl += `&use_llm=${useLLM}`;
      } else {
        apiUrl += `?use_llm=${useLLM}`;
      }
      
      body = JSON.stringify({ persona });
    }
    
    const response = await fetch(apiUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });
    
    // If the request was successful
    if (response.ok) {
      const data: ArticleResponse & { persona_applied?: boolean, llm_enhanced?: boolean } = await response.json();
      
      // Transform articles to display format
      const displayArticles = data.articles.map(transformToDisplayArticle);
      
      return {
        articles: displayArticles,
        lastUpdated: data.last_updated,
        personaApplied: data.persona_applied,
        llmEnhanced: data.llm_enhanced
      };
    } else {
      console.warn("Failed to fetch from backend API, falling back to mock data");
      throw new Error("API request failed");
    }
  } catch (error) {
    console.warn("Error fetching articles from backend:", error);
    console.info("Falling back to mock data");
    
    // Fallback to mock data
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
    
    let filteredMocks = mockArticles;
    
    if (filters.length === 1 && filters[0] !== "All") {
      // Filter by industry
      const industry = filters[0].toLowerCase();
      filteredMocks = mockArticles.filter(article => 
        article.industry.toLowerCase() === industry
      );
    }
    
    // Apply mock persona filtering if persona is provided
    if (persona && persona.recipientName) {
      // Simple mock implementation of persona relevance
      filteredMocks = filteredMocks.map(article => {
        // Check if article contains anything relevant to the persona
        const articleText = `${article.title} ${article.summary}`.toLowerCase();
        const personaText = `${persona.recipientName} ${persona.jobTitle} ${persona.company} ${persona.conversationContext}`.toLowerCase();
        
        // Simple word matching for demo purposes
        const personaWords = personaText.split(/\s+/).filter(w => w.length > 3);
        let matchCount = 0;
        
        for (const word of personaWords) {
          if (articleText.includes(word)) {
            matchCount++;
          }
        }
        
        // Adjust relevance score based on matches (simple mock algorithm)
        if (matchCount > 0) {
          article.relevance_score = Math.min(0.95, article.relevance_score + (matchCount * 0.05));
        }
        
        return article;
      });
      
      // Sort by adjusted relevance score
      filteredMocks.sort((a, b) => b.relevance_score - a.relevance_score);
    }
    
    // Transform mocks to display format
    const displayArticles = filteredMocks.map(transformToDisplayArticle);
    
    // Return with the current time as lastUpdated for mock data
    return {
      articles: displayArticles,
      lastUpdated: new Date().toISOString(),
      personaApplied: !!persona,
      llmEnhanced: false
    };
  }
};

/**
 * Send a batch of articles to be scored for a specific persona
 */
export const batchScoreArticles = async (
  articleIds: string[],
  persona: Persona
): Promise<{ [id: string]: number }> => {
  try {
    const response = await fetch(`${API_URL}/batch-score`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        article_ids: articleIds,
        persona: persona
      }),
    });
    
    if (!response.ok) {
      throw new Error("Failed to score articles");
    }
    
    const data = await response.json();
    
    // Convert the scored articles array to a map of id -> score
    const scoreMap: { [id: string]: number } = {};
    data.scored_articles.forEach((article: { id: number, relevance_score: number }) => {
      scoreMap[article.id.toString()] = article.relevance_score;
    });
    
    return scoreMap;
  } catch (error) {
    console.error("Error scoring articles:", error);
    
    // Fallback: return a map with default scores
    const defaultScoreMap: { [id: string]: number } = {};
    articleIds.forEach(id => {
      defaultScoreMap[id] = 0.5; // Default middle score
    });
    
    return defaultScoreMap;
  }
};

/**
 * Start an asynchronous batch scoring job for a list of articles
 */
export const startBatchScoreArticles = async (
  articleIds: string[],
  persona: Persona
): Promise<{ taskId: string, status: string, totalArticles: number }> => {
  try {
    const response = await fetch(`${API_URL}/batch-score-async`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        article_ids: articleIds,
        persona: persona
      }),
    });
    
    if (!response.ok) {
      throw new Error("Failed to start batch scoring");
    }
    
    const data = await response.json();
    
    return {
      taskId: data.task_id,
      status: data.status,
      totalArticles: data.total_articles
    };
  } catch (error) {
    console.error("Error starting batch scoring:", error);
    throw error;
  }
};

/**
 * Check the status of a batch scoring job and get incremental results
 */
export const getBatchScoreStatus = async (
  taskId: string
): Promise<{
  status: string;
  processed: number;
  total: number;
  progressPercentage: number;
  results: Array<{ id: number, relevance_score: number }>;
  lastUpdated: string;
}> => {
  try {
    const response = await fetch(`${API_URL}/batch-score-status/${taskId}`);
    
    if (!response.ok) {
      throw new Error("Failed to get batch scoring status");
    }
    
    const data = await response.json();
    
    return {
      status: data.status || "unknown",
      processed: data.processed || 0,
      total: data.total || 0,
      progressPercentage: data.progress_percentage || 0,
      results: data.results || [],
      lastUpdated: data.last_updated
    };
  } catch (error) {
    console.error("Error getting batch scoring status:", error);
    throw error;
  }
};

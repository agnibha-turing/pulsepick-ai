import { apiFetch, API_BASE_URL } from './api-config';

export interface Article {
  id: string;
  title: string;
  summary: string[];
  trendingScore: number;
  categories: string[];
  date: string;
  source: string;
  url: string;
  keywords?: string[];
}

// Backend API response interface
interface ApiArticle {
  id: number;
  title: string;
  url: string;
  summary: string;
  relevance_score: number;
  industry: string;
  published_at: string | null;
  author: string;
  image_url: string;
  keywords: string[] | null;
  source: {
    id: number;
    name: string;
    type: string;
  };
}

interface ApiResponse {
  articles: ApiArticle[];
}

interface UpdatesResponse {
  hasUpdates: boolean;
}

// Keep mock data for fallback/testing
const mockArticles: Article[] = [
  {
    id: "1",
    title: "How AI is Transforming the Banking Industry",
    summary: [
      "AI-powered fraud detection systems reduce financial crimes by 37%",
      "Automated customer service handling 68% of routine banking inquiries",
      "Personalized financial advice increasing customer engagement by 42%"
    ],
    trendingScore: 92,
    categories: ["BFSI"],
    date: "2025-05-02",
    source: "Financial Technology Today",
    url: "https://example.com/article1"
  },
  {
    id: "2",
    title: "Retail Revolution: AI-Driven Customer Experience",
    summary: [
      "Smart recommendation engines boosting sales by 28% in top retailers",
      "Visual search technology reducing product discovery time by 65%",
      "AI inventory management reducing overstocking costs by 31%"
    ],
    trendingScore: 85,
    categories: ["Retail"],
    date: "2025-05-03",
    source: "Retail Innovation Weekly",
    url: "https://example.com/article2"
  },
  {
    id: "3",
    title: "Insurance Companies Embrace Generative AI for Risk Assessment",
    summary: [
      "Generative AI models improving risk prediction accuracy by 41%",
      "Claim processing times reduced by 73% with automated systems",
      "New AI tools detecting fraudulent claims patterns missed by humans"
    ],
    trendingScore: 78,
    categories: ["BFSI"],
    date: "2025-05-01",
    source: "Insurance Technology Review",
    url: "https://example.com/article3"
  },
  {
    id: "4",
    title: "AI Shopping Assistants: The Future of E-Commerce",
    summary: [
      "Virtual shopping assistants increasing average order value by 23%",
      "Voice commerce adoption growing 47% year-over-year",
      "AI-powered size recommendation reducing returns by 34%"
    ],
    trendingScore: 88,
    categories: ["Retail"],
    date: "2025-05-04",
    source: "Digital Commerce Trends",
    url: "https://example.com/article4"
  },
  {
    id: "5",
    title: "Blockchain and AI: Securing Financial Transactions",
    summary: [
      "Combined AI-blockchain solutions reducing transaction disputes by 59%",
      "Smart contracts automating 78% of routine financial agreements",
      "Decentralized identity verification improving KYC compliance rates"
    ],
    trendingScore: 75,
    categories: ["BFSI"],
    date: "2025-05-02",
    source: "Blockchain Finance Journal",
    url: "https://example.com/article5"
  },
  {
    id: "6",
    title: "Metaverse Retail: Creating Immersive Shopping Experiences",
    summary: [
      "Virtual stores increasing customer engagement time by 230%",
      "Digital twins of products reducing purchase uncertainty",
      "NFT loyalty programs boosting customer retention by 45%"
    ],
    trendingScore: 82,
    categories: ["Retail"],
    date: "2025-05-04",
    source: "Metaverse Commerce Report",
    url: "https://example.com/article6"
  },
  {
    id: "7",
    title: "AI-Powered Credit Scoring Opens Financial Access",
    summary: [
      "Alternative data models extending credit to 27% more applicants",
      "Machine learning reducing default rates by 31% despite broader approval",
      "Real-time credit decisions increasing loan application completion by 58%"
    ],
    trendingScore: 79,
    categories: ["BFSI"],
    date: "2025-05-03",
    source: "Financial Inclusion Review",
    url: "https://example.com/article7"
  },
  {
    id: "8",
    title: "Digital Fitting Rooms Transform Physical Retail",
    summary: [
      "AR fitting technology reducing in-store try-on time by 62%",
      "Smart mirrors increasing accessory attachment sales by 41%",
      "Customer data collection improving future inventory decisions"
    ],
    trendingScore: 76,
    categories: ["Retail"],
    date: "2025-05-01",
    source: "Future Store Magazine",
    url: "https://example.com/article8"
  },
  {
    id: "9",
    title: "AI-Driven Diagnostics Reducing Hospital Wait Times by 47%",
    summary: [
      "Machine learning algorithms identifying critical cases 8 minutes faster on average",
      "Remote monitoring technology decreasing readmission rates by 36%",
      "Predictive analytics helping optimize staff scheduling during peak hours"
    ],
    trendingScore: 91,
    categories: ["Healthcare"],
    date: "2025-05-02",
    source: "Medical Innovation Today",
    url: "https://example.com/article9"
  },
  {
    id: "10",
    title: "Telehealth Adoption Soars Among Senior Patients",
    summary: [
      "65+ demographic showing 78% increase in telehealth appointment bookings",
      "Virtual care satisfaction rates reaching 87% among geriatric patients",
      "Insurance companies expanding remote visit coverage by 41%"
    ],
    trendingScore: 84,
    categories: ["Healthcare"],
    date: "2025-05-04",
    source: "Digital Health Weekly",
    url: "https://example.com/article10"
  },
  {
    id: "11",
    title: "Electronic Health Records: The Next Generation",
    summary: [
      "Blockchain-secured patient records reducing data breaches by 89%",
      "Interoperability improvements allowing 65% faster specialist consultations",
      "Voice-activated documentation saving clinicians 1.2 hours per day"
    ],
    trendingScore: 76,
    categories: ["Healthcare", "Tech"],
    date: "2025-05-01",
    source: "Healthcare Technology Review",
    url: "https://example.com/article11"
  },
  {
    id: "12",
    title: "Quantum Computing Breakthrough for Drug Discovery",
    summary: [
      "New quantum algorithms reducing molecular simulation time from years to days",
      "Pharmaceutical R&D costs projected to decrease by 32% with new technology",
      "First quantum-discovered drug candidate entering clinical trials next quarter"
    ],
    trendingScore: 95,
    categories: ["Healthcare", "Tech"],
    date: "2025-05-03",
    source: "Quantum Science Today",
    url: "https://example.com/article12"
  },
  {
    id: "13",
    title: "Tech Giants Competing for AI Chip Dominance",
    summary: [
      "New neural processing units showing 4.3x performance gains over previous generation",
      "Edge AI capabilities enabling 78% reduction in cloud computing dependencies",
      "Specialized ML hardware market projected to reach $67B by 2026"
    ],
    trendingScore: 93,
    categories: ["Tech"],
    date: "2025-05-02",
    source: "Silicon Trends",
    url: "https://example.com/article13"
  },
  {
    id: "14",
    title: "Open Source LLMs Transforming Enterprise Software Development",
    summary: [
      "Code generation tools increasing developer productivity by 41%",
      "Self-documenting systems reducing onboarding time for new team members",
      "Security vulnerability detection improving by 63% with AI code review"
    ],
    trendingScore: 87,
    categories: ["Tech"],
    date: "2025-05-04",
    source: "Developer Insights",
    url: "https://example.com/article14"
  },
  {
    id: "15",
    title: "Sustainable Data Centers: The Green Computing Revolution",
    summary: [
      "Liquid cooling technologies reducing energy consumption by 52%",
      "Carbon-neutral server farms becoming standard for 73% of Fortune 500 companies",
      "AI-optimized workload scheduling cutting peak power demands by 38%"
    ],
    trendingScore: 82,
    categories: ["Tech"],
    date: "2025-05-01",
    source: "Green Tech Review",
    url: "https://example.com/article15"
  },
  {
    id: "16",
    title: "Zero-Trust Architecture: The New Security Standard",
    summary: [
      "Organizations adopting zero-trust frameworks reporting 76% fewer breaches",
      "Continuous authentication methods replacing traditional password systems",
      "Identity-based security perimeters replacing network-based approaches"
    ],
    trendingScore: 89,
    categories: ["Tech"],
    date: "2025-05-03",
    source: "Cybersecurity Intelligence",
    url: "https://example.com/article16"
  }
];

// Transform backend data to frontend format
const transformArticle = (apiArticle: ApiArticle): Article => {
  // Split summary into bullet points if it contains them, otherwise create a single item array
  const summaryPoints = apiArticle.summary.includes("•") 
    ? apiArticle.summary.split("•").filter(s => s.trim().length > 0)
    : [apiArticle.summary];
  
  return {
    id: apiArticle.id.toString(),
    title: apiArticle.title,
    summary: summaryPoints,
    trendingScore: apiArticle.relevance_score || 0,
    categories: [apiArticle.industry], // Convert single industry to categories array
    date: apiArticle.published_at || new Date().toISOString().split('T')[0],
    source: apiArticle.source ? apiArticle.source.name : "Unknown Source",
    url: apiArticle.url,
    keywords: apiArticle.keywords
  };
};

// Track last fetch time
let lastFetchTime = 0;
let cachedArticles: Article[] = [];

export const getArticles = async (filters: string[] = []): Promise<Article[]> => {
  try {
    console.log("Fetching articles from API with filters:", filters);
    
    // Build query params for filters
    const queryParams = new URLSearchParams();
    
    if (filters.length > 0) {
      // Only take the first filter as the backend only supports one industry filter
      const industry = filters[0];
      queryParams.append('industry', industry.toLowerCase());
    }
    
    // Use the correct API endpoint path
    const endpoint = `/api/v1/articles${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    
    console.log(`Trying endpoint: ${API_BASE_URL}${endpoint}`);
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    
    if (!response.ok) {
      console.log(`Endpoint ${endpoint} returned ${response.status}`);
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("API response:", data);
    
    lastFetchTime = Date.now();
    
    // The backend returns an array of articles directly
    const articles = data.map(transformArticle);
    console.log("Transformed articles:", articles);
    cachedArticles = articles;
    
    return articles;
  } catch (error) {
    console.error("Error fetching articles:", error);
    
    // Fallback to cached data if available, then mock data
    if (cachedArticles.length > 0) {
      console.log("Using cached articles");
      return cachedArticles.filter(article => 
        filters.length === 0 || article.categories.some(category => filters.includes(category))
      );
    }
    
    console.log("Using mock articles");
    return mockArticles.filter(article => 
      filters.length === 0 || article.categories.some(category => filters.includes(category))
    );
  }
};

// Check for new articles without changing current view
export const checkForNewArticles = async (): Promise<boolean> => {
  try {
    if (lastFetchTime === 0) return false;
    
    // Try with the correct endpoint
    const endpoint = `/api/v1/articles?since=${lastFetchTime}`;
    
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      
      if (!response.ok) {
        console.log(`Update check endpoint ${endpoint} returned ${response.status}`);
        return false;
      }
      
      const data = await response.json();
      // If there are any articles with a published_at date after our last fetch, 
      // we consider that as having updates
      return data.some((article: ApiArticle) => {
        if (!article.published_at) return false;
        const articleDate = new Date(article.published_at).getTime();
        return articleDate > lastFetchTime;
      });
    } catch (e) {
      console.error(`Error checking for updates with endpoint ${endpoint}:`, e);
      return false;
    }
  } catch (error) {
    console.error("Error checking for updates:", error);
    return false;
  }
};

// Get last fetch time
export const getLastFetchTime = (): number => {
  return lastFetchTime;
};

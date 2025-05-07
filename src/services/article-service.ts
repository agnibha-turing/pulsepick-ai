
export interface Article {
  id: string;
  title: string;
  summary: string[];
  trendingScore: number;
  categories: string[];
  date: string;
  source: string;
  url: string;
}

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
  }
];

export const getArticles = async (filters: string[] = []): Promise<Article[]> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  if (filters.length === 0) {
    return mockArticles;
  }
  
  return mockArticles.filter(article => 
    article.categories.some(category => filters.includes(category))
  );
};

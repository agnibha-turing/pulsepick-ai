import { DisplayArticle } from "./article-service";
import { Persona } from "@/components/persona-input-card";

const API_URL = import.meta.env.VITE_API_URL || "/api";

export interface MessageGenerationRequest {
  articles: DisplayArticle[];
  persona?: Persona | null;
  platform: "email" | "linkedin" | "twitter" | "slack";
  regenerate?: boolean;
}

export interface MessageGenerationResponse {
  message: string;
  cached: boolean;
}

/**
 * Generate a personalized message based on selected articles and persona
 * for a specific platform.
 */
export async function generateMessage(request: MessageGenerationRequest): Promise<string> {
  try {
    const response = await fetch(`${API_URL}/messages/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        articles: request.articles,
        persona: request.persona || null,
        platform: request.platform,
        regenerate: request.regenerate || false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to generate message");
    }

    const data: MessageGenerationResponse = await response.json();
    return data.message;
  } catch (error) {
    console.error("Error generating message:", error);
    
    // Return a fallback message in case of an error
    return generateFallbackMessage(request);
  }
}

/**
 * Generate a basic fallback message when the API call fails
 */
function generateFallbackMessage(request: MessageGenerationRequest): string {
  const { articles, persona, platform } = request;
  
  let message = "";
  
  switch (platform) {
    case "email":
      message = `Subject: Sharing some interesting articles\n\nHi${persona?.recipientName ? ' ' + persona.recipientName : ''},\n\nI wanted to share these articles that might interest you:\n\n`;
      articles.forEach((article, index) => {
        message += `${index + 1}. ${article.title}\n`;
        message += `   You can read the full article here: ${article.url}\n\n`;
      });
      message += "\nBest regards,";
      break;
      
    case "linkedin":
      message = `I wanted to share some valuable insights`;
      if (articles.length === 1) {
        message += ` about "${articles[0].title}" that I think could benefit professionals in our industry.`;
        message += `\n\nRead more here:\n${articles[0].url}`;
      } else {
        message += ` that I think could benefit professionals in our industry.`;
        
        message += `\n\nRead more:`;
        // Add each URL on its own line
        articles.forEach((article) => {
          message += `\n${article.url}`;
        });
      }
      message += `\n\n#ProfessionalInsights #IndustryTrends #AI`;
      break;
      
    case "twitter":
      if (articles.length === 1) {
        message = `Check out this insight: "${articles[0].title.substring(0, 60)}..."`;
        message += `\n\n${articles[0].url}`;
      } else {
        // For multiple articles, create a more general message with all URLs
        message = `Key industry insights to explore:`;
        
        // Add each URL on its own line with double line breaks between
        articles.forEach((article) => {
          message += `\n\n${article.url}`;
        });
      }
      message += `\n\n#AI #IndustryInsights #Tech`;
      break;
      
    case "slack":
      message = `*Here are some articles that might interest you:*\n\n`;
      articles.forEach((article, index) => {
        // Proper Slack link format
        message += `${index + 1}. <${article.url}|${article.title}>\n`;
      });
      break;
      
    default:
      message = `Here are some articles I thought you might find interesting:\n\n`;
      articles.forEach((article, index) => {
        message += `${index + 1}. ${article.title}\n`;
        message += `   Read more: ${article.url}\n\n`;
      });
  }
  
  return message;
} 
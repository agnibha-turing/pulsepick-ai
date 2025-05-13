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
      });
      message += "\nBest regards,";
      break;
      
    case "linkedin":
      message = `I wanted to share some valuable insights`;
      if (articles.length > 0) {
        message += ` about "${articles[0].title}"`;
      }
      message += `. #ProfessionalInsights`;
      break;
      
    case "twitter":
      message = `Check out this interesting insight`;
      if (articles.length > 0) {
        message += `: "${articles[0].title.substring(0, 100)}"`;
      }
      break;
      
    case "slack":
      message = `*Here are some articles that might interest you:*\n`;
      articles.forEach((article, index) => {
        message += `>${index + 1}. ${article.title}\n`;
      });
      break;
      
    default:
      message = `Here are some articles I thought you might find interesting:\n`;
      articles.forEach((article, index) => {
        message += `${index + 1}. ${article.title}\n`;
      });
  }
  
  return message;
} 
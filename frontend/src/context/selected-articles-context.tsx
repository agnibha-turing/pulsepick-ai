import React, { createContext, useState, useContext, ReactNode } from 'react';
import { DisplayArticle } from '@/services/article-service';

interface SelectedArticlesContextType {
  selectedArticles: DisplayArticle[];
  toggleArticleSelection: (article: DisplayArticle) => void;
  isArticleSelected: (articleId: string) => boolean;
  clearSelectedArticles: () => void;
  selectedCount: number;
}

const SelectedArticlesContext = createContext<SelectedArticlesContextType | undefined>(undefined);

export function SelectedArticlesProvider({ children }: { children: ReactNode }) {
  const [selectedArticles, setSelectedArticles] = useState<DisplayArticle[]>([]);

  const toggleArticleSelection = (article: DisplayArticle) => {
    setSelectedArticles(prev => {
      // Check if article is already selected
      const isSelected = prev.some(a => a.id === article.id);
      
      if (isSelected) {
        // Remove article if already selected
        return prev.filter(a => a.id !== article.id);
      } else {
        // Add article if not selected
        return [...prev, article];
      }
    });
  };

  const isArticleSelected = (articleId: string) => {
    return selectedArticles.some(article => article.id === articleId);
  };

  const clearSelectedArticles = () => {
    setSelectedArticles([]);
  };

  const value = {
    selectedArticles,
    toggleArticleSelection,
    isArticleSelected,
    clearSelectedArticles,
    selectedCount: selectedArticles.length
  };

  return (
    <SelectedArticlesContext.Provider value={value}>
      {children}
    </SelectedArticlesContext.Provider>
  );
}

export function useSelectedArticles() {
  const context = useContext(SelectedArticlesContext);
  if (context === undefined) {
    throw new Error('useSelectedArticles must be used within a SelectedArticlesProvider');
  }
  return context;
} 
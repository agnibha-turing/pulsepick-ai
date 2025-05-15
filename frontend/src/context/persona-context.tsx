import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { Persona } from '@/components/persona-input-card';
import axios from 'axios';

interface PersonaContextType {
  activePersona: Persona | null;
  setActivePersona: (persona: Persona | null) => void;
  isPersonaActive: boolean;
  savedPersonas: Persona[];
  savePersona: (persona: Persona) => void;
  updatePersona: (oldPersona: Persona, updatedPersona: Persona) => void;
  removePersona: (persona: Persona) => void;
  isLoading: boolean;
  error: string | null;
}

// Local storage key for personas
const SAVED_PERSONAS_KEY = 'pulsepick-saved-personas';
// API endpoints
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const PERSONAS_ENDPOINT = `${API_URL}/personas`;

const PersonaContext = createContext<PersonaContextType | undefined>(undefined);

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [activePersona, setActivePersona] = useState<Persona | null>(null);
  const [savedPersonas, setSavedPersonas] = useState<Persona[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Function to save personas to localStorage
  const persistPersonasToLocalStorage = (personas: Persona[]) => {
    try {
      localStorage.setItem(SAVED_PERSONAS_KEY, JSON.stringify(personas));
    } catch (error) {
      console.error('Failed to save personas to localStorage:', error);
    }
  };

  // Load saved personas from API and localStorage on initial render
  useEffect(() => {
    const loadSavedPersonas = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Load from API first
        const response = await axios.get(PERSONAS_ENDPOINT);
        if (response.data) {
          setSavedPersonas(response.data);
          // Also update localStorage for offline access
          persistPersonasToLocalStorage(response.data);
        }
      } catch (error) {
        console.error('Failed to load personas from API, falling back to localStorage:', error);
        
        // Fall back to localStorage if API fails
        try {
          const storedPersonas = localStorage.getItem(SAVED_PERSONAS_KEY);
          if (storedPersonas) {
            setSavedPersonas(JSON.parse(storedPersonas));
          }
        } catch (localError) {
          console.error('Failed to load saved personas from localStorage:', localError);
          setError('Failed to load saved personas.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadSavedPersonas();
  }, []);

  // Save a new persona
  const savePersona = async (persona: Persona) => {
    // Don't save duplicates (identified by name, company and job title)
    const isDuplicate = savedPersonas.some(
      p => p.recipientName === persona.recipientName && 
           p.company === persona.company &&
           p.jobTitle === persona.jobTitle
    );

    if (!isDuplicate) {
      setIsLoading(true);
      setError(null);
      
      try {
        // Save to API
        await axios.post(PERSONAS_ENDPOINT, persona);
        
        // Update local state and localStorage
        const newPersonas = [...savedPersonas, persona];
        setSavedPersonas(newPersonas);
        persistPersonasToLocalStorage(newPersonas);
      } catch (error) {
        console.error('Failed to save persona to API:', error);
        setError('Failed to save persona. Please try again.');
        
        // Still update localStorage as fallback
        const newPersonas = [...savedPersonas, persona];
        setSavedPersonas(newPersonas);
        persistPersonasToLocalStorage(newPersonas);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Update an existing persona
  const updatePersona = async (oldPersona: Persona, updatedPersona: Persona) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Update in API
      await axios.put(PERSONAS_ENDPOINT, {
        old_persona: oldPersona,
        updated_persona: updatedPersona
      });
      
      // Update local state
      const index = savedPersonas.findIndex(
        p => p.recipientName === oldPersona.recipientName && 
             p.company === oldPersona.company &&
             p.jobTitle === oldPersona.jobTitle
      );

      if (index >= 0) {
        const newPersonas = [...savedPersonas];
        newPersonas[index] = updatedPersona;
        setSavedPersonas(newPersonas);
        persistPersonasToLocalStorage(newPersonas);

        // If the updated persona was active, update activePersona too
        if (activePersona && 
            activePersona.recipientName === oldPersona.recipientName &&
            activePersona.company === oldPersona.company &&
            activePersona.jobTitle === oldPersona.jobTitle) {
          setActivePersona(updatedPersona);
        }
      }
    } catch (error) {
      console.error('Failed to update persona in API:', error);
      setError('Failed to update persona. Please try again.');
      
      // Still update localStorage as fallback
      const index = savedPersonas.findIndex(
        p => p.recipientName === oldPersona.recipientName && 
             p.company === oldPersona.company &&
             p.jobTitle === oldPersona.jobTitle
      );

      if (index >= 0) {
        const newPersonas = [...savedPersonas];
        newPersonas[index] = updatedPersona;
        setSavedPersonas(newPersonas);
        persistPersonasToLocalStorage(newPersonas);

        // If the updated persona was active, update activePersona too
        if (activePersona && 
            activePersona.recipientName === oldPersona.recipientName &&
            activePersona.company === oldPersona.company &&
            activePersona.jobTitle === oldPersona.jobTitle) {
          setActivePersona(updatedPersona);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Remove a persona
  const removePersona = async (persona: Persona) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Remove from API
      await axios.delete(PERSONAS_ENDPOINT, { data: persona });
      
      // Update local state
      const newPersonas = savedPersonas.filter(
        p => !(p.recipientName === persona.recipientName && 
               p.company === persona.company &&
               p.jobTitle === persona.jobTitle)
      );

      setSavedPersonas(newPersonas);
      persistPersonasToLocalStorage(newPersonas);

      // If the removed persona was active, clear activePersona
      if (activePersona && 
          activePersona.recipientName === persona.recipientName &&
          activePersona.company === persona.company &&
          activePersona.jobTitle === persona.jobTitle) {
        setActivePersona(null);
      }
    } catch (error) {
      console.error('Failed to remove persona from API:', error);
      setError('Failed to remove persona. Please try again.');
      
      // Still update localStorage as fallback
      const newPersonas = savedPersonas.filter(
        p => !(p.recipientName === persona.recipientName && 
               p.company === persona.company &&
               p.jobTitle === persona.jobTitle)
      );

      setSavedPersonas(newPersonas);
      persistPersonasToLocalStorage(newPersonas);

      // If the removed persona was active, clear activePersona
      if (activePersona && 
          activePersona.recipientName === persona.recipientName &&
          activePersona.company === persona.company &&
          activePersona.jobTitle === persona.jobTitle) {
        setActivePersona(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    activePersona,
    setActivePersona,
    isPersonaActive: activePersona !== null,
    savedPersonas,
    savePersona,
    updatePersona,
    removePersona,
    isLoading,
    error
  };

  return (
    <PersonaContext.Provider value={value}>
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersona() {
  const context = useContext(PersonaContext);
  if (context === undefined) {
    throw new Error('usePersona must be used within a PersonaProvider');
  }
  return context;
} 
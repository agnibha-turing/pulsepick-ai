import React, { createContext, useState, useContext, ReactNode } from 'react';
import { Persona } from '@/components/persona-input-card';

interface PersonaContextType {
  activePersona: Persona | null;
  setActivePersona: (persona: Persona | null) => void;
  isPersonaActive: boolean;
}

const PersonaContext = createContext<PersonaContextType | undefined>(undefined);

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [activePersona, setActivePersona] = useState<Persona | null>(null);

  const value = {
    activePersona,
    setActivePersona,
    isPersonaActive: activePersona !== null,
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
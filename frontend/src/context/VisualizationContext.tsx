import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { VisualizationStateModel } from "../types/visualization";

const VisualizationContext = createContext<VisualizationStateModel | null>(null);

type VisualizationProviderProps = {
  value: VisualizationStateModel;
  children: ReactNode;
};

export function VisualizationProvider({ value, children }: VisualizationProviderProps) {
  return <VisualizationContext.Provider value={value}>{children}</VisualizationContext.Provider>;
}

export function useVisualizationState(): VisualizationStateModel {
  const context = useContext(VisualizationContext);
  if (!context) {
    throw new Error("useVisualizationState must be used within VisualizationProvider");
  }
  return context;
}

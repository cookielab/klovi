import type React from "react";
import { useFontSize } from "../../hooks/useFontSize.ts";
import { useTheme } from "../../hooks/useTheme.ts";

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  // These hooks apply data-theme and --font-size-base to the document
  useTheme();
  useFontSize();

  return <>{children}</>;
}

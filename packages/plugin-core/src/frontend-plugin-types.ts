export type FrontendSummaryExtractor = (input: Record<string, unknown>) => string;
export type FrontendInputFormatter = (input: Record<string, unknown>) => string;

export interface FrontendPlugin {
  id: string;
  displayName: string;
  summaryExtractors: Record<string, FrontendSummaryExtractor>;
  inputFormatters: Record<string, FrontendInputFormatter>;
  getResumeCommand?(sessionId: string): string | null;
}

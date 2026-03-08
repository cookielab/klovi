export type ThemeSetting = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export type TurnRole = "user" | "assistant" | "agent" | "sub-agent" | "system" | "error";

export type BadgeVariant =
  | "user"
  | "assistant"
  | "agent"
  | "sub-agent"
  | "tool"
  | "system"
  | "error"
  | "plan"
  | "implementation"
  | "default";

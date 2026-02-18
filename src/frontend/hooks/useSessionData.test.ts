import { describe, expect, test } from "bun:test";
import { buildSessionUrl, buildSubAgentSessionUrl } from "./useSessionData.ts";

describe("useSessionData URL builders", () => {
  test("buildSessionUrl encodes sessionId and project", () => {
    const url = buildSessionUrl("claude-code::abc/123", "-Users-dev project");
    expect(url).toBe("/api/sessions/claude-code%3A%3Aabc%2F123?project=-Users-dev%20project");
  });

  test("buildSubAgentSessionUrl encodes sessionId, project, and agentId", () => {
    const url = buildSubAgentSessionUrl(
      "claude-code::abc/123",
      "-Users-dev project",
      "agent/42",
    );
    expect(url).toBe(
      "/api/sessions/claude-code%3A%3Aabc%2F123/subagents/agent%2F42?project=-Users-dev%20project",
    );
  });
});

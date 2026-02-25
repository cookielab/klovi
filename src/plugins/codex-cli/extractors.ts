import { truncate } from "../shared/text-utils.ts";

export const codexSummaryExtractors: Record<string, (input: Record<string, unknown>) => string> = {
  command_execution: (i) => truncate(String(i["command"] || ""), 80),
  file_change: (i) => {
    const changes = i["changes"];
    if (Array.isArray(changes) && changes.length > 0) {
      return String((changes[0] as Record<string, unknown>)["path"] || "");
    }
    return "";
  },
  web_search: (i) => truncate(String(i["query"] || ""), 60),
};

export const codexInputFormatters: Record<string, (input: Record<string, unknown>) => string> = {
  command_execution: (i) => String(i["command"] || ""),
  file_change: (i) => {
    const changes = i["changes"];
    if (Array.isArray(changes)) {
      return (changes as Record<string, unknown>[])
        .map((c) => `${c["kind"] || "change"}: ${c["path"] || ""}`)
        .join("\n");
    }
    return JSON.stringify(i, null, 2);
  },
  web_search: (i) => `Query: ${String(i["query"] || "")}`,
};

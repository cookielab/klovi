import { describe, expect, test } from "bun:test";
import { handleRPC, type RPCContext, RPCError } from "./rpc.ts";

const mockCtx: RPCContext = {
  registry: {} as RPCContext["registry"],
  settingsPath: "/tmp/test-settings.json",
};

describe("handleRPC", () => {
  test("returns result for known method", async () => {
    const result = await handleRPC("getVersion", mockCtx, {});
    expect(result).toHaveProperty("version");
    expect(result).toHaveProperty("commit");
  });

  test("throws RPCError for unknown method", () => {
    expect(() => handleRPC("nonexistent", mockCtx, {})).toThrow(RPCError);
  });

  test("acceptRisks returns ok", async () => {
    const result = await handleRPC("acceptRisks", mockCtx, {});
    expect(result).toEqual({ ok: true });
  });
});

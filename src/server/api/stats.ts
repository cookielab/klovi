import { scanStats } from "../../parser/stats.ts";

export async function handleStats(): Promise<Response> {
  const stats = await scanStats();
  return Response.json({ stats });
}

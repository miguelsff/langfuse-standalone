import type { NextApiRequest, NextApiResponse } from "next";
import { resolveMockProcedure } from "@/src/mock-data/service";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const procedurePath = typeof req.query.path === "string" ? req.query.path : "";
  if (!procedurePath) return res.status(400).json({ error: "Missing mock procedure path" });

  try {
    const input = typeof req.body === "object" && req.body ? (req.body as { input?: unknown }).input : undefined;
    return res.status(200).json({ data: resolveMockProcedure(procedurePath, input) });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Mock data error" });
  }
}

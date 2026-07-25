import fs from "node:fs";
import path from "node:path";
import type { NextApiRequest, NextApiResponse } from "next";
import { getDatabase } from "@/server/db";
import { getEnv } from "@/server/env";

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).end();
  }
  const id = typeof request.query.id === "string" ? request.query.id : "";
  const database = await getDatabase();
  const media = await database.media.findUnique({ where: { id } });
  if (!media) return response.status(404).end();

  const mediaDirectory = path.resolve(getEnv().MEDIA_DATA_DIR);
  const absolutePath = path.resolve(mediaDirectory, media.filePath);
  if (!absolutePath.startsWith(`${mediaDirectory}${path.sep}`)) {
    return response.status(400).end();
  }
  try {
    await fs.promises.access(absolutePath);
  } catch {
    return response.status(404).end();
  }

  const downloadName = media.fileName.replace(/["\r\n]/g, "_");
  response.setHeader("Content-Type", media.mimeType);
  response.setHeader("Content-Length", media.size);
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${downloadName}"`,
  );
  return fs.createReadStream(absolutePath).pipe(response);
}

import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { getDatabase } from "@/server/db";
import { getEnv } from "@/server/env";

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
const targetTypes = new Set(["TRACE", "OBSERVATION", "SESSION"]);

const safeFileName = (value: string) =>
  path.basename(value).replace(/[^\w.\- ()]/g, "_").slice(0, 240) || "file";

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const targetType =
    typeof request.query.targetType === "string"
      ? request.query.targetType
      : "";
  const targetId =
    typeof request.query.targetId === "string" ? request.query.targetId : "";
  if (!targetTypes.has(targetType) || !targetId) {
    return response.status(400).json({ error: "Invalid media target" });
  }

  const declaredSize = Number(request.headers["content-length"] ?? 0);
  if (declaredSize > MAX_MEDIA_BYTES) {
    return response.status(413).json({ error: "File exceeds 25 MB" });
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_MEDIA_BYTES) {
      return response.status(413).json({ error: "File exceeds 25 MB" });
    }
    chunks.push(buffer);
  }
  if (size === 0) {
    return response.status(400).json({ error: "File is empty" });
  }

  const originalName = safeFileName(
    typeof request.headers["x-file-name"] === "string"
      ? decodeURIComponent(request.headers["x-file-name"])
      : "file",
  );
  const extension = path.extname(originalName).slice(0, 16);
  const storedName = `${randomUUID()}${extension}`;
  const mediaDirectory = getEnv().MEDIA_DATA_DIR;
  const absolutePath = path.resolve(mediaDirectory, storedName);
  if (!absolutePath.startsWith(`${path.resolve(mediaDirectory)}${path.sep}`)) {
    return response.status(400).json({ error: "Invalid file path" });
  }

  await fs.mkdir(mediaDirectory, { recursive: true });
  await fs.writeFile(absolutePath, Buffer.concat(chunks));
  const database = await getDatabase();
  const media = await database.media.create({
    data: {
      projectId: "local",
      targetType,
      targetId,
      fileName: originalName,
      mimeType:
        typeof request.headers["content-type"] === "string"
          ? request.headers["content-type"].slice(0, 200)
          : "application/octet-stream",
      filePath: storedName,
      size,
    },
  });
  return response.status(201).json({ id: media.id });
}

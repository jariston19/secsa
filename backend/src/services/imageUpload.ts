import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";

const MAX_WIDTH = 800;
const JPEG_QUALITY = 80;

export function hashImageBuffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function optimizeQuestionImage(buffer: Buffer) {
  const optimized = await sharp(buffer)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  return {
    buffer: optimized,
    imageHash: hashImageBuffer(optimized),
  };
}

export async function saveOptimizedImage(
  buffer: Buffer,
  uploadDir: string
): Promise<{ filename: string; imageHash: string }> {
  await mkdir(uploadDir, { recursive: true });

  const { buffer: optimized, imageHash } = await optimizeQuestionImage(buffer);
  const filename = `${randomUUID()}.jpg`;
  const outputPath = path.join(uploadDir, filename);

  await writeFile(outputPath, optimized);
  return { filename, imageHash };
}

export async function hashImageFile(filePath: string) {
  try {
    const buffer = await readFile(filePath);
    return hashImageBuffer(buffer);
  } catch {
    return null;
  }
}

export async function resolveQuestionImageHash(
  question: { imageHash: string | null; imagePath: string | null },
  uploadDir: string
) {
  if (question.imageHash) return question.imageHash;
  if (!question.imagePath) return null;
  return hashImageFile(path.join(uploadDir, question.imagePath));
}

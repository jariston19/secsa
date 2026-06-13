import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { randomUUID } from "crypto";

const MAX_WIDTH = 800;
const JPEG_QUALITY = 80;

export async function saveOptimizedImage(
  buffer: Buffer,
  uploadDir: string
): Promise<string> {
  await mkdir(uploadDir, { recursive: true });

  const filename = `${randomUUID()}.jpg`;
  const outputPath = path.join(uploadDir, filename);

  const optimized = await sharp(buffer)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  await writeFile(outputPath, optimized);
  return filename;
}

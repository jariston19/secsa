import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const uploadDir = path.resolve(
  process.env.UPLOAD_DIR || path.join(__dirname, "../../uploads")
);

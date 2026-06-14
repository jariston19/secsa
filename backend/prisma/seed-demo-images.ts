import { access, mkdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const uploadDir =
  process.env.UPLOAD_DIR ||
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../uploads");

const DEMO_IMAGE_SVGS: Record<string, string> = {
  "cell-diagram": `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
    <rect width="640" height="400" fill="#f8fafc"/>
    <rect x="40" y="40" width="560" height="320" rx="24" fill="#e0f2fe" stroke="#0284c7" stroke-width="3"/>
    <ellipse cx="320" cy="200" rx="110" ry="90" fill="#fef3c7" stroke="#d97706" stroke-width="3"/>
    <text x="320" y="205" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#92400e">B</text>
    <circle cx="180" cy="150" r="28" fill="#dcfce7" stroke="#16a34a" stroke-width="2"/>
    <text x="180" y="156" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#166534">A</text>
    <circle cx="460" cy="250" r="22" fill="#fee2e2" stroke="#dc2626" stroke-width="2"/>
    <text x="460" y="256" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#991b1b">C</text>
    <circle cx="250" cy="290" r="18" fill="#ede9fe" stroke="#7c3aed" stroke-width="2"/>
    <text x="250" y="295" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#5b21b6">D</text>
    <text x="320" y="372" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#334155">Animal cell diagram (demo)</text>
  </svg>`,
  "bar-chart": `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
    <rect width="640" height="400" fill="#ffffff"/>
    <line x1="80" y1="320" x2="560" y2="320" stroke="#64748b" stroke-width="2"/>
    <line x1="80" y1="80" x2="80" y2="320" stroke="#64748b" stroke-width="2"/>
    <rect x="130" y="210" width="70" height="110" fill="#93c5fd"/>
    <rect x="250" y="120" width="70" height="200" fill="#3b82f6"/>
    <rect x="370" y="250" width="70" height="70" fill="#93c5fd"/>
    <rect x="490" y="180" width="70" height="140" fill="#60a5fa"/>
    <text x="165" y="345" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#334155">A</text>
    <text x="285" y="345" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#334155">B</text>
    <text x="405" y="345" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#334155">C</text>
    <text x="525" y="345" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#334155">D</text>
    <text x="320" y="48" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#0f172a">Survey results (demo)</text>
  </svg>`,
  "force-diagram": `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
    <rect width="640" height="400" fill="#f8fafc"/>
    <rect x="250" y="150" width="140" height="90" rx="12" fill="#cbd5e1" stroke="#475569" stroke-width="2"/>
    <text x="320" y="205" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#0f172a">Block</text>
    <line x1="120" y1="195" x2="250" y2="195" stroke="#dc2626" stroke-width="4" marker-end="url(#arrow)"/>
    <text x="170" y="180" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#dc2626">10 N</text>
    <line x1="390" y1="195" x2="520" y2="195" stroke="#2563eb" stroke-width="4" marker-end="url(#arrow)"/>
    <text x="470" y="180" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#2563eb">4 N</text>
    <defs>
      <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
        <path d="M0,0 L8,3 L0,6 Z" fill="currentColor"/>
      </marker>
    </defs>
    <text x="320" y="360" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#334155">Horizontal forces on a block (demo)</text>
  </svg>`,
  "unit-circle": `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
    <rect width="640" height="400" fill="#ffffff"/>
    <circle cx="320" cy="210" r="120" fill="none" stroke="#0f172a" stroke-width="3"/>
    <line x1="200" y1="210" x2="440" y2="210" stroke="#94a3b8" stroke-width="2"/>
    <line x1="320" y1="90" x2="320" y2="330" stroke="#94a3b8" stroke-width="2"/>
    <line x1="320" y1="210" x2="404" y2="124" stroke="#2563eb" stroke-width="4"/>
    <circle cx="404" cy="124" r="8" fill="#2563eb"/>
    <text x="418" y="128" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#1d4ed8">θ</text>
    <text x="360" y="250" font-family="Arial, sans-serif" font-size="16" fill="#334155">r = 1</text>
    <text x="320" y="360" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#334155">Unit circle (demo)</text>
  </svg>`,
  "timeline": `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
    <rect width="640" height="400" fill="#fffbeb"/>
    <line x1="80" y1="210" x2="560" y2="210" stroke="#92400e" stroke-width="4"/>
    <circle cx="160" cy="210" r="14" fill="#f59e0b" stroke="#92400e" stroke-width="2"/>
    <circle cx="320" cy="210" r="14" fill="#f59e0b" stroke="#92400e" stroke-width="2"/>
    <circle cx="480" cy="210" r="14" fill="#f59e0b" stroke="#92400e" stroke-width="2"/>
    <text x="160" y="170" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#78350f">1898</text>
    <text x="320" y="170" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#78350f">1946</text>
    <text x="480" y="170" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#78350f">1986</text>
    <text x="160" y="250" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#451a03">Independence</text>
    <text x="320" y="250" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#451a03">Republic</text>
    <text x="480" y="250" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#451a03">EDSA I</text>
    <text x="320" y="48" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#78350f">Philippine history timeline (demo)</text>
  </svg>`,
  "ph-scale": `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
    <rect width="640" height="400" fill="#ffffff"/>
    <rect x="120" y="150" width="400" height="40" fill="url(#grad)"/>
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#ef4444"/>
        <stop offset="50%" stop-color="#22c55e"/>
        <stop offset="100%" stop-color="#3b82f6"/>
      </linearGradient>
    </defs>
    <text x="140" y="220" font-family="Arial, sans-serif" font-size="16" fill="#334155">0</text>
    <text x="300" y="220" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#334155">7</text>
    <text x="490" y="220" font-family="Arial, sans-serif" font-size="16" fill="#334155">14</text>
    <circle cx="220" cy="170" r="10" fill="#ffffff" stroke="#0f172a" stroke-width="2"/>
    <text x="220" y="120" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#b91c1c">Sample X</text>
    <text x="320" y="48" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#0f172a">pH scale (demo)</text>
  </svg>`,
};

export async function ensureDemoImage(imageKey: string): Promise<string> {
  const svg = DEMO_IMAGE_SVGS[imageKey];
  if (!svg) {
    throw new Error(`Unknown demo image key: ${imageKey}`);
  }

  const filename = `demo-${imageKey}.jpg`;
  const outputPath = path.join(uploadDir, filename);

  try {
    await access(outputPath);
    return filename;
  } catch {
    await mkdir(uploadDir, { recursive: true });
    const buffer = await sharp(Buffer.from(svg)).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    await writeFile(outputPath, buffer);
    return filename;
  }
}

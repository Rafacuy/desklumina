import { t } from "../utils";
import { accessSync, constants, readdirSync, statSync } from "fs";
import { extname, join } from "path";

const MESSAGES = [
  "ui.loader.thinking",
  "ui.loader.galaxy",
  "ui.loader.intelligence",
  "ui.loader.traces",
  "ui.loader.neurons",
  "ui.loader.quantum",
  "ui.loader.muscles",
  "ui.loader.cosmos",
  "ui.loader.wisdom",
  "ui.loader.brain",
];
const LOADER_IMAGE_EXTENSIONS = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);

let loaderInterval: Timer | null = null;
let currentIndex = 0;

export const LOADER_ASSET_DIR = `${process.env.HOME}/.config/desklumina/assets/loader`;

export function randomLoader(): string {
  return t(MESSAGES[Math.floor(Math.random() * MESSAGES.length)]!);
}

export function randomLoaderImage(assetDir: string = LOADER_ASSET_DIR): string | null {
  try {
    const images = readdirSync(assetDir)
      .map((file) => join(assetDir, file))
      .filter((file) => {
        try {
          if (!LOADER_IMAGE_EXTENSIONS.has(extname(file).toLowerCase())) {
            return false;
          }

          const stat = statSync(file);
          accessSync(file, constants.R_OK);
          return stat.isFile();
        } catch {
          return false;
        }
      });

    if (images.length === 0) {
      return null;
    }

    return images[Math.floor(Math.random() * images.length)] ?? null;
  } catch {
    return null;
  }
}

export function startLoader() {
  currentIndex = 0;
  process.stdout.write(t(MESSAGES[currentIndex] || ""));
  
  loaderInterval = setInterval(() => {
    currentIndex = (currentIndex + 1) % MESSAGES.length;
    process.stdout.write(`\r${t(MESSAGES[currentIndex] || "")}`);
  }, 1200);
}

export function stopLoader() {
  if (loaderInterval) {
    clearInterval(loaderInterval);
    loaderInterval = null;
    process.stdout.write("\r" + " ".repeat(80) + "\r");
  }
}

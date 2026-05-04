import { t } from "../utils";

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

let loaderInterval: Timer | null = null;
let currentIndex = 0;

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

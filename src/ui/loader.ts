const MESSAGES = [
  "🧠 Lumina is thinking hard...",
  "🌀 Consulting the galaxy...",
  "☕ Loading my intelligence, please wait...",
  "🔮 Reading system traces...",
  "🚀 Launching neurons into space...",
  "🎲 Rolling quantum dice for an answer...",
  "🦾 Flexing my flexible muscles, hold on...",
  "🌌 Wrapping the cosmos to find your file...",
  "🐱 cat /dev/wisdom | grep answer...",
  "💫 sudo pacman -S brain...",
];

let loaderInterval: Timer | null = null;
let currentIndex = 0;

export function startLoader() {
  currentIndex = 0;
  process.stdout.write(MESSAGES[currentIndex] ?? "");
  
  loaderInterval = setInterval(() => {
    currentIndex = (currentIndex + 1) % MESSAGES.length;
    process.stdout.write(`\r${MESSAGES[currentIndex]}`);
  }, 1200);
}

export function stopLoader() {
  if (loaderInterval) {
    clearInterval(loaderInterval);
    loaderInterval = null;
    process.stdout.write("\r" + " ".repeat(80) + "\r");
  }
}

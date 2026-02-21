const MESSAGES = [
  "🧠 Lumina sedang mikir keras nih...",
  "🌀 Lagi konsultasi ke galaksi...",
  "☕ Memuat kepintaranku, tunggu yaa...",
  "🔮 Membaca jejak-jejak sistem...",
  "🚀 Meluncurkan neuron ke angkasa...",
  "🎲 Mengacak dadu kuantum untuk jawaban...",
  "🦾 Mamerin otot fleksibelku, tunggu...",
  "🌌 Membungkus angkasa untuk mencari filemu...",
  "🐱 cat /dev/wisdom | grep answer...",
  "💫 sudo pacman -S brain...",
];

let loaderInterval: Timer | null = null;
let currentIndex = 0;

export function startLoader() {
  currentIndex = 0;
  console.log(MESSAGES[currentIndex]);
  
  loaderInterval = setInterval(() => {
    currentIndex = (currentIndex + 1) % MESSAGES.length;
    console.log(MESSAGES[currentIndex]);
  }, 1200);
}

export function stopLoader() {
  if (loaderInterval) {
    clearInterval(loaderInterval);
    loaderInterval = null;
  }
}

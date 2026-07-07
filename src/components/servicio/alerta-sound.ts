// Alertas al mesero: mensaje hablado (voz) + beep corto informativo.
// El aviso de "una mesa te necesita" se reproduce por voz (Web Speech API),
// pensado para que el mesero use un audífono. Se repite espaciado (~1/min)
// hasta que confirme la alerta. Se conserva `beepListo` para el aviso corto
// de "pedido listo".

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  return ctx;
}

function synth(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis ?? null;
}

/** Prepara la voz dentro de un gesto del usuario (iOS/móvil lo exige). */
function primeSpeech() {
  const s = synth();
  if (!s) return;
  try {
    // Utterance mudo: "desbloquea" speechSynthesis sin emitir sonido audible.
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    s.speak(u);
  } catch {
    // ignorar
  }
}

/**
 * Desbloquea el audio dentro de un gesto: reanuda el AudioContext (para el beep)
 * y prepara la voz. Devuelve true si el AudioContext quedó activo.
 */
export async function unlockAudio(): Promise<boolean> {
  primeSpeech();
  const c = getCtx();
  if (!c) return false;
  try {
    if (c.state !== "running") await c.resume();
    return c.state === "running";
  } catch {
    return false;
  }
}

export function isAudioUnlocked(): boolean {
  return !!ctx && ctx.state === "running";
}

// Beep corto informativo (p. ej. "pedido listo")
export function beepListo() {
  const c = getCtx();
  if (!c) return;
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, c.currentTime);
    osc.frequency.setValueAtTime(1320, c.currentTime + 0.12);
    gain.gain.setValueAtTime(0.001, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, c.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.35);
    osc.start();
    osc.stop(c.currentTime + 0.36);
  } catch {
    // silencio
  }
}

// ---- Alertas por voz -------------------------------------------------------

/** Elige una voz en español si el navegador expone alguna. */
function pickSpanishVoice(): SpeechSynthesisVoice | null {
  const s = synth();
  if (!s) return null;
  try {
    const voices = s.getVoices();
    return voices.find((v) => v.lang?.toLowerCase().startsWith("es")) ?? null;
  } catch {
    return null;
  }
}

function speakMessages(msgs: string[]) {
  const s = synth();
  if (!s || msgs.length === 0) return;
  try {
    // Evita acumular cola / solapamiento entre repeticiones.
    s.cancel();
    const voice = pickSpanishVoice();
    for (const m of msgs) {
      const u = new SpeechSynthesisUtterance(m);
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? "es-ES";
      u.rate = 1;
      u.pitch = 1;
      s.speak(u);
    }
  } catch {
    // silencio
  }
}

// Intervalo de repetición: espaciado para no saturar (el usuario pidió ~1/min).
const VOICE_REPEAT_MS = 60_000;

let voiceTimer: number | null = null;
let voiceGetMessages: (() => string[]) | null = null;

/**
 * Anuncia por voz las alertas activas de inmediato y las repite cada ~1 min
 * hasta llamar a `stopVoiceAlerts`. `getMessages` se vuelve a consultar en cada
 * repetición, así el mensaje refleja las alertas vigentes en ese momento.
 */
export function startVoiceAlerts(getMessages: () => string[]) {
  voiceGetMessages = getMessages;
  // Si no hay soporte de voz, degradar a un beep corto único.
  if (!synth()) {
    beepListo();
    return;
  }
  speakMessages(getMessages());
  if (voiceTimer != null) return;
  voiceTimer = window.setInterval(() => {
    if (voiceGetMessages) speakMessages(voiceGetMessages());
  }, VOICE_REPEAT_MS);
}

export function stopVoiceAlerts() {
  if (voiceTimer != null) {
    window.clearInterval(voiceTimer);
    voiceTimer = null;
  }
  voiceGetMessages = null;
  try {
    synth()?.cancel();
  } catch {
    // ignorar
  }
}

// Alertas sonoras: beep corto + alarma persistente en loop.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  return ctx;
}

export async function unlockAudio(): Promise<boolean> {
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

// Beep corto informativo
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

// Alarma persistente
type AlarmNodes = {
  osc: OscillatorNode;
  gain: GainNode;
  interval: number;
  vibInterval: number;
};

let alarm: AlarmNodes | null = null;

export function startAlarm() {
  if (alarm) return;
  const c = getCtx();
  if (!c) return;
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "square";
    osc.connect(gain);
    gain.connect(c.destination);
    osc.frequency.setValueAtTime(880, c.currentTime);
    gain.gain.setValueAtTime(0.0001, c.currentTime);
    osc.start();

    // Patrón cíclico: dos tonos alternos, cada 350ms, gain alto
    let hi = true;
    const tick = () => {
      const now = c.currentTime;
      osc.frequency.setValueAtTime(hi ? 1320 : 880, now);
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.6, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      hi = !hi;
    };
    tick();
    const interval = window.setInterval(tick, 350);

    // Vibración móvil
    const vibrate = () => {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate([600, 200, 600, 200, 600]);
        } catch {
          // ignorar
        }
      }
    };
    vibrate();
    const vibInterval = window.setInterval(vibrate, 2200);

    alarm = { osc, gain, interval, vibInterval };
  } catch {
    // silencio
  }
}

export function stopAlarm() {
  if (!alarm) return;
  try {
    window.clearInterval(alarm.interval);
    window.clearInterval(alarm.vibInterval);
    alarm.osc.stop();
    alarm.osc.disconnect();
    alarm.gain.disconnect();
  } catch {
    // ignorar
  }
  alarm = null;
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(0);
    } catch {
      // ignorar
    }
  }
}

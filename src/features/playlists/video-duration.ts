export function videoDurationSeconds(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("No se pudo leer la duración del video.");
  return Math.ceil(duration);
}

export function loadVideoDuration(url: string, signal: AbortSignal): Promise<number> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error("Lectura cancelada.")); return; }
    const video = document.createElement("video");
    const finish = (error?: Error) => {
      let duration = 0;
      if (!error) {
        try { duration = videoDurationSeconds(video.duration); }
        catch { error = new Error("No se pudo leer la duración del video. Vuelve a seleccionarlo para reintentar."); }
      }
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      if (error) reject(error); else resolve(duration);
    };
    const abort = () => finish(new Error("Lectura cancelada."));
    const timeout = setTimeout(() => finish(new Error("No se pudo leer la duración del video. Vuelve a seleccionarlo para reintentar.")), 20000);
    video.preload = "metadata";
    video.onloadedmetadata = () => finish();
    video.onerror = () => finish(new Error("No se pudo leer la duración del video. Vuelve a seleccionarlo para reintentar."));
    signal.addEventListener("abort", abort, { once: true });
    video.src = url;
    video.load();
  });
}

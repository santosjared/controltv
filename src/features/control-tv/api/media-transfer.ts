type UploadMediaOptions = {
  file: File;
  tvId: string;
  signal?: AbortSignal;
  onProgress: (progress: number) => void;
};

function getErrorMessage(xhr: XMLHttpRequest): string {
  try {
    const body = JSON.parse(xhr.responseText) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(" ");
    if (body.message) return body.message;
  } catch {
    // La respuesta puede no ser JSON.
  }
  return `El backend respondió HTTP ${xhr.status}.`;
}

export function uploadMediaToTv({ file, tvId, signal, onProgress }: UploadMediaOptions): Promise<unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) return Promise.reject(new Error("Falta NEXT_PUBLIC_API_BASE_URL en .env."));

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    xhr.open("POST", `${baseUrl.replace(/\/$/, "")}/tvs/${encodeURIComponent(tvId)}/transferencias`);
    xhr.setRequestHeader("Accept", "application/json");

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener("load", () => {
      signal?.removeEventListener("abort", abort);
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        try {
          resolve(xhr.responseText ? JSON.parse(xhr.responseText) : null);
        } catch {
          resolve(xhr.responseText);
        }
        return;
      }
      reject(new Error(getErrorMessage(xhr)));
    });
    xhr.addEventListener("error", () => {
      signal?.removeEventListener("abort", abort);
      reject(new Error("No se pudo conectar con el backend para transferir el archivo."));
    });
    xhr.addEventListener("abort", () => {
      signal?.removeEventListener("abort", abort);
      reject(new DOMException("Transferencia cancelada", "AbortError"));
    });

    if (signal?.aborted) {
      reject(new DOMException("Transferencia cancelada", "AbortError"));
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });

    const formData = new FormData();
    formData.append("file", file, file.name);
    xhr.send(formData);
  });
}

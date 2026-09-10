export const MAX_MEDIA_FILE_SIZE = 100 * 1024 * 1024;
export const MEDIA_FILE_ACCEPT = "image/*,video/*";


export type MediaFileKind = "IMAGE" | "VIDEO";

const imageExtension = /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)$/i;
const videoExtension = /\.(avi|m4v|mkv|mov|mp4|mpeg|mpg|webm)$/i;

export function getMediaFileKind(file: File): MediaFileKind | null {
  if (file.type.startsWith("image/") || (!file.type && imageExtension.test(file.name))) return "IMAGE";
  if (file.type.startsWith("video/") || (!file.type && videoExtension.test(file.name))) return "VIDEO";
  return null;
}

export function validateMediaFile(file: File): { kind: MediaFileKind } | { error: string } {
  const kind = getMediaFileKind(file);
  if (!kind) return { error: "Solo se permiten archivos de imagen o video." };
  if (file.size > MAX_MEDIA_FILE_SIZE) return { error: "El archivo supera el tamaño máximo de 100 MB." };
  return { kind };
}

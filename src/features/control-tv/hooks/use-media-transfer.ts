"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { uploadMediaToTv, uploadMediaToTvs } from "../api/media-transfer";
import { validateMediaFile, type MediaFileKind } from "../utils/media-file";

export function useMediaTransfer() {
  const [progress, setProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const transfer = useCallback(async (file: File, tvId: string): Promise<MediaFileKind | null> => {
    const validation = validateMediaFile(file);
    if ("error" in validation) {
      setError(validation.error);
      setProgress(null);
      setIsUploading(false);
      setIsComplete(false);
      return null;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setProgress(0);
    setIsUploading(true);
    setIsComplete(false);

    try {
      await uploadMediaToTv({ file, tvId, signal: controller.signal, onProgress: setProgress });
      if (controller.signal.aborted) return null;
      setProgress(100);
      setIsComplete(true);
      return validation.kind;
    } catch (cause) {
      if (controller.signal.aborted) return null;
      setError(cause instanceof Error ? cause.message : "No se pudo transferir el archivo.");
      setProgress(null);
      return null;
    } finally {
      if (!controller.signal.aborted) setIsUploading(false);
    }
  }, []);

  const transferToMany = useCallback(async (file: File, tvIds: string[]): Promise<MediaFileKind | null> => {
    const validation = validateMediaFile(file);
    if ("error" in validation) {
      setError(validation.error);
      setProgress(null);
      setIsUploading(false);
      setIsComplete(false);
      return null;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setProgress(0);
    setIsUploading(true);
    setIsComplete(false);

    try {
      await uploadMediaToTvs({ file, tvIds, signal: controller.signal, onProgress: setProgress });
      if (controller.signal.aborted) return null;
      setProgress(100);
      setIsComplete(true);
      return validation.kind;
    } catch (cause) {
      if (controller.signal.aborted) return null;
      setError(cause instanceof Error ? cause.message : "No se pudo transferir el archivo.");
      setProgress(null);
      return null;
    } finally {
      if (!controller.signal.aborted) setIsUploading(false);
    }
  }, []);

  const resetTransfer = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setProgress(null);
    setIsUploading(false);
    setIsComplete(false);
    setError(null);
  }, []);

  return { transfer, transferToMany, resetTransfer, progress, isUploading, isComplete, error };
}

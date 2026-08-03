"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CloseIcon,
  formatDuration,
  getCoupleInitials,
  ImageIcon,
  VideoIcon,
} from "@/app/functions/functions";
import {
  CameraFacing,
  CapturedMedia,
  GalleryFilter,
  PublishedItem,
} from "@/app/types/types";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

const RECENT_REFRESH_MS = 15000;
const MAX_VIDEO_UPLOAD_BYTES = 40_000_000;
const MAX_IMAGE_UPLOAD_BYTES = 12_000_000;
const MAX_REQUEST_UPLOAD_BYTES = 40_000_000;
const IMAGE_TARGET_MAX_WIDTH = 2400;
const IMAGE_TARGET_QUALITY = 0.9;
const IMAGE_MIN_QUALITY = 0.78;
const MAX_VIDEO_SECONDS_HARD_LIMIT = 15;

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "33lo3roy";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
const apiVersion = "2026-07-23";
const directUploadToken = process.env.NEXT_PUBLIC_SANITY_UPLOAD_TOKEN;

type UploadAssetResult = {
  _id: string;
  url?: string;
};

export function GuestBooth({
  guestPath,
  dashboardPath,
  eventSlug,
  title,
  coupleNames,
  backgroundImageUrl,
}: {
  guestPath: string;
  dashboardPath: string;
  eventSlug: string;
  title: string;
  coupleNames: string;
  backgroundImageUrl?: string;
}) {
  const nativePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const nativeVideoInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraFacing] = useState<CameraFacing>("user");
  const [captureLabel, setCaptureLabel] = useState("Ready to capture");
  const [guestName, setGuestName] = useState("");
  const [caption, setCaption] = useState("");
  const [capturedMedia, setCapturedMedia] = useState<CapturedMedia | null>(
    null,
  );
  const [publishedItems, setPublishedItems] = useState<PublishedItem[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(() =>
    Boolean(eventSlug),
  );
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStage, setPublishStage] = useState<
    "idle" | "uploading" | "publishing"
  >("idle");
  const [uploadProgressPercent, setUploadProgressPercent] = useState(0);
  const [uploadEtaSeconds, setUploadEtaSeconds] = useState<number | null>(null);
  const [isPreparingVideo, setIsPreparingVideo] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [galleryFilter, setGalleryFilter] = useState<GalleryFilter>("all");
  const [activeViewerIndex, setActiveViewerIndex] = useState<number | null>(
    null,
  );
  const [showIntroOverlay, setShowIntroOverlay] = useState(true);
  const [introOverlayExiting, setIntroOverlayExiting] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [viewerVideoFailedId, setViewerVideoFailedId] = useState<string | null>(
    null,
  );
  const touchStartXRef = useRef<number | null>(null);

  const filteredPublishedItems =
    galleryFilter === "all"
      ? publishedItems
      : publishedItems.filter((item) => item.kind === galleryFilter);
  const photoCount = publishedItems.filter(
    (item) => item.kind === "photo",
  ).length;
  const videoCount = publishedItems.filter(
    (item) => item.kind === "video",
  ).length;
  const effectiveMaxVideoSeconds = MAX_VIDEO_SECONDS_HARD_LIMIT;
  const coupleInitials = getCoupleInitials(coupleNames);

  function getTooLargeUploadMessage(kind: "photo" | "video") {
    if (kind === "video") {
      return "Video je prevelik za slanje. Maksimalna velicina je 40 MB.";
    }

    return "Fotka je prevelika za slanje. Pokusaj manju rezoluciju ili udalji kadar.";
  }

  function getUploadSizeLimitBytes(kind: "photo" | "video") {
    const mediaLimit =
      kind === "video" ? MAX_VIDEO_UPLOAD_BYTES : MAX_IMAGE_UPLOAD_BYTES;

    return Math.min(mediaLimit, MAX_REQUEST_UPLOAD_BYTES);
  }

  function formatDirectUploadError(
    error: unknown,
    mediaFile: File,
    kind: "photo" | "video",
  ) {
    const rawMessage =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unknown upload error.";
    const normalized = rawMessage.toLowerCase();

    if (
      normalized.includes("request error while attempting to reach") ||
      normalized.includes("failed to fetch") ||
      normalized.includes("networkerror") ||
      normalized.includes("network request failed") ||
      normalized.includes("load failed")
    ) {
      return `Upload nije uspio zbog mreze ili CORS pravila. Provjeri da je origin dopusten u Sanity CORS-u i da uredaj nema VPN/adblock/private DNS. Detalj: ${rawMessage}`;
    }

    if (normalized.includes("cors")) {
      return `CORS blokira upload za ovaj uredaj/origin. Dodaj tacan URL aplikacije u Sanity Manage > API > CORS Origins. Detalj: ${rawMessage}`;
    }

    if (
      normalized.includes("unauthorized") ||
      normalized.includes("forbidden") ||
      normalized.includes("permission") ||
      normalized.includes("token")
    ) {
      return `Upload token nema potrebna prava za assets upload. Provjeri NEXT_PUBLIC_SANITY_UPLOAD_TOKEN dozvole. Detalj: ${rawMessage}`;
    }

    if (
      normalized.includes("payload too large") ||
      normalized.includes("entity too large") ||
      normalized.includes("413")
    ) {
      return kind === "video"
        ? "Video je prevelik za upload (server/network limit). Pokusaj kraci klip ili manju rezoluciju."
        : "Slika je prevelika za upload (server/network limit).";
    }

    return `Upload nije uspio. Tip: ${mediaFile.type || "unknown"}, velicina: ${Math.round(mediaFile.size / 1024 / 1024)} MB. Detalj: ${rawMessage}`;
  }

  async function extractSubmissionError(response: Response) {
    const responseContentType = response.headers.get("content-type") ?? "";

    if (responseContentType.includes("application/json")) {
      const parsed = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      return parsed.error ?? "Submission API returned an error.";
    }

    const text = (await response.text()).trim();
    return text || "Submission API returned non-JSON error.";
  }

  const loadRecentPublished = useCallback(
    async (showLoading = true) => {
      if (!eventSlug) return;

      if (showLoading) {
        setIsLoadingRecent(true);
      }

      try {
        const response = await fetch(
          `/api/guest-submissions?eventSlug=${encodeURIComponent(eventSlug)}`,
          { method: "GET", cache: "no-store" },
        );

        const result = (await response.json()) as {
          ok: boolean;
          error?: string;
          recent?: Array<{
            _id: string;
            _createdAt: string;
            mediaKind?: "image" | "video";
            durationSeconds?: number;
            status?: string;
            guestName?: string;
            caption?: string;
            image?: { asset?: { url?: string } };
            video?: { asset?: { url?: string } };
          }>;
        };

        if (!response.ok || !result.ok) {
          throw new Error(result.error ?? "Failed to load recent submissions.");
        }

        const items: PublishedItem[] = (result.recent ?? [])
          .map<PublishedItem>((entry) => ({
            id: entry._id,
            kind: entry.mediaKind === "video" ? "video" : "photo",
            url: entry.video?.asset?.url ?? entry.image?.asset?.url ?? "",
            durationSeconds:
              typeof entry.durationSeconds === "number"
                ? Number(entry.durationSeconds.toFixed(1))
                : undefined,
            guestName: entry.guestName,
            caption: entry.caption,
          }))
          .filter((entry) => Boolean(entry.url));

        setPublishedItems(items);
      } catch {
        setPublishedItems([]);
      } finally {
        setIsLoadingRecent(false);
      }
    },
    [eventSlug],
  );

  useEffect(() => {
    let cancelled = false;

    if (!eventSlug) return;

    void (async () => {
      try {
        const response = await fetch(
          `/api/guest-submissions?eventSlug=${encodeURIComponent(eventSlug)}`,
          { method: "GET", cache: "no-store" },
        );

        const result = (await response.json()) as {
          ok: boolean;
          error?: string;
          recent?: Array<{
            _id: string;
            _createdAt: string;
            mediaKind?: "image" | "video";
            durationSeconds?: number;
            status?: string;
            guestName?: string;
            caption?: string;
            image?: { asset?: { url?: string } };
            video?: { asset?: { url?: string } };
          }>;
        };

        if (!response.ok || !result.ok) {
          throw new Error(result.error ?? "Failed to load recent submissions.");
        }

        const items: PublishedItem[] = (result.recent ?? [])
          .map<PublishedItem>((entry) => ({
            id: entry._id,
            kind: entry.mediaKind === "video" ? "video" : "photo",
            url: entry.video?.asset?.url ?? entry.image?.asset?.url ?? "",
            durationSeconds:
              typeof entry.durationSeconds === "number"
                ? Number(entry.durationSeconds.toFixed(1))
                : undefined,
            guestName: entry.guestName,
            caption: entry.caption,
          }))
          .filter((entry) => Boolean(entry.url));

        if (!cancelled) {
          setPublishedItems(items);
        }
      } catch {
        if (!cancelled) {
          setPublishedItems([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingRecent(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventSlug]);

  useEffect(() => {
    if (typeof window === "undefined" || !eventSlug) return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void loadRecentPublished(false);
    }, RECENT_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [eventSlug, loadRecentPublished]);

  useEffect(() => {
    if (activeViewerIndex === null || filteredPublishedItems.length === 0) {
      return;
    }

    const itemsCount = filteredPublishedItems.length;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveViewerIndex(null);
        return;
      }

      if (event.key === "ArrowLeft") {
        setActiveViewerIndex((current) => {
          if (current === null || itemsCount === 0) {
            return current;
          }

          const normalizedCurrent =
            ((current % itemsCount) + itemsCount) % itemsCount;
          return normalizedCurrent === 0
            ? itemsCount - 1
            : normalizedCurrent - 1;
        });
      }

      if (event.key === "ArrowRight") {
        setActiveViewerIndex((current) => {
          if (current === null || itemsCount === 0) {
            return current;
          }

          const normalizedCurrent =
            ((current % itemsCount) + itemsCount) % itemsCount;
          return normalizedCurrent === itemsCount - 1
            ? 0
            : normalizedCurrent + 1;
        });
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeViewerIndex, filteredPublishedItems]);

  useEffect(() => {
    return () => {
      if (capturedMedia?.previewUrl) {
        URL.revokeObjectURL(capturedMedia.previewUrl);
      }
    };
  }, [capturedMedia]);

  useEffect(() => {
    const startExitTimeout = window.setTimeout(() => {
      setIntroOverlayExiting(true);
    }, 2200);

    const hideTimeout = window.setTimeout(() => {
      setShowIntroOverlay(false);
    }, 3000);

    return () => {
      window.clearTimeout(startExitTimeout);
      window.clearTimeout(hideTimeout);
    };
  }, []);

  useEffect(() => {
    if (!publishSuccess) return;

    const timeoutId = window.setTimeout(() => {
      setPublishSuccess(null);
    }, 3500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [publishSuccess]);

  function formatEta(seconds: number | null) {
    if (!seconds || seconds < 1) {
      return "< 1s";
    }

    const safeSeconds = Math.max(1, Math.round(seconds));
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;

    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }

    return `${secs}s`;
  }

  async function uploadAssetWithProgress(
    file: File,
    kind: "photo" | "video",
  ): Promise<UploadAssetResult> {
    if (!directUploadToken) {
      throw new Error(
        "Missing NEXT_PUBLIC_SANITY_UPLOAD_TOKEN. Add it to frontend/app/.env.local and restart Next.js.",
      );
    }

    const endpointKind = kind === "video" ? "files" : "images";
    const fileName = encodeURIComponent(file.name || `upload-${Date.now()}`);
    const uploadUrl = `https://${projectId}.api.sanity.io/v${apiVersion}/assets/${endpointKind}/${dataset}?filename=${fileName}`;

    return await new Promise<UploadAssetResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const startedAt = Date.now();

      xhr.open("POST", uploadUrl);
      xhr.responseType = "json";
      xhr.setRequestHeader("Authorization", `Bearer ${directUploadToken}`);
      xhr.setRequestHeader(
        "Content-Type",
        file.type || (kind === "video" ? "video/webm" : "image/webp"),
      );

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || event.total <= 0) {
          return;
        }

        const percent = Math.min(
          100,
          Math.max(1, Math.round((event.loaded / event.total) * 100)),
        );
        setUploadProgressPercent(percent);

        const elapsedSeconds = (Date.now() - startedAt) / 1000;
        const bytesPerSecond =
          elapsedSeconds > 0 ? event.loaded / elapsedSeconds : 0;
        if (bytesPerSecond > 0) {
          const remainingBytes = Math.max(0, event.total - event.loaded);
          setUploadEtaSeconds(remainingBytes / bytesPerSecond);
        }
      };

      xhr.onerror = () => {
        reject(new Error("Network error while uploading asset."));
      };

      xhr.onabort = () => {
        reject(new Error("Upload was aborted."));
      };

      xhr.onload = () => {
        const isOk = xhr.status >= 200 && xhr.status < 300;
        if (!isOk) {
          const responseText =
            typeof xhr.responseText === "string" ? xhr.responseText : "";
          reject(
            new Error(
              `Upload failed (${xhr.status}). ${responseText || "No response body."}`,
            ),
          );
          return;
        }

        const payload =
          xhr.response && typeof xhr.response === "object"
            ? xhr.response
            : typeof xhr.responseText === "string" && xhr.responseText
              ? JSON.parse(xhr.responseText)
              : null;

        const documentValue =
          payload && typeof payload === "object" && "document" in payload
            ? (payload.document as UploadAssetResult)
            : (payload as UploadAssetResult | null);

        if (!documentValue?._id) {
          reject(new Error("Upload succeeded but asset id is missing."));
          return;
        }

        resolve(documentValue);
      };

      xhr.send(file);
    });
  }

  async function publishCurrent() {
    if (!capturedMedia) return;

    if (
      capturedMedia.kind === "video" &&
      typeof capturedMedia.durationSeconds === "number" &&
      capturedMedia.durationSeconds > effectiveMaxVideoSeconds
    ) {
      setPublishError(
        `Video moze trajati maksimalno ${effectiveMaxVideoSeconds} sekundi.`,
      );
      return;
    }

    if (capturedMedia.file.size > getUploadSizeLimitBytes(capturedMedia.kind)) {
      setPublishError(getTooLargeUploadMessage(capturedMedia.kind));
      return;
    }

    setIsPublishing(true);
    setPublishStage("uploading");
    setUploadProgressPercent(0);
    setUploadEtaSeconds(null);
    setPublishError(null);
    setPublishSuccess(null);

    try {
      let uploadedAsset;

      try {
        uploadedAsset = await uploadAssetWithProgress(
          capturedMedia.file,
          capturedMedia.kind,
        );
        setUploadProgressPercent(100);
        setUploadEtaSeconds(0);
      } catch (uploadError) {
        throw new Error(
          formatDirectUploadError(
            uploadError,
            capturedMedia.file,
            capturedMedia.kind,
          ),
        );
      }

      setPublishStage("publishing");

      const response = await fetch("/api/guest-submissions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          eventSlug,
          mediaKind: capturedMedia.kind === "video" ? "video" : "image",
          guestName: guestName.trim(),
          caption: caption.trim(),
          durationSeconds: capturedMedia.durationSeconds ?? 0,
          fileSizeBytes: capturedMedia.file.size,
          assetId: uploadedAsset._id,
          assetUrl: uploadedAsset.url,
        }),
      });

      let result: {
        ok: boolean;
        error?: string;
        submissionId?: string;
        assetUrl?: string;
        status?: string;
      } | null = null;

      if (!response.ok) {
        const submissionError = await extractSubmissionError(response);
        const normalized = submissionError.toLowerCase();

        if (
          response.status === 413 ||
          normalized.includes("entity too large") ||
          normalized.includes("payload too large")
        ) {
          throw new Error(
            "Submission je odbijen jer je payload prevelik. Provjeri velicinu i duzinu videa.",
          );
        }

        if (response.status === 403) {
          throw new Error(
            `Submission odbijen (403). Moguce da su uploadi ugaseni u dashboardu. Detalj: ${submissionError}`,
          );
        }

        if (response.status === 404) {
          throw new Error(
            `Wedding event nije pronadjen za ovaj slug. Detalj: ${submissionError}`,
          );
        }

        throw new Error(
          `Submission API error (${response.status}). Detalj: ${submissionError}`,
        );
      }

      result = (await response.json()) as {
        ok: boolean;
        error?: string;
        submissionId?: string;
        assetUrl?: string;
        status?: string;
      };

      if (!result.ok) {
        throw new Error(result.error ?? "Failed to publish submission.");
      }

      const nextItem: PublishedItem = {
        id: result.submissionId ?? `${Date.now()}`,
        kind: capturedMedia.kind,
        url: result.assetUrl ?? uploadedAsset.url ?? capturedMedia.previewUrl,
        durationSeconds:
          capturedMedia.kind === "video"
            ? capturedMedia.durationSeconds
            : undefined,
        guestName: guestName.trim() || undefined,
        caption: caption.trim() || undefined,
      };

      setPublishedItems((current) => [nextItem, ...current]);
      void loadRecentPublished(false);

      setCaptureLabel("Published to wedding gallery queue");
      setPublishSuccess(
        capturedMedia.kind === "video"
          ? "Video je uspjesno objavljen."
          : "Slika je uspjesno objavljena.",
      );
      setCapturedMedia((current) => {
        if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
        return null;
      });
      setIsPreviewLoading(false);
    } catch (error) {
      setPublishError(
        error instanceof Error
          ? error.message
          : "Failed to publish submission.",
      );
      setCaptureLabel("Publish failed");
    } finally {
      setPublishStage("idle");
      setIsPublishing(false);
      setUploadEtaSeconds(null);
    }
  }

  function resetCapture() {
    setCapturedMedia((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
    setIsPreviewLoading(false);
    setPublishError(null);
    setCaptureLabel("Ready to capture");
  }

  function deleteCapture() {
    resetCapture();
    setCaptureLabel("Capture deleted");
  }

  const activeViewerItem =
    activeViewerIndex !== null && filteredPublishedItems[activeViewerIndex]
      ? filteredPublishedItems[activeViewerIndex]
      : null;

  function openViewerAtIndex(index: number) {
    setViewerVideoFailedId(null);
    setActiveViewerIndex(index);
  }

  function goToPreviousInViewer() {
    setViewerVideoFailedId(null);
    setActiveViewerIndex((current) => {
      const itemsCount = filteredPublishedItems.length;

      if (current === null || itemsCount === 0) {
        return current;
      }

      const normalizedCurrent =
        ((current % itemsCount) + itemsCount) % itemsCount;
      return normalizedCurrent === 0 ? itemsCount - 1 : normalizedCurrent - 1;
    });
  }

  function goToNextInViewer() {
    setViewerVideoFailedId(null);
    setActiveViewerIndex((current) => {
      const itemsCount = filteredPublishedItems.length;

      if (current === null || itemsCount === 0) {
        return current;
      }

      const normalizedCurrent =
        ((current % itemsCount) + itemsCount) % itemsCount;
      return normalizedCurrent === itemsCount - 1 ? 0 : normalizedCurrent + 1;
    });
  }

  function handleViewerTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  }

  function handleViewerTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    const startX = touchStartXRef.current;
    const endX = event.changedTouches[0]?.clientX;

    if (startX === null || endX === undefined) return;

    const deltaX = endX - startX;
    const swipeThreshold = 50;

    if (deltaX >= swipeThreshold) {
      goToPreviousInViewer();
    } else if (deltaX <= -swipeThreshold) {
      goToNextInViewer();
    }

    touchStartXRef.current = null;
  }

  function openNativePicker(input: HTMLInputElement | null) {
    if (!input) {
      setCaptureLabel("Camera input is not ready yet.");
      return;
    }

    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
        return;
      }
    } catch {
      // Fallback to click() for browsers that block showPicker().
    }

    input.click();
  }

  function triggerNativePhotoCapture() {
    openNativePicker(nativePhotoInputRef.current);
  }

  function triggerNativeVideoCapture() {
    openNativePicker(nativeVideoInputRef.current);
  }

  async function getVideoDurationFromFile(file: File) {
    const url = URL.createObjectURL(file);

    try {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = url;

      const duration = await new Promise<number | undefined>((resolve) => {
        video.onloadedmetadata = () => {
          const rawDuration = Number.isFinite(video.duration)
            ? video.duration
            : undefined;
          resolve(rawDuration ? Number(rawDuration.toFixed(1)) : undefined);
        };
        video.onerror = () => resolve(undefined);
      });

      return duration;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function compressImageForUpload(file: File, maxSizeBytes: number) {
    if (typeof window === "undefined") return file;
    if (!file.type.startsWith("image/")) return file;

    const sourceUrl = URL.createObjectURL(file);

    try {
      const image = document.createElement("img");
      image.decoding = "async";
      image.src = sourceUrl;

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Image load failed."));
      });

      const sourceWidth = image.naturalWidth || image.width;
      const sourceHeight = image.naturalHeight || image.height;
      if (!sourceWidth || !sourceHeight) return file;

      const scale = Math.min(1, IMAGE_TARGET_MAX_WIDTH / sourceWidth);
      const targetWidth = Math.max(320, Math.round(sourceWidth * scale));
      const targetHeight = Math.max(240, Math.round(sourceHeight * scale));

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const context = canvas.getContext("2d");
      if (!context) return file;

      context.drawImage(image, 0, 0, targetWidth, targetHeight);

      const qualitySteps = [
        IMAGE_TARGET_QUALITY,
        0.74,
        0.68,
        0.62,
        IMAGE_MIN_QUALITY,
      ];

      let bestBlob: Blob | null = null;

      for (const quality of qualitySteps) {
        const compressedBlob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, "image/webp", quality);
        });

        if (!compressedBlob || compressedBlob.type !== "image/webp") {
          continue;
        }

        if (!bestBlob || compressedBlob.size < bestBlob.size) {
          bestBlob = compressedBlob;
        }

        if (compressedBlob.size <= maxSizeBytes) {
          return new File(
            [compressedBlob],
            file.name.replace(/\.[^.]+$/, ".webp"),
            {
              type: "image/webp",
              lastModified: Date.now(),
            },
          );
        }
      }

      if (!bestBlob || !bestBlob.size || bestBlob.size >= file.size) {
        return file;
      }

      return new File([bestBlob], file.name.replace(/\.[^.]+$/, ".webp"), {
        type: "image/webp",
        lastModified: Date.now(),
      });
    } catch {
      return file;
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  async function handleNativeCaptureChange(
    kind: "photo" | "video",
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";

    if (!selectedFile) return;

    const isVideo = kind === "video";

    try {
      let uploadFile = selectedFile;
      const maxSizeForKind = getUploadSizeLimitBytes(kind);

      if (isVideo) {
        setCaptureLabel("Video preview ready");
      } else {
        setCaptureLabel("Preparing photo for upload...");

        if (selectedFile.size > maxSizeForKind) {
          uploadFile = await compressImageForUpload(
            selectedFile,
            maxSizeForKind,
          );
        }
      }

      const durationSeconds = isVideo
        ? await getVideoDurationFromFile(uploadFile)
        : undefined;

      if (
        isVideo &&
        typeof durationSeconds === "number" &&
        durationSeconds > effectiveMaxVideoSeconds
      ) {
        setCapturedMedia((current) => {
          if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
          return null;
        });
        setPublishError(
          `Video moze trajati maksimalno ${effectiveMaxVideoSeconds} sekundi.`,
        );
        setCaptureLabel("Video je predugacak");
        setIsPreviewLoading(false);
        return;
      }

      const previewUrl = URL.createObjectURL(uploadFile);
      setIsPreviewLoading(true);

      setCapturedMedia((current) => {
        if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
        return {
          kind,
          file: uploadFile,
          previewUrl,
          durationSeconds,
        };
      });

      if (uploadFile.size > maxSizeForKind) {
        setPublishError(getTooLargeUploadMessage(kind));
      } else {
        setPublishError(null);
      }

      setCaptureLabel(
        kind === "photo" ? "Photo preview ready" : "Video preview ready",
      );
    } finally {
      if (isVideo) {
        setIsPreparingVideo(false);
      }
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      {backgroundImageUrl ? (
        <Image
          src={backgroundImageUrl}
          alt={coupleNames}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.18),_transparent_35%),linear-gradient(135deg,_#6b1126,_#1f2937_50%,_#0b1020)]" />
      )}

      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(0,0,0,0.45)_0%,_rgba(0,0,0,0.55)_60%,_rgba(0,0,0,0.7)_100%)]" />

      {showIntroOverlay && (
        <div
          className={`fixed inset-0 z-[70] flex items-center justify-center bg-black/65 backdrop-blur-md transition-opacity duration-700 ${
            introOverlayExiting ? "opacity-0" : "opacity-100"
          }`}
          aria-hidden="true"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="intro-heartbeat text-8xl leading-none text-red-500 drop-shadow-[0_12px_36px_rgba(220,38,38,0.5)] sm:text-[7rem]">
              ♥
            </div>
            <p className="font-[family-name:var(--font-display)] text-4xl tracking-[0.2em] text-white sm:text-5xl">
              {coupleInitials}
            </p>
          </div>
        </div>
      )}

      {isPreparingVideo && !showIntroOverlay && (
        <div className="fixed inset-0 z-[68] flex items-center justify-center bg-black/45 backdrop-blur-sm">
          <div className="flex min-w-[280px] flex-col items-center gap-3 rounded-3xl border border-white/30 bg-white/85 px-8 py-6 text-center shadow-2xl">
            <span className="loading-spinner h-8 w-8 rounded-full border-4 border-rose-200 border-t-rose-500" />
            <p className="font-semibold text-stone-800">
              Pripremam video preview, molimo pričekajte...
            </p>
          </div>
        </div>
      )}

      {isPublishing && !showIntroOverlay && (
        <div className="fixed inset-0 z-[69] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="flex min-w-[280px] flex-col items-center gap-3 rounded-3xl border border-white/30 bg-white/88 px-8 py-6 text-center shadow-2xl">
            <span className="loading-spinner h-9 w-9 rounded-full border-4 border-rose-200 border-t-rose-500" />
            <p className="font-semibold text-stone-800">
              {publishStage === "uploading"
                ? "Uploadam fajl na server..."
                : "Zavrsavam objavu..."}
            </p>
            {publishStage === "uploading" && (
              <>
                <div className="h-2 w-56 overflow-hidden rounded-full bg-stone-200">
                  <div
                    className="h-full rounded-full bg-rose-500 transition-all duration-300"
                    style={{ width: `${uploadProgressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-stone-600">
                  {uploadProgressPercent}% · Preostalo ~
                  {formatEta(uploadEtaSeconds)}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {publishSuccess && !showIntroOverlay && (
        <div className="fixed right-4 top-4 z-[75] max-w-sm rounded-2xl border border-emerald-300/40 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100 shadow-xl backdrop-blur-md sm:right-6 sm:top-6">
          {publishSuccess}
        </div>
      )}

      <style jsx>{`
        .intro-heartbeat {
          animation: intro-heartbeat 1.15s ease-in-out infinite;
          transform-origin: center;
        }

        .loading-spinner {
          animation: spin 0.9s linear infinite;
        }

        @keyframes intro-heartbeat {
          0% {
            transform: scale(1);
          }
          14% {
            transform: scale(1.16);
          }
          28% {
            transform: scale(1);
          }
          42% {
            transform: scale(1.12);
          }
          70% {
            transform: scale(1);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-rose-300/30 blur-3xl" />
        <div className="absolute right-[-72px] top-24 h-96 w-96 rounded-full bg-amber-200/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-80 w-[42rem] -translate-x-1/2 rounded-full bg-black/40 blur-3xl" />
      </div>
      <input
        ref={nativePhotoInputRef}
        type="file"
        accept="image/*"
        capture={cameraFacing}
        className="sr-only"
        onChange={(event) => void handleNativeCaptureChange("photo", event)}
      />
      <input
        ref={nativeVideoInputRef}
        type="file"
        accept="video/*"
        capture={cameraFacing}
        className="sr-only"
        onChange={(event) => void handleNativeCaptureChange("video", event)}
      />
      <p className="sr-only" aria-live="polite">
        {captureLabel}
      </p>
      <p className="sr-only">
        Event title: {title}. Guest route: {guestPath}. Dashboard route:{" "}
        {dashboardPath}. Max video config: {effectiveMaxVideoSeconds}.
      </p>
      <section className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 sm:px-8">
        <div className="w-full max-w-4xl rounded-[2.25rem] px-6 py-10 text-center sm:px-10 sm:py-14">
          <h1 className="font-[family-name:var(--font-display)] text-5xl font-semibold tracking-[0.02em] text-white sm:text-7xl">
            {coupleNames}
          </h1>
          <p className="mt-4 text-sm font-semibold text-white/85 sm:text-base">
            {title}
          </p>

          <div className="mx-auto mt-10 grid max-w-xl grid-cols-2 gap-3 sm:gap-4">
            <button
              type="button"
              onClick={triggerNativePhotoCapture}
              className="rounded-full bg-rose-200 px-5 py-4 text-sm font-semibold text-rose-900 shadow-lg shadow-rose-300/30 transition hover:bg-rose-300 disabled:opacity-50"
              disabled={isPublishing || isPreparingVideo}
            >
              Slikaj
            </button>
            <button
              type="button"
              onClick={triggerNativeVideoCapture}
              className="rounded-full bg-white/15 px-5 py-4 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
              disabled={isPublishing || isPreparingVideo}
            >
              Snimi
            </button>
          </div>

          <div className="mt-5">
            <button
              type="button"
              onClick={() => setIsGalleryOpen(true)}
              className="rounded-full border border-white/35 bg-black/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-black/45"
            >
              Otvori galeriju slika
            </button>
          </div>

          {capturedMedia && (
            <div className="mx-auto mt-8 max-w-2xl rounded-3xl border border-white/20 bg-black/45 p-4 text-left backdrop-blur-md sm:p-5">
              <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-black/50">
                <div className="relative flex min-h-[240px] items-center justify-center p-2">
                  {capturedMedia.kind === "video" ? (
                    <video
                      src={capturedMedia.previewUrl}
                      controls
                      playsInline
                      onLoadedData={() => setIsPreviewLoading(false)}
                      onError={() => setIsPreviewLoading(false)}
                      className="max-h-[360px] w-full rounded-xl object-cover"
                    />
                  ) : (
                    <Image
                      src={capturedMedia.previewUrl}
                      alt="Captured preview"
                      width={1280}
                      height={720}
                      unoptimized
                      onLoad={() => setIsPreviewLoading(false)}
                      onError={() => setIsPreviewLoading(false)}
                      className="max-h-[360px] w-full rounded-xl object-cover"
                    />
                  )}

                  {isPreviewLoading && (
                    <div className="absolute inset-2 z-20 flex items-center justify-center rounded-xl bg-black/55">
                      <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/30 bg-black/55 px-4 py-3 text-center">
                        <span className="loading-spinner h-6 w-6 rounded-full border-4 border-rose-200 border-t-rose-500" />
                        <p className="text-xs font-semibold text-white">
                          Ucitavam preview...
                        </p>
                      </div>
                    </div>
                  )}

                  {capturedMedia.kind === "video" &&
                    typeof capturedMedia.durationSeconds === "number" && (
                      <span className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold tracking-wide text-white">
                        {formatDuration(capturedMedia.durationSeconds)}
                      </span>
                    )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-white/90">
                  Ime gosta (opcijski)
                  <input
                    value={guestName}
                    onChange={(event) => setGuestName(event.target.value)}
                    placeholder="Opcijski, upiši svoje ime..."
                    className="mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/60 focus:border-white/35"
                  />
                </label>
                <label className="text-sm text-white/90">
                  Mali opis / uspomena
                  <input
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    placeholder="Napiši malu uspomenu..."
                    className="mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/60 focus:border-white/35"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={deleteCapture}
                  className="rounded-full border border-white/20 bg-black/35 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/55 disabled:opacity-50"
                  disabled={isPublishing || isPreparingVideo}
                >
                  Izbrisi
                </button>
                <button
                  type="button"
                  onClick={resetCapture}
                  className="rounded-full border border-white/20 bg-black/35 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/55 disabled:opacity-50"
                  disabled={isPublishing || isPreparingVideo}
                >
                  Ponovi
                </button>
                <button
                  type="button"
                  onClick={publishCurrent}
                  className="rounded-full border border-rose-200 bg-rose-200 px-4 py-2 text-sm font-semibold text-rose-900 transition hover:bg-rose-300 disabled:opacity-50"
                  disabled={isPublishing || isPreparingVideo}
                >
                  {isPublishing ? "Objavljujem..." : "Objavi"}
                </button>
              </div>

              {publishError && (
                <p className="mt-3 text-sm text-rose-300">{publishError}</p>
              )}
            </div>
          )}
        </div>
      </section>

      <div
        className={`fixed inset-y-0 left-0 z-[72] w-full max-w-5xl border-r border-white/15  backdrop-blur-xl transition-transform duration-500 ${
          isGalleryOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-8">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/65">
                Galerija
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">
                Uspomene s vjencanja
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsGalleryOpen(false)}
              className="rounded-full border border-white/25 bg-white/10 p-2 text-white transition hover:bg-white/20"
              aria-label="Zatvori galeriju"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="px-5 pb-4 pt-4 sm:px-8">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setGalleryFilter("all")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  galleryFilter === "all"
                    ? "border border-white/40 bg-white text-slate-900"
                    : "border border-white/20 bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                Sve ({publishedItems.length})
              </button>
              <button
                type="button"
                onClick={() => setGalleryFilter("photo")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  galleryFilter === "photo"
                    ? "border border-white/40 bg-white text-slate-900"
                    : "border border-white/20 bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                Slike ({photoCount})
              </button>
              <button
                type="button"
                onClick={() => setGalleryFilter("video")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  galleryFilter === "video"
                    ? "border border-white/40 bg-white text-slate-900"
                    : "border border-white/20 bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                Video ({videoCount})
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-8 sm:px-8">
            {filteredPublishedItems.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {filteredPublishedItems.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openViewerAtIndex(index)}
                    className="group relative aspect-square overflow-hidden rounded-2xl border border-white/15 bg-black/35"
                  >
                    {item.kind === "video" ? (
                      <div className="relative flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.16),_transparent_45%),linear-gradient(145deg,_rgba(2,6,23,0.95),_rgba(15,23,42,0.75))]">
                        <span className="rounded-full border border-white/25 bg-black/45 p-3 text-white/95 shadow-lg">
                          <VideoIcon />
                        </span>
                        <span className="absolute bottom-2 left-2 rounded-full border border-white/20 bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/90">
                          Video
                        </span>
                      </div>
                    ) : (
                      <Image
                        src={item.url}
                        alt="Published item"
                        fill
                        sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      />
                    )}
                    <span className="absolute bottom-2 right-2 rounded-full border border-white/30 bg-black/45 p-1.5 text-white backdrop-blur-sm">
                      {item.kind === "video" ? <VideoIcon /> : <ImageIcon />}
                    </span>

                    {item.kind === "video" &&
                      typeof item.durationSeconds === "number" && (
                        <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold text-white">
                          {formatDuration(item.durationSeconds)}
                        </span>
                      )}
                  </button>
                ))}
              </div>
            ) : isLoadingRecent ? (
              <div className="rounded-[1.5rem] border border-dashed border-white/20 bg-white/5 px-6 py-12 text-center text-sm leading-7 text-white/75">
                Ucitavam galeriju...
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-white/20 bg-white/5 px-6 py-12 text-center text-sm leading-7 text-white/75">
                {publishedItems.length === 0
                  ? "Jos nema objavljenih uspomena u galeriji."
                  : "Nema stavki za odabrani filter."}
              </div>
            )}
          </div>
        </div>
      </div>

      {isGalleryOpen && (
        <button
          type="button"
          aria-label="Zatvori galeriju pozadinskim klikom"
          onClick={() => setIsGalleryOpen(false)}
          className="fixed inset-0 z-[71] bg-black/45"
        />
      )}

      {activeViewerItem && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 px-3 py-6 backdrop-blur-md sm:px-8"
          onClick={() => setActiveViewerIndex(null)}
        >
          <button
            type="button"
            onClick={() => setActiveViewerIndex(null)}
            className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/35 p-2 text-white transition hover:bg-black/50 sm:right-6 sm:top-6"
            aria-label="Close gallery"
          >
            <CloseIcon />
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              goToPreviousInViewer();
            }}
            className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/20 bg-black/35 p-2 text-white transition hover:bg-black/50 sm:left-6"
            aria-label="Previous media"
          >
            <ArrowLeftIcon />
          </button>

          <div
            className="w-full max-w-4xl overflow-hidden rounded-[1.75rem] border border-white/15 bg-black/55 shadow-2xl shadow-black/30"
            onClick={(event) => event.stopPropagation()}
            onTouchStart={handleViewerTouchStart}
            onTouchEnd={handleViewerTouchEnd}
          >
            <div className="max-h-[82vh] overflow-hidden">
              {activeViewerItem.kind === "video" ? (
                <div className="relative">
                  <video
                    key={activeViewerItem.id}
                    src={activeViewerItem.url}
                    controls
                    preload="metadata"
                    className="max-h-[82vh] w-full bg-black object-contain"
                    onError={() => {
                      setViewerVideoFailedId(activeViewerItem.id);
                    }}
                  />
                  {viewerVideoFailedId === activeViewerItem.id && (
                    <div className="absolute inset-0 z-10 flex items-end bg-gradient-to-t from-black/80 via-black/35 to-transparent p-4 sm:p-6">
                      <div className="max-w-xl rounded-2xl border border-white/20 bg-black/65 px-4 py-3 text-left text-white backdrop-blur-md">
                        <p className="text-sm font-semibold">
                          Ovaj uredaj ne uspijeva prikazati video track (audio
                          je dostupan).
                        </p>
                        <p className="mt-1 text-xs text-white/80">
                          Pokusaj otvoriti original video u novom tabu ili
                          koristeci drugi browser.
                        </p>
                        <div className="mt-3">
                          <a
                            href={activeViewerItem.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/25"
                          >
                            Otvori original video
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Image
                  src={activeViewerItem.url}
                  alt="Gallery preview"
                  width={1600}
                  height={1200}
                  className="max-h-[82vh] h-auto w-full bg-black object-contain"
                />
              )}
            </div>

            {(activeViewerItem.guestName ||
              activeViewerItem.caption ||
              (activeViewerItem.kind === "video" &&
                typeof activeViewerItem.durationSeconds === "number")) && (
              <div className="border-t border-white/10 bg-black/35 px-4 py-3 text-white">
                {activeViewerItem.guestName && (
                  <p className="font-[family-name:var(--font-display)] text-lg font-semibold sm:text-xl">
                    {activeViewerItem.guestName}
                  </p>
                )}
                {activeViewerItem.kind === "video" &&
                  typeof activeViewerItem.durationSeconds === "number" && (
                    <p className="text-xs uppercase tracking-[0.2em] text-white/70">
                      Trajanje:{" "}
                      {formatDuration(activeViewerItem.durationSeconds)}
                    </p>
                  )}
                {activeViewerItem.caption && (
                  <p className="mt-1 text-sm leading-6 text-white/85 sm:text-base">
                    {activeViewerItem.caption}
                  </p>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              goToNextInViewer();
            }}
            className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/20 bg-black/45 p-2 text-white transition hover:bg-black/65 sm:right-6"
            aria-label="Next media"
          >
            <ArrowRightIcon />
          </button>
        </div>
      )}
    </main>
  );
}

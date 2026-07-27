"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type CameraFacing = "user" | "environment";

type CapturedMedia = {
  kind: "photo" | "video";
  previewUrl: string;
  file: File;
  durationSeconds?: number;
};

type PublishedItem = {
  id: string;
  kind: "photo" | "video";
  url: string;
  guestName?: string;
  caption?: string;
};

type GalleryFilter = "all" | "photo" | "video";

const RECENT_REFRESH_MS = 15000;
const MAX_VIDEO_UPLOAD_BYTES = 30_000_000;
const MAX_IMAGE_UPLOAD_BYTES = 12_000_000;
const IMAGE_TARGET_MAX_WIDTH = 2400;
const IMAGE_TARGET_QUALITY = 0.9;
const IMAGE_MIN_QUALITY = 0.78;
const MAX_VIDEO_SECONDS_HARD_LIMIT = 15;
const VIDEO_TARGET_MAX_WIDTH = 1080;
const VIDEO_TARGET_MAX_BITRATE = 3_200_000;

export function GuestBooth({
  guestPath,
  dashboardPath,
  eventSlug,
  maxVideoSeconds = 15,
  title,
  coupleNames,
}: {
  guestPath: string;
  dashboardPath: string;
  eventSlug: string;
  maxVideoSeconds?: number;
  title: string;
  coupleNames: string;
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
  const [isPreparingVideo, setIsPreparingVideo] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [galleryFilter, setGalleryFilter] = useState<GalleryFilter>("all");
  const [activeViewerIndex, setActiveViewerIndex] = useState<number | null>(
    null,
  );
  const [showIntroOverlay, setShowIntroOverlay] = useState(true);
  const [introOverlayExiting, setIntroOverlayExiting] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  const filteredPublishedItems =
    galleryFilter === "all"
      ? publishedItems
      : publishedItems.filter((item) => item.kind === galleryFilter);
  const effectiveMaxVideoSeconds = Math.min(
    maxVideoSeconds,
    MAX_VIDEO_SECONDS_HARD_LIMIT,
  );
  const coupleInitials = getCoupleInitials(coupleNames);

  function getTooLargeUploadMessage(kind: "photo" | "video") {
    if (kind === "video") {
      return "Video je prevelik za upload (max 30MB).";
    }

    return "Fotka je prevelika za upload (max 12MB).";
  }

  function getUploadSizeLimitBytes(kind: "photo" | "video") {
    return kind === "video" ? MAX_VIDEO_UPLOAD_BYTES : MAX_IMAGE_UPLOAD_BYTES;
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
    setPublishError(null);

    try {
      const formData = new FormData();
      formData.append("eventSlug", eventSlug);
      formData.append(
        "mediaKind",
        capturedMedia.kind === "video" ? "video" : "image",
      );
      formData.append("guestName", guestName.trim());
      formData.append("caption", caption.trim());
      formData.append(
        "durationSeconds",
        `${capturedMedia.durationSeconds ?? 0}`,
      );
      formData.append("file", capturedMedia.file);

      const response = await fetch("/api/guest-submissions", {
        method: "POST",
        body: formData,
      });

      const responseContentType = response.headers.get("content-type") ?? "";
      let result: {
        ok: boolean;
        error?: string;
        submissionId?: string;
        assetUrl?: string;
        status?: string;
      } | null = null;

      if (responseContentType.includes("application/json")) {
        result = (await response.json()) as {
          ok: boolean;
          error?: string;
          submissionId?: string;
          assetUrl?: string;
          status?: string;
        };
      }

      if (!response.ok || !result?.ok) {
        if (!result) {
          const rawError = await response.text();
          const trimmedError = rawError.trim();
          if (
            response.status === 413 ||
            /entity too large|payload too large/i.test(trimmedError)
          ) {
            throw new Error("File is too large for upload.");
          }

          throw new Error(trimmedError || "Failed to publish submission.");
        }

        throw new Error(result.error ?? "Failed to publish submission.");
      }

      const nextItem: PublishedItem = {
        id: result.submissionId ?? `${Date.now()}`,
        kind: capturedMedia.kind,
        url: result.assetUrl ?? capturedMedia.previewUrl,
        guestName: guestName.trim() || undefined,
        caption: caption.trim() || undefined,
      };

      setPublishedItems((current) => [nextItem, ...current].slice(0, 8));
      void loadRecentPublished(false);

      setCaptureLabel("Published to wedding gallery queue");
      setCapturedMedia((current) => {
        if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
        return null;
      });
    } catch (error) {
      setPublishError(
        error instanceof Error
          ? error.message
          : "Failed to publish submission.",
      );
      setCaptureLabel("Publish failed");
    } finally {
      setIsPublishing(false);
    }
  }

  function resetCapture() {
    setCapturedMedia((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
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

  function goToPreviousInViewer() {
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
          resolve(rawDuration ? Math.round(rawDuration) : undefined);
        };
        video.onerror = () => resolve(undefined);
      });

      return duration;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function getSupportedVideoMimeType() {
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
      return null;
    }

    const candidates = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];

    for (const candidate of candidates) {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  async function compressVideoForUpload(
    file: File,
    maxDurationSeconds: number,
    forceProcessing = false,
  ) {
    if (typeof window === "undefined") return file;
    if (typeof MediaRecorder === "undefined") return file;

    const mimeType = getSupportedVideoMimeType();
    if (!mimeType) return file;

    const sourceUrl = URL.createObjectURL(file);

    try {
      const sourceVideo = document.createElement("video");
      sourceVideo.preload = "metadata";
      sourceVideo.muted = true;
      sourceVideo.playsInline = true;
      sourceVideo.src = sourceUrl;

      await new Promise<void>((resolve, reject) => {
        sourceVideo.onloadedmetadata = () => resolve();
        sourceVideo.onerror = () =>
          reject(new Error("Video metadata load failed."));
      });

      const sourceWidth = sourceVideo.videoWidth || 1280;
      const sourceHeight = sourceVideo.videoHeight || 720;
      const scale = Math.min(1, VIDEO_TARGET_MAX_WIDTH / sourceWidth);
      const targetWidth = Math.max(320, Math.round(sourceWidth * scale));
      const targetHeight = Math.max(180, Math.round(sourceHeight * scale));
      const sourceDuration = Number.isFinite(sourceVideo.duration)
        ? sourceVideo.duration
        : 0;
      const shouldTrim = sourceDuration > maxDurationSeconds + 0.05;
      const shouldCompress = file.size > MAX_VIDEO_UPLOAD_BYTES;

      if (!forceProcessing && !shouldTrim && !shouldCompress) {
        return file;
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const context = canvas.getContext("2d");
      if (!context) return file;

      const stream = canvas.captureStream(24);
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: VIDEO_TARGET_MAX_BITRATE,
      });

      const chunks: BlobPart[] = [];
      const captureEndAtSeconds =
        shouldTrim && sourceDuration > 0
          ? Math.min(sourceDuration, maxDurationSeconds)
          : null;

      await new Promise<void>((resolve, reject) => {
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        recorder.onerror = () => {
          reject(new Error("Video compression failed."));
        };

        recorder.onstop = () => resolve();

        const drawFrame = () => {
          if (sourceVideo.ended || sourceVideo.paused) return;

          if (
            captureEndAtSeconds !== null &&
            sourceVideo.currentTime >= captureEndAtSeconds
          ) {
            sourceVideo.pause();
            recorder.stop();
            return;
          }

          context.drawImage(sourceVideo, 0, 0, targetWidth, targetHeight);
          requestAnimationFrame(drawFrame);
        };

        sourceVideo.onended = () => {
          recorder.stop();
        };

        void sourceVideo.play().then(() => {
          recorder.start(250);
          drawFrame();
        });
      });

      const compressedBlob = new Blob(chunks, { type: mimeType });
      if (!compressedBlob.size) {
        return file;
      }

      if (!shouldTrim && compressedBlob.size >= file.size) {
        return file;
      }

      return new File(
        [compressedBlob],
        file.name.replace(/\.[^.]+$/, ".webm"),
        {
          type: mimeType,
          lastModified: Date.now(),
        },
      );
    } catch {
      return file;
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  async function compressImageForUpload(file: File) {
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

        if (compressedBlob.size <= MAX_IMAGE_UPLOAD_BYTES) {
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
        setIsPreparingVideo(true);
        setCaptureLabel("Preparing video for upload...");

        const rawDurationSeconds = await getVideoDurationFromFile(selectedFile);
        const shouldTrim =
          typeof rawDurationSeconds === "number" &&
          rawDurationSeconds > effectiveMaxVideoSeconds;
        const shouldCompress = selectedFile.size > maxSizeForKind;

        uploadFile = await compressVideoForUpload(
          selectedFile,
          effectiveMaxVideoSeconds,
          shouldTrim || shouldCompress,
        );

        if (shouldTrim) {
          setCaptureLabel(
            `Video je automatski skracen na ${effectiveMaxVideoSeconds}s.`,
          );
        }
      } else {
        setCaptureLabel("Preparing photo for upload...");

        if (selectedFile.size > maxSizeForKind) {
          uploadFile = await compressImageForUpload(selectedFile);
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
        return;
      }

      const previewUrl = URL.createObjectURL(uploadFile);

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
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,_#fffdfb_0%,_#f9f4ee_45%,_#f4ede4_100%)] text-slate-800">
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

      <style jsx>{`
        .intro-heartbeat {
          animation: intro-heartbeat 1.15s ease-in-out infinite;
          transform-origin: center;
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
      `}</style>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-rose-200/35 blur-3xl" />
        <div className="absolute right-[-72px] top-24 h-96 w-96 rounded-full bg-amber-100/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-80 w-[42rem] -translate-x-1/2 rounded-full bg-white/45 blur-3xl" />
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
        Guest route: {guestPath}. Dashboard route: {dashboardPath}. Max video
        config: {effectiveMaxVideoSeconds}.
      </p>
      <section className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8 px-3 py-8 pb-32 sm:px-3 sm:pb-36 lg:px-12 lg:pb-8">
        <header className="overflow-hidden rounded-[2.5rem] border border-stone-200/80 bg-white/86 px-6 py-6 shadow-[0_24px_80px_rgba(120,96,76,0.10)] backdrop-blur-2xl sm:px-8 sm:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="mt-5 font-[family-name:var(--font-display)] text-5xl font-semibold tracking-[0.02em] text-slate-900 sm:text-6xl lg:text-7xl">
                {coupleNames}
              </h1>
              <p className="mt-3 text-sm font-medium uppercase tracking-[0.3em] text-stone-600 sm:text-base">
                {title}
              </p>
              <p className="mt-4 max-w-2xl text-base leading-8 text-stone-600 sm:text-lg">
                Podijelite s nama trenutke, osmijehe i male uspomene iz ovog
                dana.
              </p>
            </div>

            {/* <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[300px] lg:grid-cols-1">
              <div className="rounded-[1.6rem] border border-stone-200 bg-white/76 px-5 py-4 text-sm text-stone-600 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                  Dobrodošli
                </p>
                <p className="mt-2 leading-6">
                  Uslikaj fotku ili snimi video i dodaj poruku za mladence.
                </p>
              </div>
              <div className="rounded-[1.6rem] border border-stone-200 bg-gradient-to-br from-stone-50 to-rose-50 px-5 py-4 text-sm text-stone-600 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                  Elegantan zapis
                </p>
                <p className="mt-2 leading-6">
                  Sve ostaje pregledno i spremno za zajedničku galeriju.
                </p>
              </div>
            </div> */}
          </div>
        </header>

        <div
          className={`grid gap-6 ${capturedMedia ? "lg:grid-cols-[1.05fr_0.95fr]" : ""}`}
        >
          {capturedMedia && (
            <section className="rounded-[2.5rem] border border-stone-200/80 bg-white/88 p-4 shadow-[0_24px_80px_rgba(120,96,76,0.10)] backdrop-blur-2xl sm:p-6">
              <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.8fr]">
                <div className="space-y-4">
                  <div className="relative overflow-hidden rounded-[2rem] border border-stone-200 bg-gradient-to-b from-white to-stone-50/70">
                    <div className="relative flex min-h-[420px] items-center justify-center p-4">
                      {capturedMedia.kind === "video" ? (
                        <video
                          src={capturedMedia.previewUrl}
                          controls
                          playsInline
                          className="max-h-[420px] w-full rounded-[1.5rem] object-cover shadow-2xl shadow-stone-900/10"
                        />
                      ) : (
                        <Image
                          src={capturedMedia.previewUrl}
                          alt="Captured preview"
                          width={1280}
                          height={720}
                          unoptimized
                          className="max-h-[420px] w-full rounded-[1.5rem] object-cover shadow-2xl shadow-stone-900/10"
                        />
                      )}
                    </div>
                  </div>

                  {(guestName.trim() || caption.trim()) && (
                    <div className="rounded-[1.25rem] border border-stone-200 bg-white/84 px-4 py-3 shadow-sm">
                      {guestName.trim() && (
                        <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900">
                          {guestName.trim()}
                        </p>
                      )}
                      {caption.trim() && (
                        <p className="mt-1 text-sm leading-6 text-stone-600">
                          {caption.trim()}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={deleteCapture}
                      className="rounded-full border border-stone-200 bg-stone-50 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-100 disabled:opacity-50"
                      disabled={isPublishing || isPreparingVideo}
                    >
                      Delete
                    </button>

                    <button
                      type="button"
                      onClick={resetCapture}
                      className="rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 disabled:opacity-50"
                      disabled={isPublishing || isPreparingVideo}
                    >
                      Retake
                    </button>

                    <button
                      type="button"
                      onClick={publishCurrent}
                      className="rounded-full border border-rose-200 bg-rose-200 px-5 py-3 text-sm font-semibold text-rose-900 shadow-lg shadow-rose-200/45 transition hover:bg-rose-300 disabled:opacity-50"
                      disabled={isPublishing || isPreparingVideo}
                    >
                      {isPublishing ? "Publishing..." : "Publish"}
                    </button>
                  </div>

                  {isPreparingVideo && (
                    <p className="text-sm text-stone-500">
                      Kompresiram video za upload...
                    </p>
                  )}
                  {publishError && (
                    <p className="text-sm text-rose-600">{publishError}</p>
                  )}
                </div>

                <aside className="space-y-4 rounded-[1.75rem] border border-stone-200 bg-white/84 p-4 shadow-sm">
                  <label className="block text-sm text-stone-600">
                    Guest name
                    <input
                      value={guestName}
                      onChange={(event) => setGuestName(event.target.value)}
                      placeholder="Optional"
                      className="mt-2 w-full rounded-2xl border border-stone-200 bg-white/92 px-4 py-3 text-slate-900 outline-none placeholder:text-stone-400 focus:border-stone-400 focus:ring-2 focus:ring-stone-200/70"
                    />
                  </label>
                  <label className="block text-sm text-stone-600">
                    Caption
                    <textarea
                      value={caption}
                      onChange={(event) => setCaption(event.target.value)}
                      placeholder="Write a small memory..."
                      rows={6}
                      className="mt-2 w-full rounded-2xl border border-stone-200 bg-white/92 px-4 py-3 text-slate-900 outline-none placeholder:text-stone-400 focus:border-stone-400 focus:ring-2 focus:ring-stone-200/70"
                    />
                  </label>
                </aside>
              </div>
            </section>
          )}

          <section className="rounded-[2.5rem] border border-stone-200/80 bg-white/88 p-3 shadow-[0_24px_80px_rgba(120,96,76,0.10)] backdrop-blur-2xl sm:p-6">
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setGalleryFilter("all")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  galleryFilter === "all"
                    ? "border border-stone-300 bg-stone-100 text-stone-800 shadow-sm"
                    : "border border-stone-200 bg-white/80 text-stone-700 hover:border-stone-300 hover:bg-stone-50"
                }`}
              >
                Sve
              </button>
              <button
                type="button"
                onClick={() => setGalleryFilter("photo")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  galleryFilter === "photo"
                    ? "border border-stone-300 bg-stone-100 text-stone-800 shadow-sm"
                    : "border border-stone-200 bg-white/80 text-stone-700 hover:border-stone-300 hover:bg-stone-50"
                }`}
              >
                Slike
              </button>
              <button
                type="button"
                onClick={() => setGalleryFilter("video")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  galleryFilter === "video"
                    ? "border border-stone-300 bg-stone-100 text-stone-800 shadow-sm"
                    : "border border-stone-200 bg-white/80 text-stone-700 hover:border-stone-300 hover:bg-stone-50"
                }`}
              >
                Video
              </button>
            </div>

            <div className="space-y-4">
              {filteredPublishedItems.length > 0 ? (
                <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
                  {filteredPublishedItems.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveViewerIndex(index)}
                      className="group relative aspect-square w-full overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
                    >
                      {item.kind === "video" ? (
                        <video
                          src={item.url}
                          muted
                          playsInline
                          preload="metadata"
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <Image
                          src={item.url}
                          alt="Published item"
                          fill
                          sizes="(max-width: 640px) 25vw, (max-width: 1024px) 16vw, 12vw"
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        />
                      )}
                      <span className="absolute bottom-2 right-2 rounded-full border border-stone-200 bg-white/90 p-1.5 text-stone-700 shadow-sm backdrop-blur-sm">
                        {item.kind === "video" ? <VideoIcon /> : <ImageIcon />}
                      </span>
                    </button>
                  ))}
                </div>
              ) : isLoadingRecent ? (
                <div className="rounded-[1.5rem] border border-dashed border-stone-200 bg-white/75 px-6 py-12 text-center text-sm leading-7 text-stone-500">
                  Loading shared event feed...
                </div>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-stone-200 bg-white/75 px-6 py-12 text-center text-sm leading-7 text-stone-500">
                  {publishedItems.length === 0
                    ? "After publish, entries are sent to Sanity and show status in the dashboard moderation queue."
                    : "Nema stavki za odabrani filter."}
                </div>
              )}
            </div>
          </section>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200/80 bg-white/90 px-3 py-3 shadow-[0_-20px_60px_rgba(120,96,76,0.10)] backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
          <button
            type="button"
            onClick={triggerNativePhotoCapture}
            className="w-full rounded-full border border-rose-200 bg-rose-200 px-5 py-4 text-sm font-semibold text-rose-900 shadow-lg shadow-rose-200/45 transition hover:bg-rose-300 disabled:opacity-50 sm:w-auto sm:min-w-[180px]"
            disabled={isPublishing || isPreparingVideo}
          >
            📸 Uslikaj fotografiju
          </button>

          <button
            type="button"
            onClick={triggerNativeVideoCapture}
            className="w-full rounded-full border border-stone-200 bg-white px-5 py-4 text-sm font-semibold text-stone-700 shadow-lg shadow-stone-100/40 transition hover:border-stone-300 hover:bg-stone-50 disabled:opacity-50 sm:w-auto sm:min-w-[180px]"
            disabled={isPublishing || isPreparingVideo}
          >
            🎥 Snimi video
          </button>
        </div>
      </div>

      {activeViewerItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-3 py-6 backdrop-blur-md sm:px-8"
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
                <video
                  src={activeViewerItem.url}
                  controls
                  playsInline
                  className="max-h-[82vh] w-full bg-black object-contain"
                />
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

            {(activeViewerItem.guestName || activeViewerItem.caption) && (
              <div className="border-t border-white/10 bg-black/35 px-4 py-3 text-white">
                {activeViewerItem.guestName && (
                  <p className="font-[family-name:var(--font-display)] text-lg font-semibold sm:text-xl">
                    {activeViewerItem.guestName}
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

function getCoupleInitials(coupleNames: string) {
  const words = coupleNames
    .replace(/[+&/,]/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^(i|and)$/i.test(part));

  const initials = words
    .map((word) => word.match(/[A-Za-zČĆŽŠĐčćžšđ]/)?.[0]?.toUpperCase() ?? "")
    .filter(Boolean);

  if (initials.length >= 2) {
    return `${initials[0]} + ${initials[1]}`;
  }

  if (initials.length === 1) {
    const fallbackSecond =
      coupleNames
        .slice(coupleNames.indexOf(initials[0]) + 1)
        .match(/[A-Za-zČĆŽŠĐčćžšđ]/)?.[0]
        ?.toUpperCase() ?? initials[0];

    return `${initials[0]} + ${fallbackSecond}`;
  }

  return "A + B";
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5zm2.5-.5a.5.5 0 0 0-.5.5v8.38l3.6-3.61a1.4 1.4 0 0 1 1.98 0l1.2 1.2 2.6-2.59a1.4 1.4 0 0 1 1.98 0L18 9.58V5.5a.5.5 0 0 0-.5-.5zm11.5 7.41-2.02-2.02-3.2 3.2a1 1 0 0 1-1.42 0L10.59 12l-4.59 4.58v1.92a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5zM9 8.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0"
      />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h8A2.5 2.5 0 0 1 17 6.5v2.18l2.87-1.76A1.5 1.5 0 0 1 22 8.2v7.6a1.5 1.5 0 0 1-2.13 1.28L17 15.32v2.18a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 4 17.5zm11 6.47 4.82 2.96a.5.5 0 0 0 .18.07V8a.5.5 0 0 0-.18.07L15 11.03z"
      />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M14.78 5.47a.75.75 0 0 1 0 1.06L9.31 12l5.47 5.47a.75.75 0 1 1-1.06 1.06l-6-6a.75.75 0 0 1 0-1.06l6-6a.75.75 0 0 1 1.06 0"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9.22 5.47a.75.75 0 0 1 1.06 0l6 6a.75.75 0 0 1 0 1.06l-6 6a.75.75 0 1 1-1.06-1.06L14.69 12 9.22 6.53a.75.75 0 0 1 0-1.06"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.72 6.72a.75.75 0 0 1 1.06 0L12 10.94l4.22-4.22a.75.75 0 1 1 1.06 1.06L13.06 12l4.22 4.22a.75.75 0 1 1-1.06 1.06L12 13.06l-4.22 4.22a.75.75 0 1 1-1.06-1.06L10.94 12 6.72 7.78a.75.75 0 0 1 0-1.06"
      />
    </svg>
  );
}

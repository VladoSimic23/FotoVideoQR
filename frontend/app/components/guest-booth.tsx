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
const MAX_UPLOAD_BYTES = 4_000_000;
const VIDEO_TARGET_MAX_WIDTH = 720;
const VIDEO_TARGET_MAX_BITRATE = 900_000;

export function GuestBooth({
  guestPath,
  dashboardPath,
  eventSlug,
  maxVideoSeconds = 12,
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
  const touchStartXRef = useRef<number | null>(null);

  const filteredPublishedItems =
    galleryFilter === "all"
      ? publishedItems
      : publishedItems.filter((item) => item.kind === galleryFilter);

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

  async function publishCurrent() {
    if (!capturedMedia) return;

    if (capturedMedia.file.size > MAX_UPLOAD_BYTES) {
      setPublishError(
        "Video je prevelik za upload. Snimi krace ili dopusti automatsku kompresiju.",
      );
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

  async function compressVideoForUpload(file: File) {
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
      if (!compressedBlob.size || compressedBlob.size >= file.size) {
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

      if (isVideo) {
        setIsPreparingVideo(true);
        setCaptureLabel("Preparing video for upload...");

        if (selectedFile.size > MAX_UPLOAD_BYTES) {
          uploadFile = await compressVideoForUpload(selectedFile);
        }
      }

      const previewUrl = URL.createObjectURL(uploadFile);
      const durationSeconds = isVideo
        ? await getVideoDurationFromFile(uploadFile)
        : undefined;

      setCapturedMedia((current) => {
        if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
        return {
          kind,
          file: uploadFile,
          previewUrl,
          durationSeconds,
        };
      });

      if (isVideo && uploadFile.size > MAX_UPLOAD_BYTES) {
        setPublishError(
          "Video je i dalje prevelik nakon kompresije. Pokusaj kraci snimak ili nizu kvalitetu kamere.",
        );
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
    <main className="min-h-screen bg-[#07111f] text-slate-50">
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
        config: {maxVideoSeconds}.
      </p>
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-3 py-8 sm:px-3 lg:px-12">
        <header className="rounded-[2rem] border border-white/10 bg-white/5 px-6 py-5 backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {coupleNames}
              </h1>
              <p className="mt-2 text-sm text-slate-300">{title}</p>
              <p className="mt-2 max-w-2xl text-ls leading-7 text-slate-300 sm:text-base">
                Podijelite s nama trenutke s naše proslave
              </p>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.8fr]">
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/80">
                  {capturedMedia && (
                    <div className="relative flex min-h-[420px] items-center justify-center p-4">
                      {capturedMedia.kind === "video" ? (
                        <video
                          src={capturedMedia.previewUrl}
                          controls
                          playsInline
                          className="max-h-[420px] w-full rounded-[1.25rem] object-cover shadow-2xl"
                        />
                      ) : (
                        <Image
                          src={capturedMedia.previewUrl}
                          alt="Captured preview"
                          width={1280}
                          height={720}
                          unoptimized
                          className="max-h-[420px] w-full rounded-[1.25rem] object-cover shadow-2xl"
                        />
                      )}
                    </div>
                  )}
                  {/* {!capturedMedia && (
                    <div className="flex h-[420px] items-center justify-center px-6 text-center text-sm text-slate-300">
                      Tap Take photo to open your phone camera and preview the
                      shot here.
                    </div>
                  )} */}
                </div>

                {capturedMedia && (guestName.trim() || caption.trim()) && (
                  <div className="rounded-xl border border-white/10 bg-slate-950/55 px-4 py-3">
                    {guestName.trim() && (
                      <p className="text-sm font-semibold text-white">
                        {guestName.trim()}
                      </p>
                    )}
                    {caption.trim() && (
                      <p className="mt-1 text-xs leading-5 text-slate-100">
                        {caption.trim()}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={triggerNativePhotoCapture}
                    className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-50 disabled:opacity-50"
                    disabled={isPublishing || isPreparingVideo}
                  >
                    📸 Uslikaj fotku
                  </button>

                  <button
                    type="button"
                    onClick={triggerNativeVideoCapture}
                    className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-50 disabled:opacity-50"
                    disabled={isPublishing || isPreparingVideo}
                  >
                    🎥 Snimi video
                  </button>

                  {capturedMedia && (
                    <>
                      <button
                        type="button"
                        onClick={deleteCapture}
                        className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                        disabled={isPublishing || isPreparingVideo}
                      >
                        Delete
                      </button>

                      <button
                        type="button"
                        onClick={resetCapture}
                        className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                        disabled={isPublishing || isPreparingVideo}
                      >
                        Retake
                      </button>

                      <button
                        type="button"
                        onClick={publishCurrent}
                        className="rounded-full border border-white/10 bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
                        disabled={isPublishing || isPreparingVideo}
                      >
                        {isPublishing ? "Publishing..." : "Publish"}
                      </button>
                    </>
                  )}
                </div>
                <p className="text-xs text-slate-300">
                  Max trajanje videa: {maxVideoSeconds}s
                </p>
                {isPreparingVideo && (
                  <p className="text-sm text-slate-300">
                    Kompresujem video za upload...
                  </p>
                )}
                {publishError && (
                  <p className="text-sm text-rose-300">{publishError}</p>
                )}
              </div>

              {capturedMedia && (
                <aside className="space-y-4 rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-4">
                  <label className="block text-sm text-slate-300">
                    Guest name
                    <input
                      value={guestName}
                      onChange={(event) => setGuestName(event.target.value)}
                      placeholder="Optional"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                    />
                  </label>
                  <label className="block text-sm text-slate-300">
                    Caption
                    <textarea
                      value={caption}
                      onChange={(event) => setCaption(event.target.value)}
                      placeholder="Write a small memory..."
                      rows={6}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                    />
                  </label>
                </aside>
              )}
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-3 backdrop-blur-xl sm:p-6">
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setGalleryFilter("all")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  galleryFilter === "all"
                    ? "bg-white text-slate-900"
                    : "border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
                }`}
              >
                Sve
              </button>
              <button
                type="button"
                onClick={() => setGalleryFilter("photo")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  galleryFilter === "photo"
                    ? "bg-white text-slate-900"
                    : "border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
                }`}
              >
                Slike
              </button>
              <button
                type="button"
                onClick={() => setGalleryFilter("video")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  galleryFilter === "video"
                    ? "bg-white text-slate-900"
                    : "border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
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
                      className="group relative aspect-square w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900"
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
                      <span className="absolute bottom-2 right-2 rounded-full border border-white/20 bg-black/50 p-1.5 text-white backdrop-blur-sm">
                        {item.kind === "video" ? <VideoIcon /> : <ImageIcon />}
                      </span>
                    </button>
                  ))}
                </div>
              ) : isLoadingRecent ? (
                <div className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 px-6 py-12 text-center text-sm leading-7 text-slate-300">
                  Loading shared event feed...
                </div>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 px-6 py-12 text-center text-sm leading-7 text-slate-300">
                  {publishedItems.length === 0
                    ? "After publish, entries are sent to Sanity and show status in the dashboard moderation queue."
                    : "Nema stavki za odabrani filter."}
                </div>
              )}
            </div>
          </section>
        </div>
      </section>

      {activeViewerItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-3 py-6 backdrop-blur-sm sm:px-8"
          onClick={() => setActiveViewerIndex(null)}
        >
          <button
            type="button"
            onClick={() => setActiveViewerIndex(null)}
            className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/40 p-2 text-white transition hover:bg-black/60 sm:right-6 sm:top-6"
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
            className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/20 bg-black/40 p-2 text-white transition hover:bg-black/60 sm:left-6"
            aria-label="Previous media"
          >
            <ArrowLeftIcon />
          </button>

          <div
            className="w-full max-w-4xl overflow-hidden rounded-[1.5rem] border border-white/15 bg-black/40"
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
              <div className="border-t border-white/10 bg-slate-950/70 px-4 py-3">
                {activeViewerItem.guestName && (
                  <p className="text-sm font-semibold text-white sm:text-base">
                    {activeViewerItem.guestName}
                  </p>
                )}
                {activeViewerItem.caption && (
                  <p className="mt-1 text-xs leading-5 text-slate-100 sm:text-sm">
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
            className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/20 bg-black/40 p-2 text-white transition hover:bg-black/60 sm:right-6"
            aria-label="Next media"
          >
            <ArrowRightIcon />
          </button>
        </div>
      )}
    </main>
  );
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

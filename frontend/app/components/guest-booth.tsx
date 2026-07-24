"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CaptureMode = "photo" | "video";
type CameraFacing = "user" | "environment";

type CapturedMedia = {
  kind: CaptureMode;
  previewUrl: string;
  file: File;
  durationSeconds?: number;
  needsRotationFix?: boolean;
};

type PublishedItem = {
  id: string;
  kind: CaptureMode;
  url: string;
  needsRotationFix?: boolean;
};

const RECENT_REFRESH_MS = 15000;

export function GuestBooth({
  guestPath,
  dashboardPath,
  eventSlug,
  maxVideoSeconds = 10,
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const [mode, setMode] = useState<CaptureMode>("photo");
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>("user");
  const [streamReady, setStreamReady] = useState(false);
  const [captureLabel, setCaptureLabel] = useState("Ready to capture");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
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
  const [publishError, setPublishError] = useState<string | null>(null);
  const [frontRotationEnabled, setFrontRotationEnabled] = useState(true);
  const [activeViewerIndex, setActiveViewerIndex] = useState<number | null>(
    null,
  );
  const touchStartXRef = useRef<number | null>(null);

  const canRecordVideo = useMemo(
    () => typeof MediaRecorder !== "undefined",
    [],
  );

  const shouldRotateFrontCamera = useMemo(() => {
    if (cameraFacing !== "user") return false;
    return frontRotationEnabled;
  }, [cameraFacing, frontRotationEnabled]);

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
    if (activeViewerIndex === null || publishedItems.length === 0) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveViewerIndex(null);
        return;
      }

      if (event.key === "ArrowLeft") {
        setActiveViewerIndex((current) => {
          if (current === null || publishedItems.length === 0) return current;
          return current === 0 ? publishedItems.length - 1 : current - 1;
        });
      }

      if (event.key === "ArrowRight") {
        setActiveViewerIndex((current) => {
          if (current === null || publishedItems.length === 0) return current;
          return current === publishedItems.length - 1 ? 0 : current + 1;
        });
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeViewerIndex, publishedItems]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    async function startStream() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: mode === "video",
          video: {
            facingMode: { ideal: cameraFacing },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        setStreamReady(true);
        setCaptureLabel(
          `Camera ready (${cameraFacing === "user" ? "front" : "back"})`,
        );

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        setCaptureLabel("Camera permission needed");
        setStreamReady(false);
      }
    }

    void startStream();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [mode, cameraFacing]);

  useEffect(() => {
    if (!isRecording) return;

    const interval = window.setInterval(() => {
      setRecordingSeconds((current) => {
        if (current + 1 >= maxVideoSeconds) {
          window.clearInterval(interval);
          void stopRecording();
          return maxVideoSeconds;
        }

        return current + 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isRecording, maxVideoSeconds]);

  useEffect(() => {
    return () => {
      if (capturedMedia?.previewUrl) {
        URL.revokeObjectURL(capturedMedia.previewUrl);
      }
    };
  }, [capturedMedia]);

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video) return;
    const shouldRotateFrontAtCapture =
      cameraFacing === "user" && frontRotationEnabled;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    if (!context) return;

    if (shouldRotateFrontAtCapture) {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.94),
    );
    if (!blob) return;

    const file = new File([blob], `wedding-photo-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    const previewUrl = URL.createObjectURL(file);

    setCapturedMedia((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return {
        kind: "photo",
        file,
        previewUrl,
        needsRotationFix: false,
      };
    });

    setPublishError(null);
    setCaptureLabel("Photo preview ready");
  }

  async function startRecording() {
    const stream = streamRef.current;
    if (!stream || !canRecordVideo) return;
    const shouldRotateFrontForThisRecording =
      cameraFacing === "user" && frontRotationEnabled;

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const file = new File([blob], `wedding-video-${Date.now()}.webm`, {
        type: "video/webm",
      });
      const previewUrl = URL.createObjectURL(file);

      setCapturedMedia((current) => {
        if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
        return {
          kind: "video",
          file,
          previewUrl,
          durationSeconds: recordingSeconds || undefined,
          needsRotationFix: shouldRotateFrontForThisRecording,
        };
      });

      setCaptureLabel("Video preview ready");
      setIsRecording(false);
      setRecordingSeconds(0);
      chunksRef.current = [];
      setPublishError(null);
    };

    recorder.start();
    setIsRecording(true);
    setRecordingSeconds(0);
    setCaptureLabel(`Recording up to ${maxVideoSeconds} seconds`);
  }

  async function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  }

  async function publishCurrent() {
    if (!capturedMedia) return;

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

      const result = (await response.json()) as {
        ok: boolean;
        error?: string;
        submissionId?: string;
        assetUrl?: string;
        status?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Failed to publish submission.");
      }

      const nextItem: PublishedItem = {
        id: result.submissionId ?? `${Date.now()}`,
        kind: capturedMedia.kind,
        url: result.assetUrl ?? capturedMedia.previewUrl,
        needsRotationFix: capturedMedia.needsRotationFix,
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
    activeViewerIndex !== null && publishedItems[activeViewerIndex]
      ? publishedItems[activeViewerIndex]
      : null;

  function goToPreviousInViewer() {
    setActiveViewerIndex((current) => {
      if (current === null || publishedItems.length === 0) return current;
      return current === 0 ? publishedItems.length - 1 : current - 1;
    });
  }

  function goToNextInViewer() {
    setActiveViewerIndex((current) => {
      if (current === null || publishedItems.length === 0) return current;
      return current === publishedItems.length - 1 ? 0 : current + 1;
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

  return (
    <main className="min-h-screen bg-[#07111f] text-slate-50">
      <p className="sr-only" aria-live="polite">
        {captureLabel}
      </p>
      <p className="sr-only">
        Guest route: {guestPath}. Dashboard route: {dashboardPath}.
      </p>
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 sm:px-10 lg:px-12">
        <header className="rounded-[2rem] border border-white/10 bg-white/5 px-6 py-5 backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-100/80">
                Guest capture
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {coupleNames}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                {title} · Guests can shoot a photo or a short video, preview it,
                delete it, or publish it to the couple gallery.
              </p>
            </div>
            {/* <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                {captureLabel}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                Max video {maxVideoSeconds}s
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                {streamReady ? "Camera ready" : "Waiting for camera"}
              </span>
            </div> */}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
            <div className="flex flex-wrap gap-3 border-b border-white/10 pb-4">
              {(["photo", "video"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${mode === value ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"}`}
                >
                  {value === "photo" ? "Photo" : "Video"}
                </button>
              ))}
              {(
                [
                  { value: "user", label: "Front camera" },
                  { value: "environment", label: "Back camera" },
                ] as const
              ).map((camera) => (
                <button
                  key={camera.value}
                  type="button"
                  onClick={() => setCameraFacing(camera.value)}
                  disabled={isRecording || isPublishing}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${cameraFacing === camera.value ? "bg-cyan-300 text-slate-950" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"} disabled:opacity-50`}
                >
                  {camera.label}
                </button>
              ))}
              {cameraFacing === "user" && (
                <button
                  type="button"
                  onClick={() => setFrontRotationEnabled((current) => !current)}
                  disabled={isRecording || isPublishing}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
                >
                  Front correction: {frontRotationEnabled ? "on" : "off"}
                </button>
              )}
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.8fr]">
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/80">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{
                      transform: shouldRotateFrontCamera
                        ? "rotateY(-180deg)"
                        : "none",
                    }}
                    className={`h-[420px] w-full object-cover ${capturedMedia ? "opacity-25" : "opacity-100"}`}
                  />
                  {capturedMedia && (
                    <div className="absolute inset-0 flex items-center justify-center p-4">
                      {capturedMedia.kind === "video" ? (
                        <video
                          src={capturedMedia.previewUrl}
                          controls
                          playsInline
                          style={{
                            transform: capturedMedia.needsRotationFix
                              ? "rotateY(-180deg)"
                              : "none",
                          }}
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
                </div>

                <div className="flex flex-wrap gap-3">
                  {mode === "photo" ? (
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-50 disabled:opacity-50"
                      disabled={!streamReady || isPublishing}
                    >
                      Capture photo
                    </button>
                  ) : isRecording ? (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="rounded-full bg-rose-400 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-300"
                    >
                      Stop recording ({recordingSeconds}s)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void startRecording()}
                      className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-50 disabled:opacity-50"
                      disabled={!streamReady || !canRecordVideo || isPublishing}
                    >
                      Start video
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={deleteCapture}
                    className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                    disabled={!capturedMedia || isPublishing}
                  >
                    Delete
                  </button>

                  <button
                    type="button"
                    onClick={resetCapture}
                    className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                    disabled={!capturedMedia || isPublishing}
                  >
                    Retake
                  </button>

                  <button
                    type="button"
                    onClick={publishCurrent}
                    className="rounded-full border border-white/10 bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
                    disabled={!capturedMedia || isPublishing}
                  >
                    {isPublishing ? "Publishing..." : "Publish"}
                  </button>
                </div>
                {publishError && (
                  <p className="text-sm text-rose-300">{publishError}</p>
                )}
              </div>

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
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-3 backdrop-blur-xl sm:p-6">
            {/* <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-sm text-slate-300">Recent published</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">
                  Your last shares
                </h2>
              </div>
           
            </div> */}

            <div className="mt-5 space-y-4">
              {publishedItems.length > 0 ? (
                <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
                  {publishedItems.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveViewerIndex(index)}
                      className="group relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-slate-900"
                    >
                      {item.kind === "video" ? (
                        <video
                          src={item.url}
                          muted
                          playsInline
                          preload="metadata"
                          style={{
                            transform: item.needsRotationFix
                              ? "rotateY(-180deg)"
                              : "none",
                          }}
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
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 to-transparent opacity-90" />
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
                  After publish, entries are sent to Sanity and show status in
                  the dashboard moderation queue.
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
            className="relative w-full max-w-4xl overflow-hidden rounded-[1.5rem] border border-white/15 bg-black/40"
            onClick={(event) => event.stopPropagation()}
            onTouchStart={handleViewerTouchStart}
            onTouchEnd={handleViewerTouchEnd}
          >
            {activeViewerItem.kind === "video" ? (
              <video
                src={activeViewerItem.url}
                controls
                playsInline
                style={{
                  transform: activeViewerItem.needsRotationFix
                    ? "rotateY(-180deg)"
                    : "none",
                }}
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

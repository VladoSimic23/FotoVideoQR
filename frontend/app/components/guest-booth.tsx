"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CaptureMode = "photo" | "video";
type CameraFacing = "user" | "environment";

type CapturedMedia = {
  kind: CaptureMode;
  previewUrl: string;
  file: File;
  durationSeconds?: number;
};

type PublishedItem = {
  id: string;
  kind: CaptureMode;
  url: string;
  createdAt: string;
  status: string;
};

const RECENT_REFRESH_MS = 15000;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function GuestBooth({
  guestPath,
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
  const [isLoadingRecent, setIsLoadingRecent] = useState(() => Boolean(eventSlug));
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const canRecordVideo = useMemo(() => typeof MediaRecorder !== "undefined", []);

  const loadRecentPublished = useCallback(async (showLoading = true) => {
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

      const items = (result.recent ?? [])
        .map((entry) => ({
          id: entry._id,
          kind: entry.mediaKind === "video" ? "video" : "photo",
          url: entry.video?.asset?.url ?? entry.image?.asset?.url ?? "",
          createdAt: entry._createdAt,
          status: entry.status ?? "pending",
        }))
        .filter((entry) => Boolean(entry.url));

      setPublishedItems(items);
    } catch {
      setPublishedItems([]);
    } finally {
      setIsLoadingRecent(false);
    }
  }, [eventSlug]);

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

        const items = (result.recent ?? [])
          .map((entry) => ({
            id: entry._id,
            kind: entry.mediaKind === "video" ? "video" : "photo",
            url: entry.video?.asset?.url ?? entry.image?.asset?.url ?? "",
            createdAt: entry._createdAt,
            status: entry.status ?? "pending",
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

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    if (!context) return;

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
      return { kind: "photo", file, previewUrl };
    });

    setPublishError(null);
    setCaptureLabel("Photo preview ready");
  }

  async function startRecording() {
    const stream = streamRef.current;
    if (!stream || !canRecordVideo) return;

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
        createdAt: new Date().toISOString(),
        status: result.status ?? "pending",
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

  return (
    <main className="min-h-screen bg-[#07111f] text-slate-50">
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
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                {captureLabel}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                Max video {maxVideoSeconds}s
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                {streamReady ? "Camera ready" : "Waiting for camera"}
              </span>
            </div>
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
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.8fr]">
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/80">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`h-[420px] w-full object-cover ${capturedMedia ? "opacity-25" : "opacity-100"}`}
                  />
                  {capturedMedia && (
                    <div className="absolute inset-0 flex items-center justify-center p-4">
                      {capturedMedia.kind === "video" ? (
                        <video
                          src={capturedMedia.previewUrl}
                          controls
                          playsInline
                          className="max-h-[420px] w-full rounded-[1.25rem] object-cover shadow-2xl"
                        />
                      ) : (
                        <img
                          src={capturedMedia.previewUrl}
                          alt="Captured preview"
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
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  <p className="font-medium text-white">Capture details</p>
                  <p className="mt-2">
                    Format: {mode === "video" ? "WebM video" : "JPEG photo"}
                  </p>
                  <p>Preview file size is shown after capture.</p>
                  {capturedMedia && (
                    <PreviewStats previewUrl={capturedMedia.previewUrl} />
                  )}
                </div>
              </aside>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-sm text-slate-300">Recent published</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">
                  Your last shares
                </h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-cyan-100">
                sync with Sanity
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {publishedItems.length > 0 ? (
                publishedItems.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-[1.5rem] border border-white/10 bg-slate-950/55 p-4"
                  >
                    <div className="flex items-center justify-between text-sm text-slate-300">
                      <span className="font-medium text-white">
                        {item.kind === "video" ? "Video" : "Photo"}
                      </span>
                      <span>
                        {new Date(item.createdAt).toLocaleTimeString("hr-HR")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-emerald-200">
                      {item.status}
                    </p>
                    <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
                      {item.kind === "video" ? (
                        <video
                          src={item.url}
                          controls
                          className="h-56 w-full object-cover"
                        />
                      ) : (
                        <img
                          src={item.url}
                          alt="Published item"
                          className="h-56 w-full object-cover"
                        />
                      )}
                    </div>
                  </article>
                ))
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

            <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              <p className="text-white">Navigation</p>
              <p className="mt-2">Guest route: {guestPath}</p>
              <p>Dashboard route: {dashboardPath}</p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function PreviewStats({ previewUrl }: { previewUrl: string }) {
  const [stats, setStats] = useState<{ size?: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function getStats() {
      try {
        const response = await fetch(previewUrl);
        const blob = await response.blob();
        if (!cancelled) setStats({ size: blob.size });
      } catch {
        if (!cancelled) setStats(null);
      }
    }

    void getStats();
    return () => {
      cancelled = true;
    };
  }, [previewUrl]);

  if (!stats?.size) return null;

  return <p className="mt-2">Approx size: {formatBytes(stats.size)}</p>;
}

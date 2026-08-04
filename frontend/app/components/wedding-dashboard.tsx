"use client";

import Image from "next/image";
import { useState } from "react";

type DashboardMedia = {
  _id: string;
  _createdAt: string;
  guestName?: string;
  mediaKind?: "image" | "video";
  status?: string;
  visibleInGallery?: boolean;
  caption?: string;
  image?: {
    asset?: { url?: string };
  };
  video?: {
    asset?: { url?: string };
  };
};

type WeddingEvent = {
  title: string;
  coupleNames?: string;
  dashboardSlug?: string;
};

type DashboardSummary = {
  recent: DashboardMedia[];
};

function formatDate(value?: string) {
  if (!value) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("hr-HR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function WeddingDashboard({
  event,
  summary,
  dashboardPath,
  guestPath,
}: {
  event: WeddingEvent;
  summary: DashboardSummary;
  dashboardPath: string;
  guestPath: string;
}) {
  const [liveSummary, setLiveSummary] = useState<DashboardSummary>(summary);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAction(id: string, action: "approve") {
    setWorkingId(id);
    setError(null);

    try {
      const response = await fetch(`/api/dashboard/submissions/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const result = (await response.json()) as {
        ok: boolean;
        error?: string;
        summary?: DashboardSummary;
      };

      if (!response.ok || !result.ok || !result.summary) {
        throw new Error(result.error ?? "Failed to update submission.");
      }

      setLiveSummary(result.summary);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Failed to update submission.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  function getAssetUrl(item: DashboardMedia) {
    if (item.mediaKind === "video") {
      return item.video?.asset?.url ?? "";
    }

    return item.image?.asset?.url ?? "";
  }

  function sanitizeFilePart(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  }

  function guessExtension(item: DashboardMedia, mimeType: string, url: string) {
    if (item.mediaKind === "video") {
      if (mimeType.includes("mp4") || url.includes(".mp4")) return "mp4";
      if (mimeType.includes("quicktime") || url.includes(".mov")) {
        return "mov";
      }
      return "webm";
    }

    if (mimeType.includes("png") || url.includes(".png")) return "png";
    if (mimeType.includes("webp") || url.includes(".webp")) return "webp";
    return "jpg";
  }

  async function downloadContentZip() {
    const contentItems = liveSummary.recent
      .map((item) => ({ item, url: getAssetUrl(item) }))
      .filter((entry) => Boolean(entry.url));

    if (contentItems.length === 0) {
      setError("Nema dostupnog sadrzaja za preuzimanje.");
      return;
    }

    setIsDownloadingZip(true);
    setError(null);

    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      await Promise.all(
        contentItems.map(async ({ item, url }, index) => {
          const response = await fetch(url);

          if (!response.ok) {
            throw new Error("Ne mogu preuzeti sve datoteke za ZIP arhivu.");
          }

          const blob = await response.blob();
          const ext = guessExtension(item, blob.type || "", url);
          const guest = sanitizeFilePart(item.guestName ?? "guest") || "guest";
          const createdAt = item._createdAt
            ? item._createdAt.replace(/[:T]/g, "-").slice(0, 19)
            : `item-${index + 1}`;
          const mediaType = item.mediaKind === "video" ? "video" : "photo";

          zip.file(
            `${mediaType}/${createdAt}-${guest}-${item._id.slice(-6)}.${ext}`,
            blob,
          );
        }),
      );

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const anchor = document.createElement("a");
      const slugPart =
        sanitizeFilePart(event.dashboardSlug ?? "wedding") || "wedding";

      anchor.href = downloadUrl;
      anchor.download = `${slugPart}-media.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(downloadUrl);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Neuspjelo preuzimanje ZIP arhive.",
      );
    } finally {
      setIsDownloadingZip(false);
    }
  }

  async function deleteSubmission(id: string) {
    setWorkingId(id);
    setError(null);

    try {
      const response = await fetch(`/api/dashboard/submissions/${id}`, {
        method: "DELETE",
      });

      const result = (await response.json()) as {
        ok: boolean;
        error?: string;
        summary?: DashboardSummary;
      };

      if (!response.ok || !result.ok || !result.summary) {
        throw new Error(result.error ?? "Failed to delete submission.");
      }

      setLiveSummary(result.summary);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Failed to delete submission.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#08111f] text-slate-50">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 sm:px-10 lg:px-12">
        <header className="rounded-[2rem] border border-white/10 bg-white/5 px-6 py-5 backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-100/80">
                Control panel
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {event.coupleNames ?? event.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Dashboard link: {dashboardPath} · Guest link: {guestPath}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <button
                type="button"
                onClick={() => void downloadContentZip()}
                disabled={isDownloadingZip || liveSummary.recent.length === 0}
                className="rounded-full border border-cyan-200/50 bg-cyan-300/15 px-5 py-2.5 font-semibold text-cyan-100 transition hover:bg-cyan-300/25 disabled:opacity-50"
              >
                {isDownloadingZip ? "Pripremam ZIP..." : "Preuzmi ZIP"}
              </button>
            </div>
          </div>
        </header>

        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <p className="text-sm text-slate-300">Sadrzaj gostiju</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">
                Upravljanje objavama
              </h2>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-2xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </p>
          )}

          <div className="mt-5 space-y-4">
            {liveSummary.recent.length > 0 ? (
              liveSummary.recent.map((item) => (
                <article
                  key={item._id}
                  className="flex flex-col gap-4 rounded-[1.5rem] border border-white/10 bg-slate-950/55 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-900">
                      {item.mediaKind === "video" && item.video?.asset?.url ? (
                        <video
                          src={item.video.asset.url}
                          className="h-full w-full object-cover"
                          muted
                          playsInline
                        />
                      ) : item.image?.asset?.url ? (
                        <Image
                          src={item.image.asset.url}
                          alt={item.guestName ?? "Guest media"}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : null}
                    </div>
                    <div>
                      <p className="font-medium text-white">
                        {item.guestName ?? "Guest submission"}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {item.mediaKind ?? "image"}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatDate(item._createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => void runAction(item._id, "approve")}
                      disabled={workingId === item._id}
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-white transition hover:bg-white/10 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteSubmission(item._id)}
                      disabled={workingId === item._id}
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-white transition hover:bg-white/10 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 px-6 py-12 text-center text-sm leading-7 text-slate-300">
                Jos nema poslanog sadrzaja. Kad gosti krenu slati slike i videe,
                ovdje ce se pojaviti kartice sa akcijama Approve i Delete.
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

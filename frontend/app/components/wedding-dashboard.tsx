"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

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
  guestUploadEnabled?: boolean;
  autoPublishApproved?: boolean;
  moderationMode?: string;
  maxVideoSeconds?: number;
  accentColor?: string;
  welcomeCopy?: string;
  ceremonyDate?: string;
};

type DashboardSummary = {
  total: number;
  pending: number;
  approved: number;
  hidden: number;
  rejected: number;
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
  eventId,
  dashboardPath,
  guestPath,
}: {
  event: WeddingEvent;
  summary: DashboardSummary;
  eventId?: string;
  dashboardPath: string;
  guestPath: string;
}) {
  const [liveSummary, setLiveSummary] = useState<DashboardSummary>(summary);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guestUploadEnabled, setGuestUploadEnabled] = useState(
    event.guestUploadEnabled ?? true,
  );
  const [isTogglingUploads, setIsTogglingUploads] = useState(false);

  const cards = useMemo(
    () => [
      { label: "Total", value: liveSummary.total },
      { label: "Pending", value: liveSummary.pending },
      { label: "Approved", value: liveSummary.approved },
      { label: "Hidden", value: liveSummary.hidden },
      { label: "Rejected", value: liveSummary.rejected },
    ],
    [liveSummary],
  );

  async function runAction(
    id: string,
    action: "approve" | "hide" | "markVisible",
  ) {
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

  async function toggleGuestUploads() {
    if (!eventId) return;

    setIsTogglingUploads(true);
    setError(null);

    try {
      const response = await fetch(`/api/dashboard/events/${eventId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guestUploadEnabled: !guestUploadEnabled }),
      });

      const result = (await response.json()) as {
        ok: boolean;
        error?: string;
        guestUploadEnabled?: boolean;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Failed to update upload visibility.");
      }

      setGuestUploadEnabled(result.guestUploadEnabled ?? !guestUploadEnabled);
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Failed to update upload visibility.",
      );
    } finally {
      setIsTogglingUploads(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#08111f] text-slate-50">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 sm:px-10 lg:px-12">
        <header className="rounded-[2rem] border border-white/10 bg-white/5 px-6 py-5 backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-100/80">
                Bridal control panel
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {event.coupleNames ?? event.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Dashboard link: {dashboardPath} · Guest link: {guestPath}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                Moderation: {event.moderationMode ?? "review"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                Guest uploads: {guestUploadEnabled ? "on" : "off"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                Auto publish: {event.autoPublishApproved ? "on" : "off"}
              </span>
            </div>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {cards.map((card) => (
            <article
              key={card.label}
              className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl"
            >
              <p className="text-sm text-slate-300">{card.label}</p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {card.value}
              </p>
            </article>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-sm text-slate-300">Moderation queue</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">
                  Review content before it goes live
                </h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-amber-100">
                {event.maxVideoSeconds ?? 10}s max
              </span>
            </div>

            {error && (
              <p className="mt-4 rounded-2xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void toggleGuestUploads()}
                disabled={!eventId || isTogglingUploads}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                {isTogglingUploads
                  ? "Updating..."
                  : guestUploadEnabled
                    ? "Disable guest gallery visibility"
                    : "Enable guest gallery visibility"}
              </button>
              <p className="text-sm text-slate-300">
                When disabled, guest uploads are blocked and gallery items are
                hidden from public view.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              {liveSummary.recent.length > 0 ? (
                liveSummary.recent.map((item) => (
                  <article
                    key={item._id}
                    className="flex flex-col gap-4 rounded-[1.5rem] border border-white/10 bg-slate-950/55 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-900">
                        {item.mediaKind === "video" &&
                        item.video?.asset?.url ? (
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
                          {item.mediaKind ?? "image"} ·{" "}
                          {item.status ?? "pending"}
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
                        onClick={() => void runAction(item._id, "hide")}
                        disabled={workingId === item._id}
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-white transition hover:bg-white/10 disabled:opacity-50"
                      >
                        Hide
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteSubmission(item._id)}
                        disabled={workingId === item._id}
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-white transition hover:bg-white/10 disabled:opacity-50"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => void runAction(item._id, "markVisible")}
                        disabled={workingId === item._id}
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-white transition hover:bg-white/10 disabled:opacity-50"
                      >
                        Mark visible
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 px-6 py-12 text-center text-sm leading-7 text-slate-300">
                  Nema sadržaja u redu za pregled. Kad gosti krenu slati slike i
                  kratke video zapise, ovdje će se pojaviti kartice za approve,
                  hide i delete.
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-[#111b33]/80 p-6 backdrop-blur-xl">
              <p className="text-sm text-slate-300">Wedding settings</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">
                What the couple can tune
              </h2>
              <div className="mt-5 space-y-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  Hero message and theme color come from the event document.
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  Guest uploads can be enabled or disabled per wedding.
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  Moderation mode controls whether content appears immediately
                  or only after review.
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  Additional settings can later include music, branding, sticker
                  packs, and QR styling.
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <p className="text-sm text-slate-300">Wedding details</p>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  Ceremony date:{" "}
                  <span className="text-white">
                    {formatDate(event.ceremonyDate)}
                  </span>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  Active dashboard slug:{" "}
                  <span className="text-white">
                    {event.dashboardSlug ?? "unset"}
                  </span>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  Accent color:{" "}
                  <span className="text-white">
                    {event.accentColor ?? "unset"}
                  </span>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}

import Image from "next/image";

type GalleryMedia = {
  _id: string;
  _createdAt: string;
  _updatedAt: string;
  approvedAt?: string;
  guestName?: string;
  mediaKind?: "image" | "video";
  status?: string;
  visibleInGallery?: boolean;
  caption?: string;
  reviewNote?: string;
  durationSeconds?: number;
  image?: {
    alt?: string;
    asset?: {
      url?: string;
      metadata?: {
        lqip?: string;
        dimensions?: {
          width?: number;
          height?: number;
        };
      };
    };
  };
  video?: {
    asset?: {
      url?: string;
      mimeType?: string;
      originalFilename?: string;
      size?: number;
    };
  };
};

type WeddingEvent = {
  _id: string;
  title: string;
  coupleNames?: string;
  slug?: string;
  dashboardSlug?: string;
  welcomeCopy?: string;
  ceremonyDate?: string;
  guestUploadEnabled?: boolean;
  autoPublishApproved?: boolean;
  moderationMode?: string;
  maxVideoSeconds?: number;
  accentColor?: string;
  isActive?: boolean;
  notes?: string;
  heroImage?: {
    alt?: string;
    asset?: {
      url?: string;
      metadata?: {
        lqip?: string;
      };
    };
  };
};

function formatDate(value?: string) {
  if (!value) {
    return "Uskoro";
  }

  return new Intl.DateTimeFormat("hr-HR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatGalleryLabel(media: GalleryMedia) {
  if (media.mediaKind === "video") {
    return "Video";
  }

  return "Fotografija";
}

function getEventTheme(accentColor?: string) {
  const base = accentColor?.trim() || "#e8caa6";
  return {
    border: `rgba(255,255,255,0.12)`,
    accent: base,
  };
}

export function WeddingExperience({
  event,
  gallery,
  guestPath,
  dashboardPath,
}: {
  event: WeddingEvent | null;
  gallery: GalleryMedia[];
  guestPath: string;
  dashboardPath: string;
}) {
  const theme = getEventTheme(event?.accentColor);
  const coupleLabel = event?.coupleNames ?? "Mladenci";
  const title = event?.title ?? "Wedding Moments";
  const welcomeCopy =
    event?.welcomeCopy ??
    "Ovo je premium galerija za vjenčanje s jednostavnim guest upload tokom, modernim prikazom i jasnim bridal dashboardom.";
  const hasHero = Boolean(event?.heroImage?.asset?.url);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07111f] text-slate-50">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(244,197,160,0.24),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(45,212,191,0.18),_transparent_28%),linear-gradient(180deg,_#07111f_0%,_#101b33_54%,_#0f172a_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:54px_54px] opacity-20" />

      <section className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-8 sm:px-10 lg:px-12">
        <header className="flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-white/5 px-6 py-5 shadow-2xl shadow-black/20 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-100/80">
              {event?.isActive ? "Active wedding site" : "Wedding showcase"}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {coupleLabel}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              {title} · {welcomeCopy}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <a
              href={guestPath}
              className="rounded-full border border-white/15 bg-white px-4 py-2 font-medium text-slate-950 transition hover:-translate-y-0.5 hover:bg-amber-50"
            >
              Guest link
            </a>
            <a
              href={dashboardPath}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 font-medium text-white transition hover:-translate-y-0.5 hover:bg-white/10"
            >
              Bridal dashboard
            </a>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-stretch">
          <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/55 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
            <div className="absolute inset-0 opacity-60">
              <div className="absolute -left-24 top-10 h-56 w-56 rounded-full bg-amber-300/10 blur-3xl" />
              <div className="absolute right-6 top-4 h-40 w-40 rounded-full bg-cyan-300/10 blur-3xl" />
            </div>

            <div className="relative grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
              <div>
                <div className="inline-flex rounded-full border border-white/12 bg-white/6 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-100">
                  QR guest experience
                </div>
                <h2 className="mt-6 max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Guests scan, preview, decide, and then share the moment.
                </h2>
                <p className="mt-5 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
                  Prikaz je zamišljen za vjenčanja: gosti prvo vide kameru i
                  preview, zatim imaju jasne opcije za objavu, brisanje ili
                  ponovno snimanje. Mladenci sve vide u dashboardu.
                </p>

                <div className="mt-8 flex flex-wrap gap-3 text-sm">
                  <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-slate-200">
                    Max video: {event?.maxVideoSeconds ?? 10}s
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-slate-200">
                    Moderation: {event?.moderationMode ?? "review"}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-slate-200">
                    Theme accent:{" "}
                    <span style={{ color: theme.accent }}>{theme.accent}</span>
                  </span>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/6 p-4 shadow-xl">
                  {hasHero ? (
                    <Image
                      src={event?.heroImage?.asset?.url}
                      alt={event?.heroImage?.alt ?? coupleLabel}
                      width={1200}
                      height={720}
                      className="h-72 w-full rounded-[1.25rem] object-cover"
                    />
                  ) : (
                    <div className="flex h-72 items-end rounded-[1.25rem] bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.2),_transparent_35%),linear-gradient(135deg,_rgba(15,23,42,0.95),_rgba(45,212,191,0.2))] p-5">
                      <div>
                        <p className="text-xs uppercase tracking-[0.34em] text-cyan-100/80">
                          Hero preview
                        </p>
                        <p className="mt-2 max-w-sm text-2xl font-semibold text-white">
                          Ovo mjesto može nositi cover fotografiju para ili
                          cijelog eventa.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    [
                      "Preview",
                      "Prije objave gosti vide sliku ili video lokalno.",
                    ],
                    [
                      "Publish",
                      "Jednim tapom šalju sadržaj u galeriju mladenaca.",
                    ],
                    [
                      "Retake",
                      "Ako nisu zadovoljni, snimaju ponovno bez gubitka.",
                    ],
                  ].map(([titleText, body]) => (
                    <article
                      key={titleText}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300"
                    >
                      <p className="font-semibold text-white">{titleText}</p>
                      <p className="mt-2 leading-6">{body}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <aside className="rounded-[2rem] border border-white/10 bg-[#0b1528]/75 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-sm text-slate-300">Couple dashboard</p>
                <h3 className="mt-1 text-2xl font-semibold text-white">
                  Link for moderation
                </h3>
              </div>
              <div className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(74,222,128,0.9)]" />
            </div>

            <div className="mt-5 space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-white">Guest route</p>
                <p className="mt-2 break-all text-slate-300">{guestPath}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-white">Dashboard route</p>
                <p className="mt-2 break-all text-slate-300">{dashboardPath}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-white">Settings</p>
                <p className="mt-2 leading-6 text-slate-300">
                  Event visibility, moderation mode, auto publish, and the
                  10-second guest video limit all live in the Sanity event
                  document.
                </p>
              </div>
            </div>
          </aside>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-7">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-sm text-slate-300">Approved gallery</p>
                <h3 className="mt-1 text-2xl font-semibold text-white">
                  Live wedding moments
                </h3>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-amber-100">
                {gallery.length} items
              </span>
            </div>

            {gallery.length > 0 ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {gallery.map((media) => (
                  <article
                    key={media._id}
                    className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950/60"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-slate-900">
                      {media.mediaKind === "video" &&
                      media.video?.asset?.url ? (
                        <video
                          controls
                          playsInline
                          preload="metadata"
                          className="h-full w-full object-cover"
                          src={media.video.asset.url}
                        />
                      ) : media.image?.asset?.url ? (
                        <Image
                          src={media.image.asset.url}
                          alt={
                            media.image.alt ??
                            media.guestName ??
                            "Wedding media"
                          }
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                          className="object-cover transition duration-500 hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_35%),linear-gradient(135deg,_rgba(15,23,42,0.95),_rgba(244,197,160,0.22))] p-6 text-center text-slate-100">
                          Missing media
                        </div>
                      )}

                      <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-white backdrop-blur">
                        {formatGalleryLabel(media)}
                      </div>
                    </div>

                    <div className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-white">
                            {media.guestName ?? "Guest upload"}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            {formatDate(media.approvedAt ?? media._createdAt)}
                          </p>
                        </div>
                        <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100">
                          {media.status ?? "pending"}
                        </span>
                      </div>
                      <p className="text-sm leading-6 text-slate-300">
                        {media.caption ??
                          "Guest memory ready for the couple gallery."}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 px-6 py-14 text-center text-sm leading-7 text-slate-300">
                Trenutno nema odobrenih objava. Kad uzvanici pošalju sadržaj,
                ovdje će se pojaviti photo i video wall u real time stilu.
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
              <p className="text-sm text-slate-300">Camera booth preview</p>
              <div className="mt-4 rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">
                    Preview
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.24em] text-cyan-100">
                    Live
                  </span>
                </div>
                <div className="mt-4 grid gap-3">
                  {["Objavi", "Izbriši", "Ponovno uslikaj / snimi"].map(
                    (label) => (
                      <button
                        key={label}
                        type="button"
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-medium text-white transition hover:bg-white/10"
                      >
                        {label}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-[#111b33]/80 p-6 text-sm leading-7 text-slate-300 shadow-2xl shadow-black/20 backdrop-blur-xl">
              <p className="text-white">How the couple manages the feed</p>
              <ul className="mt-3 space-y-3">
                <li>
                  • Content can stay hidden until review, then published from
                  the dashboard.
                </li>
                <li>
                  • Approve, hide, or reject any photo/video that does not fit
                  the event.
                </li>
                <li>
                  • Additional settings such as branding, QR style, and guest
                  instructions belong to the wedding event document.
                </li>
              </ul>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

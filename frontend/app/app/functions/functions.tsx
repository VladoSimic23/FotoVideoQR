export function formatDuration(durationSeconds: number) {
  const safeSeconds = Math.max(0, Number(durationSeconds.toFixed(1)));
  return `${safeSeconds.toFixed(1)}s`;
}

export function getCoupleInitials(coupleNames: string) {
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

export function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5zm2.5-.5a.5.5 0 0 0-.5.5v8.38l3.6-3.61a1.4 1.4 0 0 1 1.98 0l1.2 1.2 2.6-2.59a1.4 1.4 0 0 1 1.98 0L18 9.58V5.5a.5.5 0 0 0-.5-.5zm11.5 7.41-2.02-2.02-3.2 3.2a1 1 0 0 1-1.42 0L10.59 12l-4.59 4.58v1.92a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5zM9 8.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0"
      />
    </svg>
  );
}

export function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h8A2.5 2.5 0 0 1 17 6.5v2.18l2.87-1.76A1.5 1.5 0 0 1 22 8.2v7.6a1.5 1.5 0 0 1-2.13 1.28L17 15.32v2.18a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 4 17.5zm11 6.47 4.82 2.96a.5.5 0 0 0 .18.07V8a.5.5 0 0 0-.18.07L15 11.03z"
      />
    </svg>
  );
}

export function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M14.78 5.47a.75.75 0 0 1 0 1.06L9.31 12l5.47 5.47a.75.75 0 1 1-1.06 1.06l-6-6a.75.75 0 0 1 0-1.06l6-6a.75.75 0 0 1 1.06 0"
      />
    </svg>
  );
}

export function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9.22 5.47a.75.75 0 0 1 1.06 0l6 6a.75.75 0 0 1 0 1.06l-6 6a.75.75 0 1 1-1.06-1.06L14.69 12 9.22 6.53a.75.75 0 0 1 0-1.06"
      />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.72 6.72a.75.75 0 0 1 1.06 0L12 10.94l4.22-4.22a.75.75 0 1 1 1.06 1.06L13.06 12l4.22 4.22a.75.75 0 1 1-1.06 1.06L12 13.06l-4.22 4.22a.75.75 0 1 1-1.06-1.06L10.94 12 6.72 7.78a.75.75 0 0 1 0-1.06"
      />
    </svg>
  );
}

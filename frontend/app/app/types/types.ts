export type CameraFacing = "user" | "environment";

export type CapturedMedia = {
  kind: "photo" | "video";
  previewUrl: string;
  file: File;
  durationSeconds?: number;
};

export type PublishedItem = {
  id: string;
  kind: "photo" | "video";
  url: string;
  durationSeconds?: number;
  guestName?: string;
  caption?: string;
};

export type GalleryFilter = "all" | "photo" | "video";

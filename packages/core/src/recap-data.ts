import { z } from "zod";

/**
 * Version of the RecapData shape. Bump it on any breaking change. Cache keys
 * include it, so a bump never serves old entries with the wrong shape
 * (ADR-0004).
 */
export const RECAP_SCHEMA_VERSION = 1;

/**
 * Optional parts of RecapData that cost extra upstream calls. Templates
 * declare the ones they need and the API computes only those (ADR-0003).
 */
export const dataFeatureSchema = z.enum([
  "minutes",
  "activity",
  "artistImages",
]);
export type DataFeature = z.infer<typeof dataFeatureSchema>;

const count = z.int().nonnegative();

// Satori and the image proxy need absolute URLs.
const imageUrl = z.url({ protocol: /^https?$/ });

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const recapUserSchema = z.object({
  name: z.string().min(1),
  image: imageUrl.optional(),
});

export const recapPeriodSchema = z
  .object({
    year: z.int().min(2002),
    month: z.int().min(1).max(12),
    /** IANA time zone name. It sets the month boundaries. */
    timezone: z.string().refine(isTimeZone, "Unknown IANA time zone"),
    /** Start of the month in `timezone`, inclusive. ISO 8601 with offset. */
    from: z.iso.datetime({ offset: true }),
    /** End of the month in `timezone`, exclusive. ISO 8601 with offset. */
    to: z.iso.datetime({ offset: true }),
  })
  .refine((period) => Date.parse(period.from) < Date.parse(period.to), {
    message: "`from` must be before `to`",
    path: ["to"],
  });

export const recapTotalsSchema = z
  .object({
    scrobbles: count,
    uniqueArtists: count,
    uniqueTracks: count,
    /** Present only when the `minutes` feature is requested. */
    estimatedMinutes: count.optional(),
  })
  .refine((totals) => totals.uniqueArtists <= totals.scrobbles, {
    message: "`uniqueArtists` cannot exceed `scrobbles`",
    path: ["uniqueArtists"],
  })
  .refine((totals) => totals.uniqueTracks <= totals.scrobbles, {
    message: "`uniqueTracks` cannot exceed `scrobbles`",
    path: ["uniqueTracks"],
  });

export const topArtistSchema = z.object({
  name: z.string().min(1),
  playcount: count,
  /** Present only when the `artistImages` feature is requested. */
  image: imageUrl.optional(),
});

export const topTrackSchema = z.object({
  name: z.string().min(1),
  artist: z.string().min(1),
  playcount: count,
  image: imageUrl.optional(),
});

export const topAlbumSchema = z.object({
  name: z.string().min(1),
  artist: z.string().min(1),
  playcount: count,
  image: imageUrl.optional(),
});

export const recapActivitySchema = z.object({
  /** Scrobbles per weekday in `timezone`. Index 0 is Monday (ISO 8601). */
  byWeekday: z.array(count).length(7),
  /** Scrobbles per hour of day in `timezone`. Index 0 is 00:00 to 00:59. */
  byHour: z.array(count).length(24),
  /** Day with the most scrobbles, or null when the month has none. */
  peakDay: z
    .object({
      date: z.iso.date(),
      scrobbles: count,
    })
    .nullable(),
});

export const recapDataSchema = z.object({
  schemaVersion: z.literal(RECAP_SCHEMA_VERSION),
  user: recapUserSchema,
  period: recapPeriodSchema,
  totals: recapTotalsSchema,
  /** Ordered by playcount, highest first. */
  topArtists: z.array(topArtistSchema),
  /** Ordered by playcount, highest first. */
  topTracks: z.array(topTrackSchema),
  /** Ordered by playcount, highest first. */
  topAlbums: z.array(topAlbumSchema),
  /** Present only when the `activity` feature is requested. */
  activity: recapActivitySchema.optional(),
});

export type RecapUser = z.infer<typeof recapUserSchema>;
export type RecapPeriod = z.infer<typeof recapPeriodSchema>;
export type RecapTotals = z.infer<typeof recapTotalsSchema>;
export type TopArtist = z.infer<typeof topArtistSchema>;
export type TopTrack = z.infer<typeof topTrackSchema>;
export type TopAlbum = z.infer<typeof topAlbumSchema>;
export type RecapActivity = z.infer<typeof recapActivitySchema>;
export type RecapData = z.infer<typeof recapDataSchema>;

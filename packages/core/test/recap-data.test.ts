import { describe, expect, expectTypeOf, it } from "vitest";
import {
  type DataFeature,
  dataFeatureSchema,
  RECAP_SCHEMA_VERSION,
  type RecapData,
  recapDataSchema,
} from "../src/index.js";

// Handwritten RecapData samples. They describe our own contract, not Last.fm
// payloads, so they do not come from captured fixtures.
function fullSample(): RecapData {
  return {
    schemaVersion: 1,
    user: { name: "rj", image: "https://example.com/avatar.png" },
    period: {
      year: 2026,
      month: 8,
      timezone: "America/Sao_Paulo",
      from: "2026-08-01T00:00:00-03:00",
      to: "2026-09-01T00:00:00-03:00",
    },
    totals: {
      scrobbles: 1200,
      uniqueArtists: 180,
      uniqueTracks: 640,
      estimatedMinutes: 4100,
    },
    topArtists: [
      { name: "Artist A", playcount: 90, image: "https://example.com/a.jpg" },
      { name: "Artist B", playcount: 75 },
    ],
    topTracks: [{ name: "Track A", artist: "Artist A", playcount: 30 }],
    topAlbums: [
      {
        name: "Album A",
        artist: "Artist A",
        playcount: 60,
        image: "https://example.com/album.jpg",
      },
    ],
    activity: {
      byWeekday: [200, 150, 180, 170, 190, 160, 150],
      byHour: Array.from({ length: 24 }, () => 50),
      peakDay: { date: "2026-08-15", scrobbles: 95 },
    },
  };
}

function minimalSample(): RecapData {
  const { activity: _activity, ...rest } = fullSample();
  return {
    ...rest,
    user: { name: "rj" },
    totals: { scrobbles: 1200, uniqueArtists: 180, uniqueTracks: 640 },
    topArtists: [{ name: "Artist A", playcount: 90 }],
  };
}

function emptyMonthSample(): RecapData {
  return {
    ...fullSample(),
    totals: { scrobbles: 0, uniqueArtists: 0, uniqueTracks: 0 },
    topArtists: [],
    topTracks: [],
    topAlbums: [],
    activity: {
      byWeekday: [0, 0, 0, 0, 0, 0, 0],
      byHour: Array.from({ length: 24 }, () => 0),
      peakDay: null,
    },
  };
}

// Returns the issue paths of a failed parse, as dotted strings.
function issuePaths(input: unknown): string[] {
  const result = recapDataSchema.safeParse(input);
  expect(result.success).toBe(false);
  return result.error?.issues.map((issue) => issue.path.join(".")) ?? [];
}

describe("recapDataSchema", () => {
  describe("accepts", () => {
    it("a full sample with every optional feature", () => {
      expect(recapDataSchema.parse(fullSample())).toEqual(fullSample());
    });

    it("a minimal sample with no optional features", () => {
      expect(recapDataSchema.parse(minimalSample())).toEqual(minimalSample());
    });

    it("an empty month", () => {
      expect(recapDataSchema.safeParse(emptyMonthSample()).success).toBe(true);
    });

    it("a JSON round trip", () => {
      const json = JSON.parse(JSON.stringify(fullSample())) as unknown;
      expect(recapDataSchema.parse(json)).toEqual(fullSample());
    });

    it("the UTC time zone", () => {
      const sample = fullSample();
      sample.period = {
        ...sample.period,
        timezone: "UTC",
        from: "2026-08-01T00:00:00Z",
        to: "2026-09-01T00:00:00Z",
      };
      expect(recapDataSchema.safeParse(sample).success).toBe(true);
    });
  });

  describe("rejects", () => {
    it("another schema version", () => {
      expect(issuePaths({ ...fullSample(), schemaVersion: 2 })).toEqual([
        "schemaVersion",
      ]);
    });

    it("a month out of range", () => {
      const sample = fullSample();
      expect(
        issuePaths({ ...sample, period: { ...sample.period, month: 13 } }),
      ).toEqual(["period.month"]);
    });

    it("an unknown time zone", () => {
      const sample = fullSample();
      expect(
        issuePaths({
          ...sample,
          period: { ...sample.period, timezone: "Mars/Olympus_Mons" },
        }),
      ).toEqual(["period.timezone"]);
    });

    it("a datetime without offset", () => {
      const sample = fullSample();
      expect(
        issuePaths({
          ...sample,
          period: { ...sample.period, from: "2026-08-01T00:00:00" },
        }),
      ).toEqual(["period.from"]);
    });

    it("`from` not before `to`", () => {
      const sample = fullSample();
      expect(
        issuePaths({
          ...sample,
          period: { ...sample.period, to: sample.period.from },
        }),
      ).toEqual(["period.to"]);
    });

    it("a relative image URL", () => {
      const sample = fullSample();
      expect(
        issuePaths({
          ...sample,
          topAlbums: [{ ...sample.topAlbums[0], image: "/covers/a.jpg" }],
        }),
      ).toEqual(["topAlbums.0.image"]);
    });

    it("a non-http image URL", () => {
      const sample = fullSample();
      expect(
        issuePaths({
          ...sample,
          user: { name: "rj", image: "data:image/png;base64,AAAA" },
        }),
      ).toEqual(["user.image"]);
    });

    it("activity arrays of the wrong length", () => {
      const sample = emptyMonthSample();
      expect(
        issuePaths({
          ...sample,
          activity: {
            byWeekday: [0, 0, 0, 0, 0, 0],
            byHour: Array.from({ length: 23 }, () => 0),
            peakDay: null,
          },
        }),
      ).toEqual(["activity.byWeekday", "activity.byHour"]);
    });

    it("negative and fractional counts", () => {
      const sample = fullSample();
      expect(
        issuePaths({
          ...sample,
          topTracks: [{ name: "Track A", artist: "Artist A", playcount: -1 }],
          topArtists: [{ name: "Artist A", playcount: 1.5 }],
        }),
      ).toEqual(["topArtists.0.playcount", "topTracks.0.playcount"]);
    });

    it("unique counts above the scrobble count", () => {
      const sample = fullSample();
      expect(
        issuePaths({
          ...sample,
          totals: { scrobbles: 10, uniqueArtists: 11, uniqueTracks: 12 },
        }),
      ).toEqual(["totals.uniqueArtists", "totals.uniqueTracks"]);
    });

    it("a missing required field", () => {
      const { topAlbums: _topAlbums, ...rest } = fullSample();
      expect(issuePaths(rest)).toEqual(["topAlbums"]);
    });
  });

  it("uses the exported schema version", () => {
    expect(fullSample().schemaVersion).toBe(RECAP_SCHEMA_VERSION);
    expectTypeOf<RecapData["schemaVersion"]>().toEqualTypeOf<1>();
  });
});

describe("dataFeatureSchema", () => {
  it("names the optional, costly parts of RecapData", () => {
    expect(dataFeatureSchema.options).toEqual([
      "minutes",
      "activity",
      "artistImages",
    ]);
    expectTypeOf<DataFeature>().toEqualTypeOf<
      "minutes" | "activity" | "artistImages"
    >();
  });

  it("rejects an unknown feature", () => {
    expect(dataFeatureSchema.safeParse("genres").success).toBe(false);
  });
});

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildTweet, getLastPostedRelease, saveLastPostedRelease } from "./bot.js";

// ── Shared fixtures ───────────────────────────────────────────────────────────

const BASE_RELEASE = {
  tag_name: "v3.18.0",
  name: "v3.18.0",
  html_url: "https://github.com/payloadcms/payload/releases/tag/v3.18.0",
  body: "",
};

// ── buildTweet ────────────────────────────────────────────────────────────────

describe("buildTweet", () => {
  it("includes the tag name", () => {
    expect(buildTweet(BASE_RELEASE)).toContain("v3.18.0");
  });

  it("includes the release URL", () => {
    expect(buildTweet(BASE_RELEASE)).toContain(BASE_RELEASE.html_url);
  });

  it("includes the hashtags", () => {
    const tweet = buildTweet(BASE_RELEASE);
    expect(tweet).toContain("#PayloadCMS");
    expect(tweet).toContain("#HeadlessCMS");
  });

  it("stays within 280 characters for an empty body", () => {
    expect(buildTweet(BASE_RELEASE).length).toBeLessThanOrEqual(280);
  });

  it("stays within 280 characters for a very long body", () => {
    const release = { ...BASE_RELEASE, body: "A".repeat(500) };
    expect(buildTweet(release).length).toBeLessThanOrEqual(280);
  });

  it("includes the first meaningful line of the body", () => {
    const release = {
      ...BASE_RELEASE,
      body: "Fixed a critical bug.",
    };
    expect(buildTweet(release)).toContain("Fixed a critical bug.");
  });

  it("skips markdown headings when picking the snippet", () => {
    const release = {
      ...BASE_RELEASE,
      body: "## What Changed\n\nFixed a critical bug.",
    };
    const tweet = buildTweet(release);
    expect(tweet).not.toContain("## What Changed");
    expect(tweet).toContain("Fixed a critical bug.");
  });

  it("strips inline markdown from the snippet", () => {
    const release = {
      ...BASE_RELEASE,
      body: "**Important** fix for `crash` on startup.",
    };
    const tweet = buildTweet(release);
    expect(tweet).not.toContain("**");
    expect(tweet).not.toContain("`");
    expect(tweet).toContain("Important");
    expect(tweet).toContain("crash");
  });

  it("converts markdown links to plain text in the snippet", () => {
    const release = {
      ...BASE_RELEASE,
      body: "See the [migration guide](https://example.com) for details.",
    };
    const tweet = buildTweet(release);
    expect(tweet).toContain("migration guide");
    expect(tweet).not.toContain("https://example.com");
  });

  it("handles a null body without throwing", () => {
    const release = { ...BASE_RELEASE, body: null };
    const tweet = buildTweet(release);
    expect(tweet).toContain("v3.18.0");
    expect(tweet.length).toBeLessThanOrEqual(280);
  });

  it("truncates a long body line with an ellipsis", () => {
    const release = { ...BASE_RELEASE, body: "B".repeat(300) };
    const tweet = buildTweet(release);
    expect(tweet).toContain("…");
    expect(tweet.length).toBeLessThanOrEqual(280);
  });
});

// ── persistence helpers ───────────────────────────────────────────────────────

describe("last-release persistence", () => {
  it("round-trips a tag through save / read", () => {
    const tag = "v99.0.0-test";
    saveLastPostedRelease(tag);
    expect(getLastPostedRelease()).toBe(tag);
  });

  it("ignores comment lines when reading", () => {
    const lastReleaseFile = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "last_release.txt",
    );
    writeFileSync(lastReleaseFile, "# a comment\nv1.2.3\n");
    expect(getLastPostedRelease()).toBe("v1.2.3");
  });
});

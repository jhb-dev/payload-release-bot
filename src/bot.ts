/**
 * Payload CMS Release Bot
 *
 * Checks for a new Payload CMS GitHub release and posts an announcement
 * tweet to X (Twitter) whenever one is found.
 *
 * Required environment variables (unless DRY_RUN=true):
 *   TWITTER_API_KEY             – X API key (consumer key)
 *   TWITTER_API_SECRET          – X API secret (consumer secret)
 *   TWITTER_ACCESS_TOKEN        – X access token
 *   TWITTER_ACCESS_TOKEN_SECRET – X access token secret
 *
 * Optional:
 *   GITHUB_TOKEN – GitHub personal-access token (avoids rate-limiting)
 *   DRY_RUN      – "true" / "1" to print the tweet without posting it
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { TwitterApi } from "twitter-api-v2";

// ── Configuration ─────────────────────────────────────────────────────────────

const GITHUB_REPO = "payloadcms/payload";
const LAST_RELEASE_FILE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "last_release.txt",
);
const MAX_TWEET_LENGTH = 280;
const HASHTAGS = "#PayloadCMS #HeadlessCMS";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GitHubRelease {
  tag_name: string;
  name: string | null;
  html_url: string;
  body: string | null;
}

// ── GitHub helper ─────────────────────────────────────────────────────────────

export async function getLatestRelease(githubToken?: string): Promise<GitHubRelease> {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (githubToken) headers["Authorization"] = `Bearer ${githubToken}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<GitHubRelease>;
}

// ── Persistence helpers ───────────────────────────────────────────────────────

export function getLastPostedRelease(): string | null {
  if (!existsSync(LAST_RELEASE_FILE)) return null;
  const tag = readFileSync(LAST_RELEASE_FILE, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("#"));
  return tag ?? null;
}

export function saveLastPostedRelease(tag: string): void {
  writeFileSync(LAST_RELEASE_FILE, `${tag}\n`);
}

// ── Tweet formatting ──────────────────────────────────────────────────────────

const MD_LINK_RE = /\[([^\]]+)\]\([^)]+\)/g;
const MD_INLINE_RE = /[`*_~]/g;

function firstMeaningfulLine(body: string): string {
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#") || line.startsWith("---") || line.startsWith("===")) continue;
    const cleaned = line.replace(MD_LINK_RE, "$1").replace(MD_INLINE_RE, "").trim();
    if (cleaned) return cleaned;
  }
  return "";
}

/**
 * Build a ≤280-character tweet from a GitHub release object.
 *
 * Format:
 *   🚀 Payload CMS <tag> released!
 *
 *   <first meaningful line from release notes>
 *
 *   🔗 <release URL>
 *
 *   #PayloadCMS #HeadlessCMS
 */
export function buildTweet(release: GitHubRelease): string {
  const { tag_name: tag, html_url: url, body } = release;
  const header = `🚀 Payload CMS ${tag} released!\n\n`;
  const footer = `\n\n🔗 ${url}\n\n${HASHTAGS}`;
  const available = MAX_TWEET_LENGTH - header.length - footer.length;

  let snippet = "";
  if (body && available > 10) {
    const line = firstMeaningfulLine(body);
    if (line) snippet = line.length <= available ? line : `${line.slice(0, available - 1)}…`;
  }

  const tweet = `${header}${snippet}${footer}`;
  return tweet.length > MAX_TWEET_LENGTH ? `${tweet.slice(0, MAX_TWEET_LENGTH - 1)}…` : tweet;
}

// ── X (Twitter) helper ────────────────────────────────────────────────────────

export async function postTweet(text: string): Promise<void> {
  const client = new TwitterApi({
    appKey: process.env["TWITTER_API_KEY"]!,
    appSecret: process.env["TWITTER_API_SECRET"]!,
    accessToken: process.env["TWITTER_ACCESS_TOKEN"]!,
    accessSecret: process.env["TWITTER_ACCESS_TOKEN_SECRET"]!,
  });
  await client.v2.tweet(text);
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function run(): Promise<void> {
  const dryRun = ["1", "true", "yes"].includes((process.env["DRY_RUN"] ?? "").toLowerCase());

  console.log("Fetching latest Payload CMS release from GitHub…");
  const release = await getLatestRelease(process.env["GITHUB_TOKEN"]);
  const { tag_name: tag } = release;
  console.log(`Latest release : ${tag}`);

  const lastPosted = getLastPostedRelease();
  console.log(`Last posted    : ${lastPosted ?? "(none)"}`);

  if (tag === lastPosted) {
    console.log("No new release detected. Nothing to post.");
    return;
  }

  const tweet = buildTweet(release);
  const sep = "-".repeat(40);
  console.log(`\nTweet (${tweet.length} chars):\n${sep}\n${tweet}\n${sep}\n`);

  if (dryRun) {
    console.log("DRY RUN – tweet not sent. Updating last_release.txt.");
    saveLastPostedRelease(tag);
    return;
  }

  console.log("Posting to X…");
  await postTweet(tweet);
  console.log("✅ Tweet posted successfully!");

  saveLastPostedRelease(tag);
  console.log(`Saved '${tag}' as last posted release.`);
}

// Run when executed directly (not imported as a module)
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  run().catch((err: unknown) => {
    console.error("ERROR:", err);
    process.exit(1);
  });
}

# payload-release-bot

A GitHub Actions bot that watches [Payload CMS](https://payloadcms.com) for new releases and automatically posts an announcement tweet to **X (Twitter)** whenever one is published.

---

## How it works

1. A scheduled GitHub Actions workflow runs **once per hour**.
2. It calls the GitHub API to fetch the latest Payload CMS release.
3. It compares the release tag against the value stored in `last_release.txt`.
4. If a new release is detected it:
   - Formats a tweet (≤ 280 chars) that includes the version, the first meaningful line from the release notes, a link, and hashtags.
   - Posts the tweet via the Twitter API v2.
   - Commits the new tag back to `last_release.txt` so the same release is never posted twice.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 22 + |
| pnpm | 10 + |

---

## Repository setup

```bash
# Clone and install dependencies
git clone https://github.com/<your-org>/payload-release-bot.git
cd payload-release-bot
pnpm install
```

### Available scripts

| Command | Description |
|---------|-------------|
| `pnpm start` | Run the bot (requires env vars) |
| `pnpm test` | Run unit tests with Vitest |
| `pnpm run lint` | Lint `src/` with oxlint |
| `pnpm run format` | Format `src/` in-place with oxfmt |
| `pnpm run format:check` | Check formatting without writing |
| `pnpm run build` | Compile TypeScript to `dist/` |

### Dry run (no tweet posted)

```bash
DRY_RUN=true GITHUB_TOKEN=ghp_... pnpm start
```

---

## X (Twitter) setup

### 1 · Create a developer account

1. Go to <https://developer.x.com> and sign in with the X account the bot should post from (create a dedicated account if you prefer).
2. Click **Sign up for Free Account** (or **Developer Portal** if you already have access).
3. Accept the terms, fill in the use-case description (e.g. *"Automated release announcements for the Payload CMS open-source project"*), and submit.

### 2 · Create a project and app

1. In the Developer Portal, open **Projects & Apps → New Project**.
2. Give it a name (e.g. *Payload Release Bot*) and select **Automated**.
3. Create a new **App** inside the project.
4. In the App settings, go to **User authentication settings** and enable **OAuth 1.0a**.
   - App permissions: **Read and Write**
   - App type: **Web App, Automated App or Bot**
   - Callback URI: any placeholder, e.g. `https://localhost`
   - Website URL: your repo URL

### 3 · Generate access tokens

1. In the App settings open the **Keys and tokens** tab.
2. Copy **API Key** and **API Key Secret** (consumer key / secret).
3. Under **Authentication Tokens**, click **Generate** next to *Access Token and Secret*.
   - Make sure the access level shown is **Read and Write** — if it says *Read only* regenerate after updating the app permissions.
4. Copy **Access Token** and **Access Token Secret**.

> **Keep these values secret.** They are only shown once; store them somewhere safe before closing the page.

### 4 · Set up your X profile

Give the bot a recognisable identity before its first post:

| Setting | Suggested value |
|---------|----------------|
| **Display name** | Payload CMS Releases |
| **Username** | `@payloadreleases` (or similar — check availability) |
| **Bio** | `🤖 Automated release announcements for @payloadcms — powered by GitHub Actions` |
| **Profile picture** | Download the official Payload logo from <https://github.com/payloadcms/payload/blob/main/packages/ui/src/assets/payload-favicon.svg> and upload it (convert to PNG/JPG first) |
| **Website** | `https://github.com/payloadcms/payload` |

---

## GitHub secrets

Add the four X credentials as **repository secrets** (Settings → Secrets and variables → Actions → New repository secret):

| Secret name | Value |
|-------------|-------|
| `TWITTER_API_KEY` | API Key |
| `TWITTER_API_SECRET` | API Key Secret |
| `TWITTER_ACCESS_TOKEN` | Access Token |
| `TWITTER_ACCESS_TOKEN_SECRET` | Access Token Secret |

`GITHUB_TOKEN` is provided automatically by GitHub Actions — no action needed.

---

## First-run behaviour

On the very first run the bot will post a tweet about whatever the **current** latest Payload CMS release is (since `last_release.txt` starts empty).

If you want to silently sync to the current release without posting, edit `last_release.txt`, replace its contents with the current latest tag (e.g. `v3.18.0`), and commit:

```bash
echo "v3.18.0" > last_release.txt
git add last_release.txt && git commit -m "chore: initialise last posted release" && git push
```

---

## Manual trigger

You can run the workflow at any time from **Actions → Check Payload CMS Releases → Run workflow**. You can also enable **Dry run** mode from that same dialog to preview the tweet without posting it.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `403 Forbidden` from X | App permissions set to *Read only* | Regenerate tokens after enabling *Read and Write* |
| `401 Unauthorized` from X | Wrong or revoked API credentials | Re-generate keys in the Developer Portal and update the secrets |
| Bot posts the same release twice | The commit step failed (e.g. branch protection) | Ensure the `GITHUB_TOKEN` has write access, or disable branch protection rules for bot commits |
| No tweet after a new release | GitHub API rate limit hit without a token | Add a fine-grained PAT as `GITHUB_TOKEN` secret |

---

## Tech stack

- **Runtime**: Node.js 22, TypeScript 5
- **Package manager**: pnpm
- **HTTP / Twitter**: [`twitter-api-v2`](https://github.com/PLhery/node-twitter-api-v2)
- **Testing**: [Vitest](https://vitest.dev)
- **Linting**: [oxlint](https://oxc.rs/docs/guide/usage/linter)
- **Formatting**: [oxfmt](https://oxc.rs/docs/guide/usage/formatter)
- **CI/CD**: GitHub Actions (scheduled + manual)

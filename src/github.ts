import { Octokit } from "@octokit/rest";
import { log } from "@clack/prompts";
import { addToHistory } from "./history.js";
import { sendThankYouEmail } from "./email.js";
import type { RepoRef } from "./resolvers/index.js";

interface ThankMessage {
  title: string;
  body: string;
}

export interface ProfileLinks {
  email?: string;
  blog?: string;
  twitter?: string;
}

export interface ThankResult {
  starred: boolean;
  messageSent: boolean;
  discussionUrl?: string;
  summary: string;
  channel: "discussion" | "issue" | "email" | "star-only";
  profileLinks?: ProfileLinks;
}

export interface ThankOptions {
  dryRun?: boolean;
  packageName?: string;
  nonInteractive?: boolean;
}

export async function thankPackage(
  token: string,
  ref: RepoRef,
  message: ThankMessage,
  options: ThankOptions = {}
): Promise<ThankResult> {
  const { dryRun = false, packageName } = options;
  const pkg = packageName || ref.repo;
  const octokit = new Octokit({ auth: token });
  const { owner, repo } = ref;

  // Dry run — just show what would happen
  if (dryRun) {
    log.info(`Would star ${owner}/${repo}`);
    log.info(`Would post discussion: "${message.title}"`);
    log.message(message.body);
    return {
      starred: false,
      messageSent: false,
      channel: "star-only",
      summary: `[dry-run] Would thank ${owner}/${repo}`,
    };
  }

  // Always star
  let starred = false;
  try {
    await octokit.activity.starRepoForAuthenticatedUser({ owner, repo });
    starred = true;
  } catch (err: any) {
    if (isRateLimited(err)) {
      return handleRateLimit(err);
    }
    if (err.status !== 304) {
      log.warn(`Could not star ${owner}/${repo}: ${err.message}`);
    } else {
      starred = true; // already starred
    }
  }

  // 1. Try Discussion
  const discussionResult = await tryPostDiscussion(octokit, token, ref, message);

  if (discussionResult.sent) {
    await addToHistory({
      repo: `${owner}/${repo}`,
      package: pkg,
      ecosystem: "unknown",
      thankedAt: new Date().toISOString(),
      discussionUrl: discussionResult.url,
      channel: "discussion",
    });

    return {
      starred,
      messageSent: true,
      discussionUrl: discussionResult.url,
      channel: "discussion",
      summary: `Starred and posted a thank-you discussion on ${owner}/${repo}`,
    };
  }

  // 2. Try Issue (automatic, no prompt)
  const issueResult = await tryCreateIssue(octokit, ref, message);

  if (issueResult.sent) {
    await addToHistory({
      repo: `${owner}/${repo}`,
      package: pkg,
      ecosystem: "unknown",
      thankedAt: new Date().toISOString(),
      discussionUrl: issueResult.url,
      channel: "issue",
    });

    return {
      starred,
      messageSent: true,
      discussionUrl: issueResult.url,
      channel: "issue",
      summary: `Starred and opened a thank-you issue on ${owner}/${repo}`,
    };
  }

  // 3. Fetch owner profile for email + profile links
  const profile = await fetchOwnerProfile(octokit, owner);

  // 4. Try email if public email + RESEND_API_KEY
  if (profile.email) {
    const emailSent = await sendThankYouEmail(
      profile.email,
      message.title,
      message.body
    );

    if (emailSent) {
      await addToHistory({
        repo: `${owner}/${repo}`,
        package: pkg,
        ecosystem: "unknown",
        thankedAt: new Date().toISOString(),
        channel: "email",
      });

      return {
        starred,
        messageSent: true,
        channel: "email",
        profileLinks: profile,
        summary: `Starred ${owner}/${repo} and emailed thanks to ${profile.email}`,
      };
    }

    // No API key or send failed — log the address
    log.info(`Maintainer's public email: ${profile.email}`);
  }

  // 5. Star-only fallback
  await addToHistory({
    repo: `${owner}/${repo}`,
    package: pkg,
    ecosystem: "unknown",
    thankedAt: new Date().toISOString(),
    channel: "star-only",
  });

  return {
    starred,
    messageSent: false,
    channel: "star-only",
    profileLinks: profile,
    summary: `Starred ${owner}/${repo} (no message posted)`,
  };
}

function isRateLimited(err: any): boolean {
  return err.status === 403 || err.status === 429;
}

function handleRateLimit(err: any): ThankResult {
  const resetHeader = err.response?.headers?.["x-ratelimit-reset"];
  const retryMsg = resetHeader
    ? ` Try again after ${new Date(Number(resetHeader) * 1000).toLocaleTimeString()}.`
    : "";
  log.error(`Rate limited by GitHub.${retryMsg}`);
  return {
    starred: false,
    messageSent: false,
    channel: "star-only",
    summary: `Rate limited — try again later`,
  };
}

async function tryPostDiscussion(
  octokit: Octokit,
  token: string,
  ref: RepoRef,
  message: ThankMessage
): Promise<{ sent: boolean; url?: string }> {
  const { owner, repo } = ref;

  try {
    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          id
          discussionCategories(first: 10) {
            nodes {
              id
              name
            }
          }
        }
      }
    `;

    const result: any = await octokit.graphql(query, { owner, repo });
    const repoData = result.repository;

    if (
      !repoData.discussionCategories.nodes ||
      repoData.discussionCategories.nodes.length === 0
    ) {
      return { sent: false };
    }

    const categories = repoData.discussionCategories.nodes;
    const generalCategory = categories.find(
      (c: any) => c.name.toLowerCase() === "general"
    );
    const category = generalCategory || categories[0];

    const mutation = `
      mutation($repoId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
        createDiscussion(input: {
          repositoryId: $repoId,
          categoryId: $categoryId,
          title: $title,
          body: $body
        }) {
          discussion {
            url
          }
        }
      }
    `;

    const discussionResult: any = await octokit.graphql(mutation, {
      repoId: repoData.id,
      categoryId: category.id,
      title: message.title,
      body: message.body,
    });

    return {
      sent: true,
      url: discussionResult.createDiscussion.discussion.url,
    };
  } catch {
    return { sent: false };
  }
}

async function tryCreateIssue(
  octokit: Octokit,
  ref: RepoRef,
  message: ThankMessage
): Promise<{ sent: boolean; url?: string }> {
  const { owner, repo } = ref;

  try {
    const { data } = await octokit.issues.create({
      owner,
      repo,
      title: message.title,
      body: message.body,
    });

    return { sent: true, url: data.html_url };
  } catch (err: any) {
    if (err.status === 403 || err.status === 410) {
      // Issues disabled or forbidden — graceful fallthrough
      return { sent: false };
    }
    log.warn(`Could not open issue: ${err.message}`);
    return { sent: false };
  }
}

async function fetchOwnerProfile(
  octokit: Octokit,
  owner: string
): Promise<ProfileLinks> {
  try {
    const { data } = await octokit.users.getByUsername({ username: owner });
    return {
      email: data.email || undefined,
      blog: data.blog || undefined,
      twitter: data.twitter_username
        ? `@${data.twitter_username}`
        : undefined,
    };
  } catch {
    return {};
  }
}

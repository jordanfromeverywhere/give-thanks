import { Octokit } from "@octokit/rest";
import { select, log } from "@clack/prompts";
import { addToHistory } from "./history.js";

interface RepoRef {
  owner: string;
  repo: string;
}

interface ThankMessage {
  title: string;
  body: string;
}

interface ThankResult {
  starred: boolean;
  messageSent: boolean;
  discussionUrl?: string;
  summary: string;
}

export async function thankPackage(
  token: string,
  ref: RepoRef,
  message: ThankMessage
): Promise<ThankResult> {
  const octokit = new Octokit({ auth: token });
  const { owner, repo } = ref;

  // Always star
  let starred = false;
  try {
    await octokit.activity.starRepoForAuthenticatedUser({ owner, repo });
    starred = true;
  } catch (err: any) {
    if (err.status !== 304) {
      log.warn(`Could not star ${owner}/${repo}: ${err.message}`);
    } else {
      starred = true; // already starred
    }
  }

  // Try posting a Discussion
  const discussionResult = await tryPostDiscussion(
    octokit,
    token,
    ref,
    message
  );

  if (discussionResult.sent) {
    await addToHistory({
      repo: `${owner}/${repo}`,
      package: repo,
      ecosystem: "unknown",
      thankedAt: new Date().toISOString(),
      discussionUrl: discussionResult.url,
    });

    return {
      starred,
      messageSent: true,
      discussionUrl: discussionResult.url,
      summary: `Starred and posted a thank-you to ${owner}/${repo}`,
    };
  }

  // Discussions not available — prompt user
  const fallback = await select({
    message: `Discussions aren't available on ${owner}/${repo}. What would you like to do?`,
    options: [
      { value: "issue", label: "Open an issue with your thank-you" },
      { value: "skip", label: "Just star it (already done)" },
    ],
  });

  if (fallback === "issue") {
    try {
      const { data } = await octokit.issues.create({
        owner,
        repo,
        title: message.title,
        body: message.body,
        labels: ["thank-you"],
      });

      await addToHistory({
        repo: `${owner}/${repo}`,
        package: repo,
        ecosystem: "unknown",
        thankedAt: new Date().toISOString(),
        discussionUrl: data.html_url,
      });

      return {
        starred,
        messageSent: true,
        discussionUrl: data.html_url,
        summary: `Starred and opened a thank-you issue on ${owner}/${repo}`,
      };
    } catch (err: any) {
      log.warn(`Could not open issue: ${err.message}`);
    }
  }

  await addToHistory({
    repo: `${owner}/${repo}`,
    package: repo,
    ecosystem: "unknown",
    thankedAt: new Date().toISOString(),
  });

  return {
    starred,
    messageSent: false,
    summary: `Starred ${owner}/${repo} (no message posted)`,
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
    // Get repository ID and discussion categories via GraphQL
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

    // Prefer "General" category, fall back to first available
    const categories = repoData.discussionCategories.nodes;
    const generalCategory = categories.find(
      (c: any) => c.name.toLowerCase() === "general"
    );
    const category = generalCategory || categories[0];

    // Create discussion via GraphQL
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

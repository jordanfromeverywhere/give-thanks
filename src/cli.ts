import { Command } from "commander";
import { thankPackage } from "./github.js";
import type { ProfileLinks } from "./github.js";
import { authenticate } from "./auth.js";
import { resolveRepo } from "./resolvers/index.js";
import { scanDependencies } from "./scan/index.js";
import { getHistory, hasBeenThanked, printHistory } from "./history.js";
import { buildMessage } from "./message.js";
import { multiselect } from "@clack/prompts";
import { intro, outro, spinner, log, isCancel } from "@clack/prompts";

const program = new Command();

program
  .name("give-thanks")
  .description(
    "Thank open source maintainers — star repos and post gratitude in GitHub Discussions"
  )
  .version("0.1.0");

program
  .argument("[package]", "Package name or owner/repo to thank")
  .option("--used-for <description>", "Describe how you use this package")
  .option("--message <text>", "Custom thank-you message")
  .option("--scan [dir]", "Scan project dependencies and pick which to thank")
  .option("--history", "Show your gratitude history")
  .option("--force", "Thank even if already thanked")
  .option("--dry-run", "Show what would happen without posting")
  .option("--non-interactive", "Skip all prompts (auto-pick best channel)")
  .action(async (pkg: string | undefined, opts) => {
    const nonInteractive = opts.nonInteractive || !process.stdin.isTTY;

    intro("give-thanks");

    if (opts.history) {
      await printHistory();
      return;
    }

    const token = await authenticate();
    if (!token) {
      log.error("Could not authenticate with GitHub.");
      process.exit(1);
    }

    if (opts.scan !== undefined) {
      await handleScan(token, opts.scan === true ? "." : opts.scan, {
        ...opts,
        nonInteractive,
      });
      return;
    }

    if (!pkg) {
      log.error(
        'Provide a package name, owner/repo, or use --scan.\nExample: give-thanks hashbrown --used-for "auth hashing"'
      );
      process.exit(1);
    }

    await handleSingleThank(token, pkg, { ...opts, nonInteractive });
  });

async function handleSingleThank(
  token: string,
  pkg: string,
  opts: {
    usedFor?: string;
    message?: string;
    force?: boolean;
    dryRun?: boolean;
    nonInteractive?: boolean;
  }
) {
  const s = spinner();

  // Check history
  if (!opts.force && (await hasBeenThanked(pkg))) {
    const history = await getHistory();
    const entry = history.find(
      (h) => h.package === pkg || h.repo === pkg
    );
    log.warn(
      `You already thanked ${pkg} on ${entry?.thankedAt?.split("T")[0]}. Use --force to send again.`
    );
    return;
  }

  // Resolve
  s.start(`Resolving ${pkg}...`);
  const resolved = await resolveRepo(pkg);
  if (!resolved) {
    s.stop(`Could not resolve ${pkg}`);
    log.error(
      `Couldn't find ${pkg}. Try \`give-thanks owner/repo\` instead.`
    );
    return;
  }
  s.stop(`Resolved to ${resolved.owner}/${resolved.repo}`);

  // Build message
  const message = buildMessage({
    packageName: pkg,
    usedFor: opts.usedFor,
    customMessage: opts.message,
  });

  // Thank
  s.start(`Thanking ${resolved.owner}/${resolved.repo}...`);
  const result = await thankPackage(token, resolved, message, {
    dryRun: opts.dryRun,
    packageName: pkg,
    nonInteractive: opts.nonInteractive,
  });
  s.stop(result.summary);

  // Log profile links if present
  logProfileLinks(result.profileLinks);

  outro("Done!");
}

async function handleScan(
  token: string,
  dir: string,
  opts: {
    usedFor?: string;
    message?: string;
    force?: boolean;
    dryRun?: boolean;
    nonInteractive?: boolean;
  }
) {
  const s = spinner();
  s.start("Scanning dependencies...");
  const deps = await scanDependencies(dir);

  if (deps.length === 0) {
    s.stop("No dependency files found in this directory.");
    return;
  }

  // Filter already thanked
  const history = await getHistory();
  const unthanked = opts.force
    ? deps
    : deps.filter(
        (d) =>
          !history.some((h) => h.package === d)
      );

  s.stop(`Found ${deps.length} dependencies (${unthanked.length} unthanked)`);

  if (unthanked.length === 0) {
    log.success("You've already thanked all your dependencies!");
    return;
  }

  let selected: string[];

  if (opts.nonInteractive) {
    selected = unthanked;
    log.info(`Auto-thanking all ${unthanked.length} unthanked dependencies`);
  } else {
    const picked = await multiselect({
      message: "Which packages do you want to thank?",
      options: unthanked.map((d) => ({ value: d, label: d })),
    });

    if (isCancel(picked)) {
      outro("Cancelled.");
      return;
    }

    selected = picked as string[];
  }

  let thankedCount = 0;
  for (const pkg of selected) {
    await handleSingleThank(token, pkg, opts);
    thankedCount++;
  }

  outro(`Thanked ${thankedCount} maintainer${thankedCount === 1 ? "" : "s"} today!`);
}

function logProfileLinks(links?: ProfileLinks): void {
  if (!links) return;

  const entries: string[] = [];
  if (links.email) entries.push(`     Email: ${links.email}`);
  if (links.blog) entries.push(`     Blog: ${links.blog}`);
  if (links.twitter) entries.push(`     Twitter: ${links.twitter}`);

  if (entries.length > 0) {
    log.info(`FYI, the maintainer also has:\n${entries.join("\n")}`);
  }
}

program.parse();

import bcrypt from "bcryptjs";
import { db } from "./index.ts";
import { users } from "./schema/users.ts";
import { workspaces, workspaceMembers } from "./schema/workspaces.ts";
import { projects, workflowStatuses, workflowTransitions } from "./schema/projects.ts";
import { sprints } from "./schema/sprints.ts";
import { issues, issueWatchers } from "./schema/issues.ts";
import { comments } from "./schema/comments.ts";
import { eq } from "drizzle-orm";

// ─── helpers ────────────────────────────────────────────────────────────────

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function maybe<T>(val: T, probability = 0.6): T | undefined {
  return Math.random() < probability ? val : undefined;
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const ISSUE_TITLES = [
  "Implement user authentication flow",
  "Fix memory leak in background worker",
  "Add pagination to search results",
  "Refactor database connection pooling",
  "Write unit tests for payment module",
  "Design new onboarding experience",
  "Migrate to PostgreSQL 16",
  "Fix race condition in sprint completion",
  "Add Redis caching to board endpoint",
  "Implement real-time notifications",
  "Fix broken link in email templates",
  "Add dark mode support",
  "Optimise slow SQL query in reports",
  "Implement CSV export for issues",
  "Add two-factor authentication",
  "Fix mobile layout on issue detail page",
  "Upgrade dependency versions",
  "Add webhook support for integrations",
  "Implement drag-and-drop on kanban board",
  "Fix timezone handling in sprint dates",
  "Add bulk issue assignment",
  "Implement issue templates",
  "Fix XSS vulnerability in comment renderer",
  "Add keyboard shortcuts",
  "Implement mention autocomplete",
  "Write integration tests for auth flow",
  "Add custom field validation",
  "Fix dashboard loading performance",
  "Implement issue linking",
  "Add email digest notifications",
  "Fix search ranking for short queries",
  "Add project archiving",
  "Implement audit log viewer",
  "Fix avatar upload for large files",
  "Add sprint burndown chart",
  "Implement SSO with Google",
  "Fix comment threading on mobile",
  "Add issue due dates",
  "Implement time tracking",
  "Fix notification badge count",
  "Add filter presets",
  "Implement API rate limiting",
  "Fix slow project creation",
  "Add role-based dashboard",
  "Implement issue cloning",
  "Fix pagination cursor edge case",
  "Add workspace analytics",
  "Implement changelog tracking",
  "Fix assignee filter in search",
  "Add issue priority bulk update",
];

const DESCRIPTIONS = [
  "This needs to be done before the next release. Blocking several other tasks.",
  "Reproduces consistently on production. Priority fix needed.",
  "Part of the Q2 performance initiative. See Notion doc for full spec.",
  "Affects approximately 15% of users based on error logs.",
  "Requested by the design team. Figma mockups attached.",
  "Technical debt from the original MVP. Time to clean it up.",
  "Regression introduced in the last deployment. Rollback considered.",
  "Customer reported via support ticket. High visibility issue.",
  "Required for GDPR compliance. Legal deadline is end of month.",
  "Performance improvement — currently takes 3s, target is under 200ms.",
  null,
  null,
];

const LABELS_POOL = [
  ["backend"],
  ["frontend"],
  ["bug"],
  ["performance"],
  ["security"],
  ["auth"],
  ["database"],
  ["ui"],
  ["api"],
  ["docs"],
  ["testing"],
  ["infra"],
  ["backend", "api"],
  ["frontend", "ui"],
  ["bug", "auth"],
  ["performance", "database"],
];

// ─── seed ────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("[seed] starting — this will take a few seconds...\n");

  const passwordHash = await bcrypt.hash("password123", 10);

  // ── Users (10) ──────────────────────────────────────────────────────────────
  const userRows = await db
    .insert(users)
    .values([
      { email: "alice@example.com",   display_name: "Alice Johnson",  password_hash: passwordHash },
      { email: "bob@example.com",     display_name: "Bob Smith",      password_hash: passwordHash },
      { email: "carol@example.com",   display_name: "Carol White",    password_hash: passwordHash },
      { email: "dave@example.com",    display_name: "Dave Brown",     password_hash: passwordHash },
      { email: "eve@example.com",     display_name: "Eve Davis",      password_hash: passwordHash },
      { email: "frank@example.com",   display_name: "Frank Miller",   password_hash: passwordHash },
      { email: "grace@example.com",   display_name: "Grace Wilson",   password_hash: passwordHash },
      { email: "henry@example.com",   display_name: "Henry Moore",    password_hash: passwordHash },
      { email: "iris@example.com",    display_name: "Iris Taylor",    password_hash: passwordHash },
      { email: "jack@example.com",    display_name: "Jack Anderson",  password_hash: passwordHash },
    ])
    .returning();

  const [alice, bob, carol, dave, eve, frank, grace, henry, iris, jack] = userRows;
  const allUsers = userRows;
  console.log(`[seed] ✓ ${userRows.length} users`);

  // ── Workspace ───────────────────────────────────────────────────────────────
  const [workspace] = await db
    .insert(workspaces)
    .values({ name: "Acme Engineering", slug: "acme-engineering", created_by: alice!.id })
    .returning();

  await db.insert(workspaceMembers).values(
    allUsers.map((u, i) => ({
      workspace_id: workspace!.id,
      user_id: u!.id,
      role: (i === 0 ? "owner" : i <= 2 ? "admin" : "member") as "owner" | "admin" | "member",
    })),
  );
  console.log(`[seed] ✓ workspace + ${allUsers.length} members`);

  // ── Helper: create project with default workflow ─────────────────────────────
  async function createProjectWithWorkflow(key: string, name: string, description: string) {
    const [project] = await db
      .insert(projects)
      .values({ workspace_id: workspace!.id, key, name, description, created_by: alice!.id })
      .returning();

    const statusDefs = [
      { name: "Todo",        color: "#6B7280", position: 0, category: "todo"        as const },
      { name: "In Progress", color: "#3B82F6", position: 1, category: "in_progress" as const },
      { name: "In Review",   color: "#F59E0B", position: 2, category: "in_progress" as const },
      { name: "Done",        color: "#10B981", position: 3, category: "done"        as const },
    ];

    const statuses = await db
      .insert(workflowStatuses)
      .values(statusDefs.map((s) => ({ ...s, project_id: project!.id })))
      .returning();

    const [todo, inProgress, inReview, done] = statuses;

    await db.insert(workflowTransitions).values([
      { project_id: project!.id, from_status_id: todo!.id,       to_status_id: inProgress!.id },
      { project_id: project!.id, from_status_id: inProgress!.id, to_status_id: inReview!.id   },
      { project_id: project!.id, from_status_id: inReview!.id,   to_status_id: done!.id       },
      { project_id: project!.id, from_status_id: inReview!.id,   to_status_id: inProgress!.id },
      { project_id: project!.id, from_status_id: done!.id,       to_status_id: inProgress!.id },
    ]);

    return { project: project!, statuses: { todo: todo!, inProgress: inProgress!, inReview: inReview!, done: done! } };
  }

  // ── 3 Projects ───────────────────────────────────────────────────────────────
  const p1 = await createProjectWithWorkflow("APP",  "Consumer App",     "Main consumer-facing mobile and web application");
  const p2 = await createProjectWithWorkflow("BACK", "Backend Services", "Core API services and infrastructure");
  const p3 = await createProjectWithWorkflow("OPS",  "DevOps & Infra",   "CI/CD pipelines, cloud infra, monitoring");
  console.log(`[seed] ✓ 3 projects with workflows`);

  // ── Sprints (2 per project) ──────────────────────────────────────────────────
  const [sprint1p1] = await db.insert(sprints).values({
    project_id: p1.project.id, name: "Sprint 1", goal: "Auth + onboarding",
    status: "completed", start_date: "2026-04-01", end_date: "2026-04-14",
    velocity_points: 24, completed_at: new Date("2026-04-14"),
  }).returning();

  const [sprint2p1] = await db.insert(sprints).values({
    project_id: p1.project.id, name: "Sprint 2", goal: "Dashboard + search",
    status: "active", start_date: "2026-04-15", end_date: "2026-04-28",
  }).returning();

  const [sprint1p2] = await db.insert(sprints).values({
    project_id: p2.project.id, name: "Sprint 1", goal: "API hardening",
    status: "completed", start_date: "2026-04-01", end_date: "2026-04-14",
    velocity_points: 18, completed_at: new Date("2026-04-14"),
  }).returning();

  const [sprint2p2] = await db.insert(sprints).values({
    project_id: p2.project.id, name: "Sprint 2", goal: "Performance + caching",
    status: "active", start_date: "2026-04-15", end_date: "2026-04-28",
  }).returning();

  const [sprint1p3] = await db.insert(sprints).values({
    project_id: p3.project.id, name: "Sprint 1", goal: "K8s migration",
    status: "active", start_date: "2026-04-15", end_date: "2026-04-28",
  }).returning();

  console.log(`[seed] ✓ 5 sprints`);

  // ── Issues ───────────────────────────────────────────────────────────────────
  const types    = ["epic", "story", "task", "bug", "subtask"] as const;
  const priorities = ["lowest", "low", "medium", "high", "critical"] as const;

  const projectConfigs = [
    {
      project: p1.project,
      statuses: p1.statuses,
      sprints: [sprint1p1!, sprint2p1!],
      count: 60,
      startNum: 1,
    },
    {
      project: p2.project,
      statuses: p2.statuses,
      sprints: [sprint1p2!, sprint2p2!],
      count: 50,
      startNum: 1,
    },
    {
      project: p3.project,
      statuses: p3.statuses,
      sprints: [sprint1p3!],
      count: 40,
      startNum: 1,
    },
  ];

  const allIssues: (typeof issues.$inferSelect)[] = [];
  const epicsByProject: Record<string, string[]> = {};

  for (const cfg of projectConfigs) {
    const { todo, inProgress, inReview, done } = cfg.statuses;
    const statusPool = [todo.id, todo.id, inProgress.id, inProgress.id, inReview.id, done.id, done.id];

    const issueValues = Array.from({ length: cfg.count }, (_, i) => {
      const issueNum  = cfg.startNum + i;
      const type      = i < 3 ? "epic" : pick(types);
      const statusId  = pick(statusPool);
      const sprintRow = Math.random() < 0.75 ? pick(cfg.sprints) : null;

      return {
        project_id:   cfg.project.id,
        issue_number: issueNum,
        type,
        title:        ISSUE_TITLES[i % ISSUE_TITLES.length]! + (i >= ISSUE_TITLES.length ? ` (${Math.floor(i / ISSUE_TITLES.length) + 1})` : ""),
        description:  pick(DESCRIPTIONS) ?? undefined,
        status_id:    statusId,
        priority:     pick(priorities),
        reporter_id:  pick(allUsers)!.id,
        assignee_id:  maybe(pick(allUsers)!.id, 0.7),
        sprint_id:    sprintRow?.id ?? null,
        story_points: maybe(rand(1, 13), 0.8),
        labels:       maybe(pick(LABELS_POOL), 0.6) ?? [],
      };
    });

    const inserted = await db.insert(issues).values(issueValues).returning();
    allIssues.push(...inserted);

    // track epics per project for parent linking
    epicsByProject[cfg.project.id] = inserted
      .filter((i) => i.type === "epic")
      .map((i) => i.id);
  }

  // Link ~40% of non-epic issues to an epic in their project as parent
  const nonEpics = allIssues.filter((i) => i.type !== "epic");
  for (const issue of nonEpics) {
    const epics = epicsByProject[issue.project_id] ?? [];
    if (epics.length > 0 && Math.random() < 0.4) {
      await db
        .update(issues)
        .set({ parent_id: pick(epics) })
        .where(eq(issues.id, issue.id));
    }
  }

  console.log(`[seed] ✓ ${allIssues.length} issues across 3 projects`);

  // ── Watchers ─────────────────────────────────────────────────────────────────
  const watcherValues: { issue_id: string; user_id: string }[] = [];
  for (const issue of allIssues) {
    const watcherCount = rand(0, 3);
    const shuffled = [...allUsers].sort(() => Math.random() - 0.5).slice(0, watcherCount);
    for (const u of shuffled) {
      watcherValues.push({ issue_id: issue.id, user_id: u!.id });
    }
  }
  // dedupe
  const unique = [...new Map(watcherValues.map((w) => [`${w.issue_id}:${w.user_id}`, w])).values()];
  if (unique.length > 0) await db.insert(issueWatchers).values(unique).onConflictDoNothing();
  console.log(`[seed] ✓ ${unique.length} watchers`);

  // ── Comments ─────────────────────────────────────────────────────────────────
  const commentBodies = [
    "Looking into this now, should have a fix by EOD.",
    "Can someone clarify the acceptance criteria here?",
    "This is blocked by the infra ticket — waiting on DevOps.",
    "Reviewed and looks good to me. Left some minor comments.",
    "Reproduced on staging. Stack trace attached in Notion.",
    "Fixed in commit abc1234. Ready for review.",
    "Moving this to next sprint — scope crept a bit.",
    "Design approved this approach. Proceeding.",
    "Need more context on the expected behaviour here.",
    "Performance numbers look good after the optimisation.",
    "This is a known issue — tracking in OPS-12.",
    "Estimated 3 days of work. Will pick up Monday.",
    "Done. Deployed to staging, please test.",
    "Closing as won't fix — not enough impact vs effort.",
    "This actually affects more users than we thought.",
  ];

  const commentValues: {
    issue_id: string;
    author_id: string;
    body: string;
    mentions: string[];
    parent_comment_id?: string;
  }[] = [];

  // Add 2-5 comments to ~60% of issues
  const commentedIssues = allIssues.filter(() => Math.random() < 0.6);

  for (const issue of commentedIssues) {
    const count = rand(2, 5);
    let firstCommentId: string | undefined;

    for (let i = 0; i < count; i++) {
      const author = pick(allUsers)!;
      const body = pick(commentBodies);
      const mentionUser = Math.random() < 0.2 ? pick(allUsers)! : null;
      const finalBody = mentionUser ? `@{${mentionUser.id}} ${body}` : body;
      const mentions = mentionUser ? [mentionUser.id] : [];

      commentValues.push({
        issue_id: issue.id,
        author_id: author.id,
        body: finalBody,
        mentions,
        parent_comment_id: i > 0 && firstCommentId && Math.random() < 0.3 ? firstCommentId : undefined,
      });

      // We'll set firstCommentId after insertion
    }
  }

  // Insert in batches to handle parent_comment_id threading
  // First pass: top-level comments
  const topLevel = commentValues.filter((c) => !c.parent_comment_id);
  const replies   = commentValues.filter((c) => c.parent_comment_id);

  const insertedTopLevel = topLevel.length > 0
    ? await db.insert(comments).values(topLevel).returning()
    : [];

  // For replies we just insert them — parent_comment_id references are already set
  if (replies.length > 0) {
    await db.insert(comments).values(replies);
  }

  console.log(`[seed] ✓ ${commentValues.length} comments (${insertedTopLevel.length} top-level, ${replies.length} replies)`);

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log("\n────────────────────────────────────");
  console.log("[seed] done ✓\n");
  console.log("Credentials (password: password123):");
  for (const u of allUsers) {
    console.log(`  ${u!.email}`);
  }
  console.log("\nProjects:");
  console.log(`  APP  — Consumer App       (${p1.project.id})`);
  console.log(`  BACK — Backend Services   (${p2.project.id})`);
  console.log(`  OPS  — DevOps & Infra     (${p3.project.id})`);
  console.log("\nWorkspace slug: acme-engineering");
  console.log("────────────────────────────────────\n");

  process.exit(0);
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});

import express from "express";
import cookieParser from "cookie-parser";
import { readFileSync } from "node:fs";
const swaggerSpec = JSON.parse(readFileSync(`${import.meta.dir}/openapi.json`, "utf8"));
import { errorHandler } from "./middleware/errorHandler.ts";
import { initWsServer } from "./ws/server.ts";
import { startActivityWorker } from "./workers/activity.worker.ts";
import { startNotificationWorker } from "./workers/notification.worker.ts";

import { authRouter } from "./routes/auth.routes.ts";
import { workspacesRouter } from "./routes/workspaces.routes.ts";
import { projectsRouter } from "./routes/projects.routes.ts";
import { issuesRouter } from "./routes/issues.routes.ts";
import { sprintsRouter } from "./routes/sprints.routes.ts";
import { activityRouter } from "./routes/activity.routes.ts";
import { searchRouter } from "./routes/search.routes.ts";
import { usersRouter } from "./routes/users.routes.ts";

const app = express();
app.use(express.json());
app.use(cookieParser());

app.get("/docs.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(readFileSync(`${import.meta.dir}/openapi.json`, "utf8"));
});
app.get("/docs", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>API Docs</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css">
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
<script>
  SwaggerUIBundle({
    url: "/docs.json",
    dom_id: "#swagger-ui",
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
    layout: "BaseLayout",
    deepLinking: true,
  });
</script>
</body>
</html>`);
});

app.get("/health", (_req, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() }),
);

app.use("/api/auth", authRouter);
app.use("/api/workspaces", workspacesRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/issues", issuesRouter);
app.use("/api/sprints", sprintsRouter);
app.use("/api/projects", activityRouter);
app.use("/api/search", searchRouter);
app.use("/api/users", usersRouter);

app.use(errorHandler);

const PORT = Number(process.env["PORT"] ?? 3000);
const server = app.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}`);
  console.log(`[docs]   http://localhost:${PORT}/docs`);
});

initWsServer(server);
startActivityWorker();
startNotificationWorker();

export default app;

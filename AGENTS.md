# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds the MCP server logic (transports, handlers, prompts, utilities). `src/index.ts` is the CLI entry point; `src/handlers/` contains resource/tool implementations; `src/prompts/` stores reusable prompt templates.
- `config/` keeps environment validation helpers, while `tests/` and `direct-tests/` house Bun test suites that exercise the server via Dockerized InfluxDB instances.
- Assets such as sample configs live near their consumers; look for README sections that reference `claude_desktop_config.json` paths when wiring integrations.

## Build, Test, and Development Commands
- `bun install` – installs dependencies.
- `bun start` – launches the stdio transport by default. Append `-- --http [port]` to expose the Streamable HTTP endpoint or `-- --stdio` to be explicit.
- `bun test` – runs the test suites; Docker must be available for integration cases.

## Coding Style & Naming Conventions
- Use ECMAScript modules with top-level `import`/`export`. Follow the existing two-space indentation and trailing commas for multi-line literals (see `src/index.ts` for reference).
- Name files and exports after their responsibility (`writeDataTool.ts`, `queryHandler.ts`). Prefer descriptive, camelCase identifiers for functions and lower-case-with-dashes for CLI flags.
- Reuse shared utilities such as `configureLogger` and `validateEnvironment` rather than duplicating setup logic. When adding options, extend the Commander configuration near the top of `src/index.js`.

## Testing Guidelines
- Bun test is configured via `package.json`. Place end-to-end scenarios under `tests/` and unit-level handler checks under `direct-tests/`.
- Name test files after the feature under test (e.g., `handlers.test.ts`) and keep setup/teardown symmetrical—see current suites for Docker cleanup patterns.
- Before opening a PR, ensure `bun test` passes locally with Docker running; add lightweight mocks if the new code cannot be exercised end-to-end.

## Commit & Pull Request Guidelines
- Follow the existing concise, imperative commit style (e.g., “Add Streamable HTTP transport option using Bun.serve”). Group related changes and avoid mixing refactors with functional updates unless necessary.
- PRs should describe the motivation, summarize key changes, and call out testing evidence (`bun test`, manual HTTP checks). If the change affects transport modes or configuration, include repro steps or screenshots for reviewers.

## Security & Configuration Tips
- Never hard-code secrets; the server reads `INFLUXDB_TOKEN` (and related org/bucket settings) from the environment. Use `.env` files locally but exclude them from commits.
- When exposing the HTTP transport, ensure the chosen port is firewalled or proxied appropriately; the implementation is stateless but still enforces the MCP protocol contract.

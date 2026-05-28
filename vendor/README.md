# vendor/ — defensive fallback mirror

This directory holds **frozen tarball mirrors** of the two load-bearing CopilotKit
packages this starter pins:

| Package | Vendored as | Pinned version |
|---|---|---|
| `@copilotkit/a2ui-renderer` | `vendor/copilotkit-a2ui-renderer/` (extracted) | `1.56.5` |
| `copilotkit` (Python SDK) | `vendor/copilotkit-python/copilotkit-0.1.87-py3-none-any.whl` | `0.1.87` |

**Frozen on:** 2026-05-28 (matches `FROZEN.md`).
**Forked from:** `CopilotKit/CopilotKit@upstream/main`, commit `23af69041`.

## Why we vendor

The hackathon is a single 5-hour build slot. Between fork date (2026-05-28) and
event day, upstream could:

- Cut a breaking `1.56.x` patch that breaks the renderer for a subset of envelope
  shapes the demo relies on.
- Yank `1.56.5` from npm (unlikely but not zero).
- Have an npm registry outage on the morning of the event.

Any of those would brick the starter for the day. The vendored mirror is
**break-glass insurance** — if any of the above happens, every team can flip a
single line in `package.json` (and one entry in `agent/pyproject.toml`) and keep
shipping with the exact bits we tested against.

CI proves the vendored swap actually builds, so the day we need it we don't
discover the mirror is itself broken.

## How to flip from npm to vendor

### JavaScript (`@copilotkit/a2ui-renderer`)

In `package.json`, change:

```jsonc
"dependencies": {
  "@copilotkit/a2ui-renderer": "1.56.5",
  // ...
}
```

to:

```jsonc
"dependencies": {
  "@copilotkit/a2ui-renderer": "file:vendor/copilotkit-a2ui-renderer",
  // ...
}
```

Then:

```bash
pnpm install
pnpm build
```

The renderer resolves from the local vendored directory; the rest of the app is
unchanged. Same import path, same exported API — pnpm just resolves the
specifier to a local directory instead of the npm registry.

### Python (`copilotkit`)

In `agent/pyproject.toml`, change the line:

```toml
"copilotkit==0.1.87",
```

to:

```toml
"copilotkit @ file:./vendor/copilotkit-python/copilotkit-0.1.87-py3-none-any.whl",
```

(The path is relative to `pyproject.toml`, so from `agent/` you need to point at
`../vendor/copilotkit-python/...`. Adjust per your layout.) Alternatively, add an
explicit `[tool.uv.sources]` entry:

```toml
[tool.uv.sources]
copilotkit = { path = "../vendor/copilotkit-python/copilotkit-0.1.87-py3-none-any.whl" }
```

Then:

```bash
cd agent
uv sync
```

## How CI verifies the vendored build

`.github/workflows/ci.yml` includes a **Verify vendor build** step that:

1. Backs up the current `package.json`.
2. Rewrites `@copilotkit/a2ui-renderer` to `file:vendor/copilotkit-a2ui-renderer`.
3. Runs `pnpm install --no-frozen-lockfile` (lockfile drift is expected with
   the file: swap).
4. Runs `pnpm build` to prove the renderer compiles against the rest of the app.
5. Restores the original `package.json` and `pnpm-lock.yaml` from the backup.

If that step ever fails on `main`, the vendored mirror has drifted from what
the app needs — re-vendor before shipping.

## How to refresh the vendor mirror

If we need to update the pinned version (after the event, or during a
deliberate FROZEN.md bump):

```bash
# JavaScript
rm -rf vendor/copilotkit-a2ui-renderer
mkdir vendor/copilotkit-a2ui-renderer
cd vendor/copilotkit-a2ui-renderer
npm pack @copilotkit/a2ui-renderer@<new-version>
tar -xzf copilotkit-a2ui-renderer-<new-version>.tgz --strip-components=1
rm copilotkit-a2ui-renderer-<new-version>.tgz

# Python
rm vendor/copilotkit-python/*.whl
uv run --python 3.12 --with pip python -m pip download \
  copilotkit==<new-version> --no-deps -d vendor/copilotkit-python/
```

Update `FROZEN.md` with the new version + verification date in the same commit.

## What is NOT vendored

We deliberately do **not** vendor the full dependency tree (no
`@copilotkit/react-core`, no `@copilotkit/runtime`, no `langchain*`, no `next`,
no `react`). Those are pinned to exact versions in `package.json` /
`pyproject.toml` and the lockfile (`pnpm-lock.yaml` / `uv.lock`) is committed.
That gives us reproducibility for the rest of the surface without bloating the
repo with hundreds of MB of tarballs.

The two vendored packages are the ones where a breaking upstream change would
silently break envelope rendering — those are the ones we want byte-identical
insurance for.

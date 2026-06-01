# DocForge Beta — Operations Notes

This file documents beta-launch concerns that live OUTSIDE this Lovable project
(separate service repos) so nothing is forgotten when promoting beta → GA.

## External service hardening

Two backing services run in separate repos:

- `docforge-clip-service` — YouTube clip sourcing / probe / download
- `docforge-renderer` — Remotion render workers

### Required middleware before public beta

Both services expose debug endpoints (`/debug/*`, `/health`, `/admin/*`) that
must be gated behind a service key for any non-local environment.

Add a `requireServiceKey` middleware to each Express/Hono app:

```ts
function requireServiceKey(req, res, next) {
  const provided = req.header("x-service-key");
  if (!provided || provided !== process.env.SERVICE_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

app.use("/debug", requireServiceKey);
app.use("/admin", requireServiceKey);
```

Then set the `SERVICE_KEY` env var on each deployment and call from this
project's server functions with the matching header.

### Other beta checklist items

- [ ] Rate-limit `/render` and `/clips/fetch` per user (e.g. 60/min).
- [ ] Forward upstream errors with a stable shape `{ error: { code, message } }`.
- [ ] Add structured request logging (request id, user id, duration_ms).
- [ ] Ensure all external API keys (ElevenLabs, Replicate, Pexels, YouTube) live
      in service env, never client-side.

## In-app beta surfaces (this repo)

These ship with this build:

- Beta version footer (`DocForge Beta v0.1`) on every authenticated page
- Mobile notice overlay on `/projects/:id`
- Feedback widget (floating button → `public.feedback` table)
- Keyboard shortcuts modal (`?` to open)
- Settings → Help → restart walkthrough, docs, mailto support

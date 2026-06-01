# AI Sound Design System

This is a large, multi-part feature. Your message also cut off mid-Part 3 (after `punctuation_chara`). Here's my proposed build plan — confirm or correct before I start.

## Scope

**Part 1 — Database**
- New tables: `sound_style_profiles`, `scene_sounds`, `sound_cache` (with RLS scoped to project owner via `projects.user_id`)
- Add `sound_brief jsonb`, `sound_status text` to `scenes`
- `sound_cache.prompt_hash` unique → enforces "same description never generates twice"
- Storage: reuse existing `docforge-assets` bucket under `sounds/{user_id}/{hash}.mp3`

**Part 2 — Script analyzer**
- Extend `src/lib/script-analysis.functions.ts` Claude prompt with the `sound_brief` + `sound_category` fields per scene
- Persist `sound_brief` + `sound_status='complete'` on each scene during analysis
- Apply the real-footage / opening / climax / resolution rules in the prompt
- Cached: only runs during initial script analysis, never re-runs on reload

**Part 3 — Project sound style profile**
- New server fn: after analysis, single Claude call → insert one row into `sound_style_profiles`
- Need the rest of your spec (cut off at `punctuation_chara…`) — see questions below

**Part 4 — Sound generation (ElevenLabs SFX)**
- Server fn `generateSceneSound({ sceneId, soundType })`:
  1. Compute `prompt_hash = sha256(description)`
  2. Check `sound_cache` → if hit, reuse `file_url`, bump `usage_count`, write `scene_sounds` row
  3. Else call ElevenLabs `/v1/sound-generation`, upload to Storage, insert `sound_cache`, insert `scene_sounds`
- Batch fn to generate all scene sounds for a project
- Never regenerate unless explicit `force: true` flag from user

**Part 5 — UI (Studio)**
- New `SoundDesignTab` in studio: list scenes × (ambient/punctuation/transition), show description + reasoning, status badge, preview audio, regenerate button, volume slider, confirm toggle
- "Generate all sounds" batch button
- Loads from DB on project open — no auto-regen

**Part 6 — Playback**
- Extend `FullVideoPreview` to mix scene sounds with voiceover at specified volumes / timing / fades
- Extend render manifest + export package to include sound tracks

## Questions before I build

1. **Your message cut off in Part 3.** Can you paste the rest of the sound style profile spec (the `punctuation_character`, `transition_character`, `avoid_list`, `reference_description` field descriptions for the Claude prompt)? I can reasonably infer them from the table schema, but want to confirm.
2. **Were there Parts 4–6 in your original message** (generation, UI, playback, export)? If yes, paste them. If no, I'll implement them with reasonable defaults as outlined above.
3. **Render/export integration**: should sound tracks be mixed into the final exported video, or delivered as separate stems alongside the video? (Current export pipeline is Remotion-based.)
4. **Claude model**: which model should the analyzer use? (Existing analyzer presumably uses one already — I'll match it unless you say otherwise.)

Once you confirm the plan + answer the questions (or say "just go with your defaults"), I'll execute it in this order: migration → analyzer update → style profile fn → generation fn → UI tab → playback/export.

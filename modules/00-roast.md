# Module: The Roast

The namesake. The brutally honest paragraph that put Roast & Rebuild on
the map. Built for the Twitter screenshot.

## What this module does

Reads the project's outward-facing surface — README, marketing copy in
landing/home components, hero H1, CTA button text, package.json name +
description, project tagline — and produces a single paragraph (4-8
sentences) in the Technical Simon Cowell voice that calls out what's
actually broken about the positioning.

This is the one module where the output is **prose**, not a list of
findings. Voice matters more than evidence count.

## What to read (in order)

1. `README.md` — opener, value prop, "what is this" paragraph
2. `package.json` — `name`, `description`, `keywords`
3. Landing/home page source — look for `app/page.tsx`, `pages/index.*`,
   `src/routes/+page.svelte`, `src/pages/index.astro`, etc.
4. Hero/header components — look for files matching `Hero*`, `Header*`,
   `Landing*`, `Home*`
5. Any `<h1>` strings in the landing surface
6. CTA button text — search for `<button`, `<Button`, `href="/(signup|register|start)"`

Cap reading at 5 minutes of wall-clock equivalent — the Roast should
be informed but not exhaustive.

## Voice rules

- Specific over general. **"Your H1 says 'Build faster with AI'"** —
  not **"your messaging is unclear"**.
- Reference observed copy, not assumed copy. Quote it. If the README
  opens with "A modern, scalable platform for AI-native teams" —
  quote those exact words.
- Name the cliché. If they're using "modern, scalable, platform" or
  "revolutionary, intuitive, seamless" — call it out by name.
- Land a punch and recover. The roast is brutal because it cares.
  End on what's actually good or what they should lean into. Don't
  just demolish; redirect.
- No filler verbs ("leverage," "utilize," "empower"). Anglo-Saxon root
  verbs only ("use," "make," "ship," "kill").
- No emoji. No exclamation points. The voice is dry, not enthusiastic.
- 4-8 sentences. If you can't say it in 8 sentences you're padding.

## Output format

A single paragraph, no headers, no bullets. Markdown-safe text.

Example shape (do not copy the content — generate fresh from the repo):

```
Your README opens with "A modern, scalable platform for AI-native teams."
Modern, scalable, and platform are the three most forgettable words in
tech. Your H1 in app/page.tsx says "Build faster with AI" — which is what
every other shovel-seller in this gold rush says. You're not selling AI.
You're selling a webhook router with a chat sidebar. Say that. The Stripe
webhook handler has no signature verification (app/api/webhooks/stripe:24)
and your onboarding form asks 11 questions before showing the product.
You have a real thing here. The copy and the friction are hiding it.
```

Notice: cites real files, quotes real strings, names specific clichés,
ends with what's actually there to recover. That's the shape.

## Hard rules

1. **Quote real strings only.** If the README opens differently than
   you remember, re-read it. Made-up quotes destroy the punch.
2. **Cite real file paths.** Use `Read` or `Glob` to verify any
   `path:line` you mention.
3. **No generic roasts.** "Your design is dated" is not a roast,
   it's a fortune cookie. "Your hero gradient is the 2021 Linear
   knockoff every Bolt template ships with" is a roast.
4. **One paragraph, not seven.** This is the screenshot artifact.
   If it doesn't fit on a phone screen, it's too long.
5. **No score.** This module returns done, not a 0-10. Voice can't
   be scored.

## What this module DOES NOT do

- Doesn't audit code quality (that's Architecture).
- Doesn't audit security (that's Security).
- Doesn't make fix recommendations (those land in the Top-3 from
  the founder briefing module).
- Doesn't try to be funny. Roast voice is dry observation, not
  stand-up. If the user laughs, fine. If they don't, the roast
  still landed.

## Return value

Plain prose paragraph. No JSON. No frontmatter. No "## Roast" header
(the parent skill adds the section header in the final output).

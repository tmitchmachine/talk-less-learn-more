# Talk Less, Learn More

A top-down pixel RPG about talking to customers well. You play a new researcher in Fieldtown. Walk around, meet customers, and run real research sessions: a user interview, a usability test, and a design review. Every line you say changes what you learn.

All the lessons in the game come from [Nielsen Norman Group](https://www.nngroup.com) articles. This is an unofficial study game and is not affiliated with or endorsed by NN/g.

## How it plays

- **Explore Fieldtown.** Walk with arrow keys or WASD, or drag anywhere on a touchscreen. Press E or Space (or tap the prompt) to talk.
- **Run sessions.** Each customer conversation is a series of turns. Pick what to say with 1–4 or a tap. Staying silent is often one of your options.
  - **Openness:** drops when you lead, pitch or interrupt. At zero, the customer leaves.
  - **Insight:** rises when the customer tells you what really happens. Strong moves pin sticky notes to your insight wall.
  - **Bias:** rises when your words end up in their mouth. Your score loses half a point for every point of bias.
  - **Choice timer:** 25 seconds. When it runs out, you stay quiet. You can turn the timer off in Settings.
- **Unlock the town.** Earn at least one star with a customer to open the road to the next one.
- **Sort the wall.** In the lab, sort falling observations into the five quality components of usability (learnability, efficiency, memorability, errors, satisfaction), plus utility.
- **Collect moves.** Strong techniques you use (Echo, Boomerang, Columbo, the funnel, and others) go into your journal, with links to the source articles.

- **Hear every line.** Characters speak their lines out loud, each with their own voice, and their portraits lip-sync. Press the speaker button (or L) to hear a line again. In Settings you can turn voices off, change their speed, or turn on “Read everything aloud” to also hear scene notes, your own lines, coaching tips and results.

Progress saves in your browser's local storage.

## Sources

| Article | Used for |
|---|---|
| [Usability 101: Introduction to Usability](https://www.nngroup.com/articles/usability-101-introduction-to-usability/) | The five quality components, utility, 5-user testing, the synthesis wall |
| [User Interviews 101](https://www.nngroup.com/articles/user-interviews/) | Starting easy, rapport, probing, limits of self-report |
| [Avoid Leading Questions](https://www.nngroup.com/articles/leading-questions/) | Leading-question traps and neutral rewrites |
| [Open-Ended vs. Closed Questions](https://www.nngroup.com/articles/open-ended-questions/) | Open vs. closed questions, “did/was/is” traps |
| [Talking with Participants During a Usability Test](https://www.nngroup.com/articles/talking-to-users/) | Echo, Boomerang, Columbo, counting to 10 |
| [First Rule of Usability? Don’t Listen to Users](https://www.nngroup.com/articles/first-rule-of-usability-dont-listen-to-users/) | Watching behavior, preference vs. performance, surveys |
| [Thinking Aloud: The #1 Usability Tool](https://www.nngroup.com/articles/thinking-aloud-the-1-usability-tool/) | Setting up and prompting think-aloud |
| [6 Mistakes When Crafting Interview Questions](https://www.nngroup.com/articles/interview-questions-mistakes/) | Hypotheticals, compound questions, “because” questions |
| [The Funnel Technique in Qualitative User Research](https://www.nngroup.com/articles/the-funnel-technique-in-qualitative-user-research/) | Broad-to-narrow tasks and follow-ups |

## Development

```bash
npm install
npm run dev        # local dev server
npm run build      # type-check and build to dist/
npm run preview    # serve the production build
```

Built with [Phaser 3](https://phaser.io), TypeScript and Vite. There are no image or audio files:

- Every sprite, tile, tree, building and portrait is drawn in code (`src/art/draw.ts`), along with the soft light, shadow and cloud textures.
- The sound effects and music are synthesized with the Web Audio API (`src/audio.ts`).
- Spoken dialogue uses the browser's built-in speech engine (`src/voice.ts`). Each character gets a voice from the ones the device offers, plus their own pitch and pace. The music dips while someone is talking.
- The dialogue and menus are an HTML layer over the canvas (`src/ui/`), so text stays sharp and every control works with keyboard, mouse, touch and screen readers. Text is set in [Atkinson Hyperlegible Next](https://www.brailleinstitute.org/freefont/), a typeface designed for legibility, with headings in [Outfit](https://fonts.google.com/specimen/Outfit).

| Path | What’s there |
|---|---|
| `src/data/sessions.ts` | The three customer sessions: every line, choice, score and coaching note |
| `src/data/sort.ts` | Synthesis-wall cards |
| `src/data/townsfolk.ts` | Mae’s story lines and the townsfolk |
| `src/world/map.ts` | The Fieldtown map |
| `src/scenes/` | Boot, Town, Conversation and Synthesis scenes |

Add `?debug` to the URL to expose the game object as `window.__game` for automated play tests.

## Deploying

The game is a static site. On Vercel, the Vite preset builds it with `npm run build` and serves `dist/`.

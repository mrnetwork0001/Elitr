// Sound effects via ElevenLabs /v1/sound-generation (minimum 0.5 s). Skips files that already exist.
//   node scripts/sfx.mjs                     all missing
//   ONLY=relay,zap node scripts/sfx.mjs      force regenerate some
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, post, retry } from "./env.mjs";

const SFX = {
  modem: ["Very short muffled 1990s dial-up modem handshake chirp, distant and soft, two seconds, no music", 2.0],
  keys: ["A few soft mechanical keyboard keystrokes typing quickly, close, dry, no music", 1.2],
  ticker: ["Soft continuous stock ticker tape machine clicking, rhythmic, quiet, no music", 3.0],
  tick: ["Single crisp clock tick, close, dry, short", 0.5],
  bell: ["Single distant stock exchange closing bell ring, short, clean, with a soft room tail", 2.0],
  coin: ["Single small bright digital coin chime, modern, clean, short, like a micropayment", 0.6],
  deny: ["Short soft digital denial buzz, low, clean, not harsh, like an HTTP error", 0.6],
  sign: ["Quick soft pen-like digital signature swipe with a tiny click at the end, clean, no music", 0.8],
  blip: ["Single soft digital data blip, clean sine tone, short", 0.5],
  click: ["Soft modern UI click, single, clean, short", 0.5],
  pop: ["Soft bubbly UI pop, single, clean, short", 0.5],
  whoosh: ["Soft fast airy whoosh, smooth cinematic transition, no music", 1.0],
  riser: ["Tension riser, rising airy synth swell building to a peak, cinematic, no drums", 3.5],
  impact: ["Deep clean cinematic impact with a warm sub tail, modern, single hit", 2],
  stamp: ["Firm soft rubber stamp hit on paper, single, close, dry", 0.6],
  lock: ["Solid metallic safety lock clunk, single, clean, close", 0.7],
  chime: ["Bright clean confirmation chime, two soft ascending notes, modern, short tail", 1.5],
};

const dir = join(ROOT, "public/audio/sfx");
mkdirSync(dir, { recursive: true });
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;

for (const [name, [text, dur]] of Object.entries(SFX)) {
  const f = join(dir, `${name}.mp3`);
  if (only ? !only.includes(name) : existsSync(f)) { console.log(`${name}: skip`); continue; }
  try {
    const buf = await retry(async () => {
      const res = await post("/sound-generation?output_format=mp3_44100_128", { text, duration_seconds: dur, prompt_influence: 0.5 });
      return Buffer.from(await res.arrayBuffer());
    });
    writeFileSync(f, buf);
    console.log(`${name}: ${(buf.length / 1024).toFixed(0)}kb`);
  } catch (e) { console.error(`${name}: FAILED ${e.message}`); }
}

// Puts the thumbnail in front of the film so it is the cover everywhere:
//  1. X and most feeds preview a video by its first frames, so the film opens on the thumbnail
//     (HOLD s), then dissolves into the first scene (XF s). The film's audio starts with the scene.
//  2. The thumbnail is also embedded as cover art (attached_pic) for Finder, QuickTime and chat apps.
//   node scripts/cover.mjs <film.mp4> <thumbnail.png> <out.mp4> [crf]
import { execFileSync } from "node:child_process";

const [film, thumb, out, crf = "14"] = process.argv.slice(2);
if (!film || !thumb || !out) throw new Error("usage: cover.mjs <film.mp4> <thumbnail.png> <out.mp4> [crf]");
const HOLD = 1.2, XF = 0.5;
const probe = (f, k) => execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", `stream=${k}`, "-of", "csv=p=0", f]).toString().trim();
const [w, h] = probe(film, "width,height").split(",").filter(Boolean).map(Number);
const fps = probe(film, "r_frame_rate").replace(/,+$/, "");
const lead = HOLD; // the poster is on screen alone for HOLD s, then the dissolve begins
const delayMs = Math.round(lead * 1000);

execFileSync("ffmpeg", [
  "-y", "-loglevel", "error",
  "-loop", "1", "-framerate", fps, "-t", String(HOLD + XF), "-i", thumb,
  "-i", film,
  "-i", thumb,
  "-filter_complex",
  `[0:v]scale=${w}:${h}:flags=lanczos,format=yuv420p,setsar=1,fps=${fps},settb=AVTB[p];` +
  `[1:v]format=yuv420p,setsar=1,fps=${fps},settb=AVTB[f];` +
  `[p][f]xfade=transition=fade:duration=${XF}:offset=${lead}[v];` +
  `[1:a]adelay=${delayMs}|${delayMs}[a]`,
  "-map", "[v]", "-map", "[a]", "-map", "2:v",
  "-c:v:0", "libx264", "-crf", crf, "-preset", "medium", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "320k",
  "-c:v:1", "png", "-disposition:v:1", "attached_pic",
  "-movflags", "+faststart", out,
]);
console.log(`${out}: ${HOLD}s cover hold + ${XF}s dissolve, cover art embedded`);

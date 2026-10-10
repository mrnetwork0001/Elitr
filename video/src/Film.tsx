import React from "react";
import { AbsoluteFill, Audio, Freeze, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { K, T, scene, wordAt, lineStart } from "./timing";
import { C } from "./theme";
import { Chrome } from "./ui/Chrome";
import { Captions } from "./ui/Captions";
import { Grain } from "./ui/Grain";
import { clamp } from "./ui/motion";
import { Open } from "./scenes/Open";
import { Clock } from "./scenes/Clock";
import { Gap } from "./scenes/Gap";
import { Turn } from "./scenes/Turn";
import { Sellers } from "./scenes/Sellers";
import { Pay } from "./scenes/Pay";
import { Trust } from "./scenes/Trust";
import { Risk } from "./scenes/Risk";
import { Live } from "./scenes/Live";
import { Shop } from "./scenes/Shop";
import { Unique } from "./scenes/Unique";
import { Close } from "./scenes/Close";

const SCENES: Record<string, React.FC> = {
  open: Open, clock: Clock, gap: Gap, turn: Turn, sellers: Sellers, pay: Pay,
  trust: Trust, risk: Risk, live: Live, shop: Shop, unique: Unique, close: Close,
};
const OVERLAP = 10 * K; // frames each scene starts early, to cross-dissolve with the last (10 units = 1/3 s)

/** Each scene eases in (a short rise and un-blur) over the tail of the previous one, holding its first frame. */
const SceneIn: React.FC<{ S: React.FC; first: boolean }> = ({ S, first }) => {
  const f = useCurrentFrame();
  if (first) return <S />;
  const p = interpolate(f, [0, OVERLAP], [0, 1], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
  const body = f < OVERLAP ? <Freeze frame={0}><S /></Freeze> : <Sequence from={OVERLAP} layout="none"><S /></Sequence>;
  return <AbsoluteFill style={{ opacity: p, transform: `scale(${1.03 - 0.03 * p})`, filter: p < 1 ? `blur(${(1 - p) * 10}px)` : undefined }}>{body}</AbsoluteFill>;
};

// --- Music: ducked under every spoken line.
const LINES = T.scenes.flatMap((s) => s.lines.map((l) => [l.startFrame, l.words[l.words.length - 1].end] as const));
const DUCK: number[] = (() => {
  const v = new Array<number>(T.totalFrames + 1).fill(0);
  for (let f = 0; f <= T.totalFrames; f++) {
    let d = 0;
    for (const [a, b] of LINES) d = Math.max(d, interpolate(f, [a - 10 * K, a, b, b + 14 * K], [0, 1, 1, 0], clamp));
    v[f] = d;
  }
  return v;
})();
const musicVolume = (f: number) => {
  const end = T.totalFrames;
  const fadeIn = interpolate(f, [0, 24 * K], [0, 1], clamp);
  const fadeOut = interpolate(f, [end - 60 * K, end], [1, 0], clamp);
  return (0.55 - 0.36 * DUCK[Math.min(end, Math.max(0, f))]) * fadeIn * fadeOut;
};

interface Fx { file: string; at: number; vol: number; dur?: number }
// Cues are written in 30 fps units, like the scenes, and converted to composition frames at the end.
function effects(): Fx[] {
  const sc = (id: string) => scene(id).from / K;
  const w = (id: string, word: string, n = 0) => wordAt(id, word, n) / K;
  // footage events: scene start + hold + (clip mark - startFrom)
    const fx: Fx[] = [
    // open: 1997, the status code nobody could answer
    { file: "modem", at: w("open", "nineteen") - 6, vol: 0.16 },
    { file: "keys", at: w("open", "Four") - 30, vol: 0.32 },
    { file: "keys", at: w("open", "Four") - 12, vol: 0.28 },
    { file: "deny", at: w("open", "Four") + 2, vol: 0.32 },
    { file: "blip", at: w("open", "Twenty-nine"), vol: 0.3 },
    { file: "ticker", at: w("open", "Twenty-nine") + 8, vol: 0.14, dur: 100 },
    // clock: the bell, then the tapes keep running
    { file: "whoosh", at: sc("clock") - 6, vol: 0.25 },
    { file: "tick", at: w("clock", "Wall"), vol: 0.3 }, { file: "tick", at: w("clock", "closes"), vol: 0.3 },
    { file: "bell", at: w("clock", "Friday.") - 2, vol: 0.32 },
    { file: "stamp", at: w("clock", "Friday.") + 2, vol: 0.9 },
    { file: "ticker", at: w("clock", "keep") - 6, vol: 0.14, dur: 70 },
    // gap
    { file: "whoosh", at: sc("gap") - 6, vol: 0.25 },
    { file: "blip", at: w("gap", "one") - 2, vol: 0.35 },
    ...["information,", "pay", "trust"].map((x) => ({ file: "pop", at: w("gap", x) - 4, vol: 0.85 })),
    // turn: six tapes become the mark
    { file: "riser", at: sc("turn") - 96, vol: 0.4 },
    { file: "impact", at: w("turn", "Elitr.") - 3, vol: 0.42 },
    { file: "chime", at: w("turn", "Elitr.") + 6, vol: 0.18 },
    // sellers
    { file: "whoosh", at: sc("sellers") - 6, vol: 0.25 },
    { file: "pop", at: w("sellers", "news") - 4, vol: 0.85 },
    { file: "pop", at: w("sellers", "swaps") - 6, vol: 0.85 },
    { file: "coin", at: w("sellers", "cent."), vol: 0.4 },
    // pay: one real b402 purchase
    { file: "whoosh", at: sc("pay") - 6, vol: 0.25 },
    { file: "click", at: w("pay", "asks") - 4, vol: 0.45 },
    { file: "deny", at: w("pay", "Four") - 4, vol: 0.32 },
    { file: "sign", at: w("pay", "signs") - 2, vol: 0.4 },
    { file: "stamp", at: w("pay", "facilitator") + 2, vol: 0.7 },
    { file: "coin", at: w("pay", "arrives.") - 4, vol: 0.45 },
    { file: "ticker", at: w("pay", "One") + 8, vol: 0.12, dur: 90 },
    // trust
    { file: "whoosh", at: sc("trust") - 6, vol: 0.25 },
    { file: "tick", at: w("trust", "time"), vol: 0.3 },
    { file: "pop", at: w("trust", "thirteen") - 4, vol: 0.85 },
    { file: "pop", at: w("trust", "zero") - 4, vol: 0.85 },
    { file: "stamp", at: w("trust", "ERC-8004") - 2, vol: 0.8 },
    // risk
    { file: "whoosh", at: sc("risk") - 6, vol: 0.25 },
    { file: "blip", at: w("risk", "Fourteen") - 2, vol: 0.35 },
    { file: "stamp", at: w("risk", "dry-runs") + 2, vol: 0.9 },
    { file: "lock", at: w("risk", "nothing"), vol: 0.5 },
    // live
    { file: "whoosh", at: sc("live") - 6, vol: 0.25 },
    { file: "pop", at: w("live", "bought") - 4, vol: 0.85 },
    { file: "deny", at: w("live", "stop-loss") - 4, vol: 0.28 },
    { file: "coin", at: w("live", "sold") - 2, vol: 0.4 },
    // shop
    { file: "whoosh", at: sc("shop") - 6, vol: 0.25 },
    { file: "pop", at: w("shop", "Wallet") - 6, vol: 0.85 },
    { file: "coin", at: w("shop", "three") - 2, vol: 0.4 },
    { file: "pop", at: w("shop", "Studio") - 6, vol: 0.85 },
    // unique
    { file: "whoosh", at: sc("unique") - 6, vol: 0.3 },
    { file: "impact", at: w("unique", "It's") - 4, vol: 0.15 },
    { file: "impact", at: w("unique", "earns") - 4, vol: 0.15 },
    { file: "impact", at: w("unique", "fails") - 4, vol: 0.15 },
    // close
    { file: "whoosh", at: sc("close") - 6, vol: 0.25 },
    { file: "chime", at: w("close", "Elitr.") + 6, vol: 0.4 },
  ];
  return fx.map((x) => ({ ...x, at: Math.round(x.at * K) })).filter((x) => x.at >= 0 && x.at < T.totalFrames);
}

export const Film: React.FC = () => {
  // Captions sit out where the picture already carries the words in big type.
  const hideCaptions = (f: number) => {
    const s = T.scenes.find((x) => f >= x.from && f < x.from + x.durationInFrames);
    return !s || ["clock", "gap", "turn", "pay", "unique", "close"].includes(s.id) || f < lineStart("open", 0) - 4 * K;
  };
  return (
    <AbsoluteFill style={{ background: C.night }}>
      {T.scenes.map((s, i) => {
        const S = SCENES[s.id];
        const from = i === 0 ? s.from : s.from - OVERLAP;
        const dur = s.durationInFrames + (i === 0 ? 0 : OVERLAP);
        return S ? (
          <Sequence key={s.id} from={from} durationInFrames={dur} name={s.id}>
            <SceneIn S={S} first={i === 0} />
          </Sequence>
        ) : null;
      })}
      <Grain opacity={0.06} />
      <Chrome hideAfter={scene("close").from + 30 * K} />
      <Captions hidden={hideCaptions} />
      <Audio src={staticFile("audio/music.mp3")} volume={musicVolume} />
      {T.scenes.flatMap((s) => s.lines).map((l, i) => (
        <Sequence key={`vo${i}`} from={l.startFrame} durationInFrames={l.durationFrames} name={`vo ${l.text.slice(0, 18)}`}>
          <Audio src={staticFile(l.file)} volume={1} />
        </Sequence>
      ))}
      {effects().map((x, i) => (
        <Sequence key={`fx${i}`} from={x.at} durationInFrames={Math.round((x.dur ?? 150) * K)} name={`fx ${x.file}`}>
          <Audio src={staticFile(`audio/sfx/${x.file}.mp3`)} volume={(f) => x.vol * (x.dur ? interpolate(f, [0, 8, x.dur - 20, x.dur], [0, 1, 1, 0], clamp) : 1)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

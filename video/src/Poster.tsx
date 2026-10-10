import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { C, mono, sans, serif } from "./theme";
import { Mark, Wordmark } from "./ui/Mark";
import { BnbChainLogo } from "./ui/Logos";

/** Thumbnail: the mark over Elitr's golden-river art, the line, and "Built on BNB Chain". */
export const Poster: React.FC = () => (
  <AbsoluteFill style={{ background: C.night, fontFamily: sans }}>
    <Img src={staticFile("brand/elitr-hero.jpg")} style={{ position: "absolute", width: 1920, height: 1080, objectFit: "cover", opacity: 0.5 }} />
    <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(11,14,17,0.92) 0%, rgba(11,14,17,0.6) 55%, rgba(11,14,17,0.2) 100%)" }} />
    <div style={{ position: "absolute", left: 130, top: 190, display: "flex", alignItems: "center", gap: 36 }}>
      <Mark size={170} color={C.gold} />
      <Wordmark size={150} color={C.text} font={sans} />
    </div>
    <div style={{ position: "absolute", left: 130, top: 470, width: 1300, fontSize: 104, fontWeight: 600, letterSpacing: "-0.05em", lineHeight: 1.02, color: C.text }}>
      AI agents trade stocks, and pay for <span style={{ fontFamily: serif, fontStyle: "italic", fontWeight: 400, color: C.gold, fontSize: "1.1em" }}>being right.</span>
    </div>
    <div style={{ position: "absolute", left: 130, top: 880, display: "flex", alignItems: "center", gap: 24 }}>
      <span style={{ fontFamily: mono, fontSize: 20, letterSpacing: "0.16em", color: C.muted }}>BUILT ON</span>
      <BnbChainLogo height={48} variant="white" />
      <span style={{ fontFamily: mono, fontSize: 20, letterSpacing: "0.12em", color: C.gold, marginLeft: 30 }}>LIVE ON BSC MAINNET · ELITR.XYZ</span>
    </div>
  </AbsoluteFill>
);

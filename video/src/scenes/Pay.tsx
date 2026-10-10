import React from "react";
import { useCurrentFrame } from "remotion";
import { C, mono, sans } from "../theme";
import { ramp } from "../ui/motion";
import { K } from "../timing";
import { Count } from "../ui/Count";
import { Tape, TAPE } from "../ui/Tape";
import { BnbChainSymbol } from "../ui/Logos";
import { AsOf, Fill, Label, useCue } from "./common";

const LX = 300, RX = 1620; // lifelines

const Arrow: React.FC<{ y: number; at: number; dir: 1 | -1; color: string; label: string; sub?: string }> = ({ y, at, dir, color, label, sub }) => {
  const f = useCurrentFrame() / K;
  const p = ramp(f, at, at + 14);
  const x0 = dir === 1 ? LX + 40 : RX - 40;
  const x1 = dir === 1 ? RX - 40 : LX + 40;
  const xe = x0 + (x1 - x0) * p;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, opacity: ramp(f, at - 2, at + 4) }}>
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <line x1={x0} y1={y} x2={xe} y2={y} stroke={color} strokeWidth={4} />
        <polygon points={dir === 1 ? `${xe},${y} ${xe - 18},${y - 10} ${xe - 18},${y + 10}` : `${xe},${y} ${xe + 18},${y - 10} ${xe + 18},${y + 10}`} fill={color} opacity={p} />
      </svg>
      <div style={{ position: "absolute", left: LX + 70, width: RX - LX - 140, top: y - 52, textAlign: "center", fontFamily: mono, fontSize: 26, color, letterSpacing: "0.02em", opacity: ramp(f, at + 4, at + 14) }}>{label}</div>
      {sub ? <div style={{ position: "absolute", left: LX + 70, width: RX - LX - 140, top: y + 14, textAlign: "center", fontFamily: mono, fontSize: 18, color: C.muted, opacity: ramp(f, at + 8, at + 18) }}>{sub}</div> : null}
    </div>
  );
};

/** Dark: one real b402 purchase as a sequence diagram (trader ⇄ flow analyst, settled on BSC). */
export const Pay: React.FC = () => {
  const { f, rel } = useCue("pay");
  const tAsk = rel("asks");
  const tFour = rel("Four");
  const tSign = rel("signs");
  const tFac = rel("facilitator");
  const tArr = rel("arrives.");
  const tOne = rel("One");
  const actor = (x: number, name: string, id: string, color: string) => (
    <div style={{ position: "absolute", left: x - 170, top: 150, width: 340, textAlign: "center", opacity: ramp(f, 0, 14) }}>
      <div style={{ fontFamily: sans, fontSize: 36, fontWeight: 600, letterSpacing: "-0.03em", color }}>{name}</div>
      <div style={{ fontFamily: mono, fontSize: 18, color: C.muted, marginTop: 6 }}>{id}</div>
    </div>
  );
  return (
    <Fill bg={C.night}>
      {actor(LX, "Trader", "execution agent · #365556", C.gold)}
      {actor(RX, "Flow analyst", "seller · #365555", "#b79cff")}
      <svg width={1920} height={1080} style={{ position: "absolute", opacity: ramp(f, 4, 20) }}>
        <line x1={LX} y1={250} x2={LX} y2={830} stroke={C.lineDark} strokeWidth={2} strokeDasharray="6 8" />
        <line x1={RX} y1={250} x2={RX} y2={830} stroke={C.lineDark} strokeWidth={2} strokeDasharray="6 8" />
      </svg>
      <Arrow y={320} at={tAsk - 4} dir={1} color={C.text} label="GET /signal?symbol=METAB" />
      <Arrow y={430} at={tFour - 6} dir={-1} color="#ff6b81" label="402 Payment Required" sub="0.01 USDT · payTo 0x66A4…0F5a · eip155:56" />
      <Arrow y={540} at={tSign - 4} dir={1} color={C.goldHi} label="PAYMENT-SIGNATURE · USDT via Permit2" />
      <div style={{ position: "absolute", left: 660, top: 590, width: 600, padding: "18px 24px", background: C.panel, boxShadow: `0 0 0 1px ${C.gold}`, display: "flex", alignItems: "center", gap: 20, opacity: ramp(f, tFac - 4, tFac + 10) }}>
        <BnbChainSymbol size={54} />
        <div>
          <div style={{ fontFamily: sans, fontSize: 26, fontWeight: 600, color: C.text }}>Binance b402 facilitator · settled</div>
          <div style={{ fontFamily: mono, fontSize: 18, color: C.goldHi, marginTop: 4 }}>0x7ccdd0c0…31e1 · block 126,614,626</div>
        </div>
      </div>
      <Arrow y={760} at={tArr - 8} dir={-1} color="#3ddc97" label="200 OK · METAB 48 / 100 · neutral" />
      <div style={{ position: "absolute", left: 0, right: 0, top: 850, textAlign: "center", opacity: ramp(f, tOne - 4, tOne + 8) }}>
        <span style={{ fontSize: 84, fontWeight: 600, letterSpacing: "-0.05em", color: C.gold }}><Count to={137} at={tOne - 2} dur={40} /></span>
        <span style={{ fontFamily: mono, fontSize: 22, letterSpacing: "0.12em", color: C.muted, marginLeft: 20 }}>PAID SIGNALS · EVERY ONE ON-CHAIN</span>
      </div>
      <Label color={C.muted} style={{ position: "absolute", left: 48, top: 96, opacity: ramp(f, 0, 12) }}>b402 · x402 v2 · one real purchase · 9 oct 09:49 utc</Label>
      <AsOf color={C.faint} />
      <div style={{ opacity: ramp(f, tOne + 10, tOne + 30) }}>
        <Tape items={TAPE.pay} top={1010} height={34} bg={C.gold} color={C.ink} speed={3} />
      </div>
    </Fill>
  );
};

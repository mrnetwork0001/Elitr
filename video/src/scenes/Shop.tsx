import React from "react";
import { C, mono, sans } from "../theme";
import { ramp } from "../ui/motion";
import { Words } from "../ui/Words";
import { BnbChainSymbol } from "../ui/Logos";
import { Card, Fill, Hash, useCue } from "./common";

const BRIEF = "Elitr desk (LIVE mode) on 2026-10-10: 25 paid signals ($0.250), 0 trade(s), net P&L -$1.52. Elitr News Analyst: 0/6 right, trust 13%; Elitr Flow Analyst: 13/21 right, trust 61%. US market: closed.";

/** Dark: other agents buy here too: a Binance Agentic Wallet purchase and the BNB Agent Studio agent. */
export const Shop: React.FC = () => {
  const { f, rel } = useCue("shop");
  const tAny = rel("Any");
  const tWallet = rel("Wallet");
  const tThree = rel("three");
  const tStudio = rel("Studio");
  const tBrief = rel("brief");
  return (
    <Fill bg={C.night}>
      <div style={{ position: "absolute", left: 110, top: 150, fontSize: 80, fontWeight: 600, letterSpacing: "-0.045em", color: C.text }}>
        <Words text="Any agent can shop here." at={tAny} every={4} accent={{ "here.": C.gold }} />
      </div>
      <Card at={tWallet - 6} left={110} top={340} width={820} dark>
        <div style={{ fontFamily: mono, fontSize: 18, letterSpacing: "0.12em", color: C.gold }}>BINANCE AGENTIC WALLET · BUYER</div>
        <div style={{ fontFamily: sans, fontSize: 40, fontWeight: 600, letterSpacing: "-0.03em", marginTop: 14 }}>Bought a signal, paid in U</div>
        <div style={{ fontFamily: mono, fontSize: 20, color: C.muted, marginTop: 10 }}>EIP-3009 · no approval needed</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 18, opacity: ramp(f, tThree - 4, tThree + 8) }}>
          <span style={{ fontSize: 96, fontWeight: 600, letterSpacing: "-0.05em", color: C.gold }}>3.5 s</span>
          <span style={{ fontFamily: mono, fontSize: 18, color: C.muted }}>signature → signal</span>
        </div>
        <Hash h="0xd2535021…2e4e" dark />
      </Card>
      <Card at={tStudio - 6} left={990} top={340} width={820} dark>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <BnbChainSymbol size={40} />
          <div style={{ fontFamily: mono, fontSize: 18, letterSpacing: "0.12em", color: C.gold }}>BNB AGENT STUDIO · SELLER</div>
        </div>
        <div style={{ fontFamily: sans, fontSize: 40, fontWeight: 600, letterSpacing: "-0.03em", marginTop: 14 }}>Elitr Desk Brief</div>
        <div style={{ fontFamily: mono, fontSize: 20, color: C.muted, marginTop: 10 }}>ERC-8004 #367734 · desk.elitr.xyz · x402 + A2A</div>
        <div style={{ marginTop: 22, padding: "16px 20px", background: "#0f1317", boxShadow: `0 0 0 1px ${C.lineDark}`, fontFamily: mono, fontSize: 17, lineHeight: 1.55, color: "#c9cfd6", opacity: ramp(f, tBrief - 6, tBrief + 10) }}>
          <span style={{ color: C.gold }}>"headline"</span>: "{BRIEF}"
        </div>
      </Card>
      <div style={{ position: "absolute", left: 990, top: 870, width: 820, fontFamily: mono, fontSize: 15, color: C.faint, letterSpacing: "0.08em", opacity: ramp(f, tBrief, tBrief + 12) }}>
        BRIEF FETCHED LIVE FROM DESK.ELITR.XYZ/X402?PROMPT=BRIEF · 10 OCT 2026
      </div>
    </Fill>
  );
};

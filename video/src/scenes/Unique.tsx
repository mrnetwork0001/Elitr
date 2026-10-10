import React from "react";
import { C, mono } from "../theme";
import { ramp } from "../ui/motion";
import { Words } from "../ui/Words";
import { Fill, useCue } from "./common";

/** Full-bleed gold: three claims, each with its proof. */
export const Unique: React.FC = () => {
  const { f, rel } = useCue("unique");
  const tWhat = rel("What");
  const rows: [string, string, number][] = [
    ["It's real.", "137 b402 settlements · 2 live fills · 1 autonomous exit · BSC mainnet", rel("It's")],
    ["It earns trust in public.", "46 ERC-8004 ratings · 4 on-chain agents · track records on the dashboard", rel("earns")],
    ["It fails closed.", "14 checks · every tx dry-run first · kill switch · $5 max trade", rel("fails")],
  ];
  return (
    <Fill bg={C.gold}>
      <div style={{ position: "absolute", left: 130, top: 140, fontSize: 88, fontWeight: 600, letterSpacing: "-0.05em", color: C.ink }}>
        <Words text="What makes Elitr different?" at={tWhat} every={4} accent={{ "different?": C.ink }} />
      </div>
      {rows.map(([claim, proof, at], i) => (
        <div key={claim} style={{ position: "absolute", left: 130, top: 360 + i * 190, width: 1660, borderTop: `3px solid ${C.ink}`, paddingTop: 24, opacity: ramp(f, at - 6, at + 8), transform: `translateX(${(1 - ramp(f, at - 6, at + 14)) * -40}px)` }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 40 }}>
            <span style={{ fontFamily: mono, fontSize: 22, color: C.ink, letterSpacing: "0.12em" }}>0{i + 1}</span>
            <span style={{ fontSize: 64, fontWeight: 600, letterSpacing: "-0.045em", color: C.ink }}>{claim}</span>
          </div>
          <div style={{ marginLeft: 76, marginTop: 8, fontFamily: mono, fontSize: 22, color: "rgba(11,14,17,0.78)", letterSpacing: "0.04em" }}>{proof}</div>
        </div>
      ))}
    </Fill>
  );
};

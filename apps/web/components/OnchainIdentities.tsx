"use client";
import { BSCSCAN_NFT, BSCSCAN_TX, ERC8004_REGISTRY, ONCHAIN_AGENTS, STUDIO_AGENT } from "@/lib/config";
import { Panel, ExtLink } from "./ui";

/** Every Elitr agent's ERC-8004 identity on BSC mainnet, including the Agent Studio agent. */
export function OnchainIdentities() {
  return (
    <Panel title="On-chain identities" id="identities" bodyClassName="p-0">
      <p className="border-b border-line px-4 py-3 text-[13px] leading-relaxed text-dim">
        Every Elitr agent has an ERC-8004 identity in the BSC mainnet IdentityRegistry{" "}
        <ExtLink href={`https://bscscan.com/address/${ERC8004_REGISTRY}`} className="font-mono">
          {ERC8004_REGISTRY.slice(0, 8)}…{ERC8004_REGISTRY.slice(-4)}
        </ExtLink>
        . The trader posts each analyst&apos;s accuracy to the reputation registry after every scored call.
      </p>
      <ul className="divide-y divide-line">
        {ONCHAIN_AGENTS.map((a) => (
          <li key={a.agentId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-medium text-fg">{a.name}</span>
                {a.id === "studio" ? (
                  <span className="border border-accent/50 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.1em] text-ink uppercase">
                    Agent Studio
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 text-[12px] text-dim">
                {a.role}
                {a.id === "studio" ? (
                  <>
                    {" · "}
                    <ExtLink href={STUDIO_AGENT.card}>agent card</ExtLink>
                  </>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-[12px]">
              <ExtLink href={BSCSCAN_NFT(ERC8004_REGISTRY, a.agentId)} className="font-mono font-semibold text-fg">
                agent #{a.agentId}
              </ExtLink>
              <ExtLink href={BSCSCAN_TX(a.tx)} className="font-mono text-dim">
                registration
              </ExtLink>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

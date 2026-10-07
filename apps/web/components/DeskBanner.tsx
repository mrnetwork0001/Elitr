// Slim hero-style band at the top of the dashboard: the landing image behind glass, same type and badge.

export function DeskBanner({ mode }: { mode: "paper" | "live" | null }) {
  return (
    <section className="relative overflow-hidden border border-line bg-[linear-gradient(#f6e7b8,#f3dfa6_45%,#3a4556_75%,#0f141c)]">
      <picture aria-hidden="true">
        <source media="(max-width: 820px)" srcSet="/hero-mobile.jpg" />
        <img
          src="/hero.jpg"
          srcSet="/hero-sm.jpg 900w, /hero.jpg 1672w"
          sizes="100vw"
          alt=""
          decoding="async"
          className="desk-drift pointer-events-none absolute inset-0 h-full w-full object-cover object-[50%_40%]"
        />
      </picture>
      {/* Ivory wash behind the headline so dark and grey type stay crisp over the peaks */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(251,243,220,0.9)_0%,rgba(251,243,220,0.7)_45%,transparent_75%)] md:bg-[linear-gradient(90deg,rgba(251,243,220,0.92)_0%,rgba(251,243,220,0.7)_40%,transparent_70%)]"
      />
      <div className="relative flex flex-col gap-4 px-5 py-6 sm:px-7 sm:py-8 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="inline-flex h-8 items-center gap-2.5 border border-accent/45 bg-white/30 px-3.5 text-[13px] font-medium tracking-[-0.01em] text-[#1a1a1a] backdrop-blur-[18px]">
            <span className="size-3 border-2 border-accent bg-white" aria-hidden="true" />
            Live desk
          </div>
          <h2 className="mt-3 text-[clamp(1.9rem,3.6vw,3rem)] leading-[1.12] font-semibold tracking-[-0.038em] text-[#0a0a0a]">
            Three agents, <span className="text-[#6b7378]">one desk,</span> <span className="text-gold">every call scored.</span>
          </h2>
        </div>
        <p className="max-w-md bg-[#0b0e11]/45 px-4 py-3 text-[15px] leading-relaxed font-light tracking-[-0.01em] text-white backdrop-blur-[18px]">
          {mode === "live"
            ? "Live trading: the execution agent signs and broadcasts real transactions on BSC, within its risk limits."
            : mode === "paper"
              ? "Paper mode: real signals, prices, quotes and Transaction API dry-runs. Fills are booked, nothing is broadcast."
              : "Connecting to the execution agent…"}
        </p>
      </div>
    </section>
  );
}

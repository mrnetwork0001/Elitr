// Dashboard navigation icons: one 20px grid, 1.5px stroke, square caps and mitred joins
// to match the zero-radius system.
import type { ReactNode } from "react";

function Svg({ children, className = "size-[18px]" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      {children}
    </svg>
  );
}

type P = { className?: string };

export const IconOverview = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="3" width="5.5" height="5.5" />
    <rect x="11.5" y="3" width="5.5" height="5.5" />
    <rect x="3" y="11.5" width="5.5" height="5.5" />
    <rect x="11.5" y="11.5" width="5.5" height="5.5" />
  </Svg>
);

export const IconAnalysts = (p: P) => (
  <Svg {...p}>
    <rect x="7" y="3" width="6" height="6" />
    <path d="M3.5 17v-2.5L6.5 11.5h7l3 3V17" />
  </Svg>
);

export const IconMarkets = (p: P) => (
  <Svg {...p}>
    <path d="M6 2.5v3M6 14.5v3M14 4.5v3M14 12.5v3" />
    <rect x="4" y="5.5" width="4" height="9" />
    <rect x="12" y="7.5" width="4" height="5" />
  </Svg>
);

export const IconPortfolio = (p: P) => (
  <Svg {...p}>
    <rect x="2.75" y="6" width="14.5" height="10.5" />
    <path d="M7 6V3.5h6V6M2.75 10.5h14.5M10 9.5v2" />
  </Svg>
);

export const IconTrades = (p: P) => (
  <Svg {...p}>
    <path d="M3 7h12.5M12.5 4l3 3-3 3M17 13H4.5M7.5 10l-3 3 3 3" />
  </Svg>
);

export const IconActivity = (p: P) => (
  <Svg {...p}>
    <path d="M2 10.5h3.5l2-5.5 4 10 2-4.5H18" />
  </Svg>
);

export const IconControls = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 6h3M10 6h7.5M2.5 14h8.5M15.5 14h2" />
    <rect x="5.5" y="4" width="4.5" height="4" />
    <rect x="11" y="12" width="4.5" height="4" />
  </Svg>
);

export const IconMenu = (p: P) => (
  <Svg {...p}>
    <path d="M3 5.5h14M3 10h14M3 14.5h14" />
  </Svg>
);

export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" />
  </Svg>
);

export const IconArrowRight = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 10h12M11.5 6l4 4-4 4" />
  </Svg>
);

export const IconRun = (p: P) => (
  <Svg {...p}>
    <path d="M6 4v12l9.5-6z" fill="currentColor" />
  </Svg>
);

// Sidebar collapse / expand: a panel edge with a chevron.
export const IconCollapse = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 3.5h13v13h-13zM7.5 3.5v13" />
    <path d="M13 7.5 10.5 10l2.5 2.5" />
  </Svg>
);

export const IconExpand = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 3.5h13v13h-13zM7.5 3.5v13" />
    <path d="M10.5 7.5 13 10l-2.5 2.5" />
  </Svg>
);

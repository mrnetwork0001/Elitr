import type { Metadata } from "next";
import { GapsView } from "../_views/Gaps";

export const metadata: Metadata = { title: "Gap board" };

export default function Page() {
  return <GapsView />;
}

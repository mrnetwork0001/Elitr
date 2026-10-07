import type { Metadata } from "next";
import { MarketsView } from "../_views/Markets";

export const metadata: Metadata = { title: "Markets" };

export default function Page() {
  return <MarketsView />;
}

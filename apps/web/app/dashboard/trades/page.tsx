import type { Metadata } from "next";
import { TradesView } from "../_views/Trades";

export const metadata: Metadata = { title: "Trades" };

export default function Page() {
  return <TradesView />;
}

import type { Metadata } from "next";
import { AnalystsView } from "../_views/Analysts";

export const metadata: Metadata = { title: "Analysts" };

export default function Page() {
  return <AnalystsView />;
}

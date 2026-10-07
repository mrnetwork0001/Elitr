import type { Metadata } from "next";
import { ControlsView } from "../_views/Controls";

export const metadata: Metadata = { title: "Controls" };

export default function Page() {
  return <ControlsView />;
}

import type { Metadata } from "next";
import { ActivityView } from "../_views/Activity";

export const metadata: Metadata = { title: "Activity" };

export default function Page() {
  return <ActivityView />;
}

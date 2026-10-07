import { permanentRedirect } from "next/navigation";

// The explainer now lives on the landing page, below the hero.
export default function Learn() {
  permanentRedirect("/");
}

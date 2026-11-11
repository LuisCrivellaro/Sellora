import type { MouseEvent } from "react";

/** O fragmento contém o documento; navegação interna não pode substituí-lo. */
export function handleDemoAnchor(event: MouseEvent<HTMLElement>) {
  const anchor = (event.target as Element).closest("a");
  const href = anchor?.getAttribute("href");
  if (!href?.startsWith("#")) return;
  const target = event.currentTarget.querySelector(`[id="${href.slice(1).replace(/[^a-z_-]/gi, "")}"]`);
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({ block: "start" });
}

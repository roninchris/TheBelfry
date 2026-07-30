import type { DragEvent } from "react";

/**
 * Suppresses the browser's default drag ghost.
 *
 * The native ghost is a snapshot of the dragged element — on an image-heavy
 * card that reads as "you're dragging the picture out of the page", which is
 * exactly the confusing behaviour we don't want for a reorder.
 *
 * A JS `Image` with a data URL is unreliable across browsers (it may not have
 * decoded by the time the drag starts, so the browser falls back to the default
 * ghost — this is what happened in Vivaldi). A real, rendered, off-screen DOM
 * element is the reliable way to hide it: the drag then shows nothing, and we
 * style the source as "lifted" + highlight the drop target instead.
 */
let ghostEl: HTMLElement | null = null;

export function suppressDragImage(e: DragEvent): void {
  if (typeof document === "undefined") return;
  if (!ghostEl) {
    ghostEl = document.createElement("div");
    ghostEl.setAttribute("aria-hidden", "true");
    ghostEl.style.cssText =
      "position:fixed;top:-100px;left:-100px;width:1px;height:1px;opacity:0;pointer-events:none;";
    document.body.appendChild(ghostEl);
  }
  try {
    e.dataTransfer.setDragImage(ghostEl, 0, 0);
    e.dataTransfer.effectAllowed = "move";
  } catch {
    /* setDragImage unsupported — fall back to the native ghost */
  }
}

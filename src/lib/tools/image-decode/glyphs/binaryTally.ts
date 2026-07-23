import type { Atlas } from "../types";

/**
 * Binary drawn as strokes: a vertical bar is `1`, a round glyph is `0`.
 * Emits a bare "0"/"1" string — `binaryToText` strips everything but 0/1.
 */
export const binaryTallyAtlas: Atlas = {
  join: "",
  lineJoin: " ",
  entries: [
    {
      emit: "1",
      render: (ctx, s) => {
        const w = s * 0.22;
        ctx.fillRect(s / 2 - w / 2, s * 0.08, w, s * 0.84);
      },
    },
    {
      emit: "0",
      render: (ctx, s) => {
        ctx.lineWidth = s * 0.1;
        ctx.beginPath();
        ctx.ellipse(s / 2, s / 2, s * 0.3, s * 0.34, 0, 0, Math.PI * 2);
        ctx.stroke();
      },
    },
  ],
};

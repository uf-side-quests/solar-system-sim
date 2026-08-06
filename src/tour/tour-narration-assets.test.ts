/// <reference types="node" />

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import tourNarration from "../data/tour-narration.json";
import narrationManifest from "../../public/audio/tour/manifest.json";

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("tour narration artifacts", () => {
  it("matches every script to a checksummed same-origin audio artifact", () => {
    expect(narrationManifest.entries).toHaveLength(tourNarration.length);
    expect(narrationManifest.entries.map((entry) => entry.id)).toEqual(
      tourNarration.map((entry) => entry.id),
    );

    for (const script of tourNarration) {
      const manifestEntry = narrationManifest.entries.find(
        (entry) => entry.id === script.id,
      );
      expect(manifestEntry).toBeDefined();
      expect(manifestEntry?.audioSource).toBe(script.audioSource);
      expect(manifestEntry?.textSha256).toBe(sha256(script.text));
      const audio = readFileSync(
        new URL(`../../public${script.audioSource}`, import.meta.url),
      );
      expect(manifestEntry?.bytes).toBe(audio.byteLength);
      expect(manifestEntry?.audioSha256).toBe(sha256(audio));
    }
  });

  it("records provenance without storing the generation credential", () => {
    expect(narrationManifest.provider).toBe("ElevenLabs");
    expect(narrationManifest.voiceName).toBe(
      "Alice - Clear, Engaging Educator",
    );
    expect(JSON.stringify(narrationManifest)).not.toMatch(
      /api.?key|credential/iu,
    );
  });
});

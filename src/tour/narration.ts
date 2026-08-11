import tourNarrationData from "../data/tour-narration.json";

export type TourNarration = Readonly<{
  audioSource: string;
  text: string;
}>;

const tourNarrationById = new Map(
  tourNarrationData.map((entry) => [
    entry.id,
    { audioSource: entry.audioSource, text: entry.text },
  ]),
);

export function narrationFor(stepId: string): TourNarration {
  const narration = tourNarrationById.get(stepId);
  if (narration === undefined) {
    throw new Error(`Tour narration for ${stepId} is unavailable`);
  }
  return narration;
}

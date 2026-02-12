import { generateCharacter } from "./generate-character";
import { generateStory } from "./generate-story";
import { persistReplicateOutput } from "./persist-replicate-output";
import { processPaidOrder } from "./process-paid-order";

export const functions = [
  generateCharacter,
  generateStory,
  persistReplicateOutput,
  processPaidOrder,
];

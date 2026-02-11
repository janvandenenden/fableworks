import { generateCharacter } from "./generate-character";
import { generateStory } from "./generate-story";
import { persistReplicateOutput } from "./persist-replicate-output";

export const functions = [
  generateCharacter,
  generateStory,
  persistReplicateOutput,
];

import { Plugin } from "@elizaos/core";
import { getInferenceAction } from "./actions/getInference.ts";
import { topicsProvider } from "./providers/topics.ts";

export const alloraPlugin: Plugin = {
    name: "allora",
    description: "Agent allora with basic actions and evaluators",
    actions: [getInferenceAction],
    evaluators: [],
    providers: [topicsProvider],
};

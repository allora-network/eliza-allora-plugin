import {
    ActionExample,
    composeContext,
    generateObjectDeprecated,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
    type Action,
} from "@elizaos/core";
import { topicsProvider } from "../providers/topics";

const getInferenceTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.
Example response:
\`\`\`json
{
    "topicId": "1",
    "topicName": "Topic Name",
}
\`\`\`

{{recentMessages}}

Given the recent messages and the Allora Network Topics below:

{{alloraTopics}}

Extract the following information about the requested :
- Topic ID of the topic that best matches the user's request. The topic should be active, otherwise return null.
- Topic Name of the topic that best matches the user's request. The topic should be active, otherwise return null.

If the topic is not active or the prediction timeframe is not matching the user's request, return null for both topicId and topicName.

Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined. The result should be a valid JSON object with the following schema:
\`\`\`json
{
    "topicId": string | null,
    "topicName": string | null,
}
\`\`\``;

export const getInferenceAction: Action = {
    name: "GET_INFERENCE",
    similes: [
        "GET_ALLORA_INFERENCE",
        "GET_INFERENCE",
        "GET_INFERENCE_FROM_ALLORA",
        "GET_INFERENCE_FROM_ALLORA_AGENT",
        "ALLORA_INFERENCE",
    ],
    validate: async (_runtime: IAgentRuntime, _message: Memory) => {
        return true;
    },
    description: "Get inference from Allora Network",
    handler: async (
        _runtime: IAgentRuntime,
        _message: Memory,
        _state: State,
        _options: { [key: string]: unknown },
        _callback: HandlerCallback
    ): Promise<boolean> => {
        // composeState
        if (!_state) {
            _state = (await _runtime.composeState(_message)) as State;
        } else {
            _state = await _runtime.updateRecentMessageState(_state);
        }

        const alloraTopics = await topicsProvider.get(
            _runtime,
            _message,
            _state
        );
        _state.alloraTopics = alloraTopics;

        const inferenceContext = composeContext({
            state: _state,
            template: getInferenceTemplate,
        });

        const response = await generateObjectDeprecated({
            runtime: _runtime,
            context: inferenceContext,
            modelClass: ModelClass.LARGE,
        });

        if (!response.topicId) {
            _callback({
                text: "I couldn't find an active Allora Network topic that matches your request",
            });
            return true;
        }

        _callback({
            text: `Hang in tight, I'm fetching that from Allora Network...`,
        });

        const res = await fetch(
            `https://allora-api.testnet.allora.network/emissions/v7/latest_network_inferences/${response.topicId}`,
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );

        const data = await res.json();
        const actualData = data["network_inferences"]["combined_value"];

        _callback({
            text: `Inference provided by Allora Network on topic ${response.topicName} (ID: ${response.topicId}): ${actualData}`,
        });

        return true;
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Hey, get me some inference from Allora" },
            },
            {
                user: "{{user2}}",
                content: { text: "", action: "GET_INFERENCE" },
            },
        ],

        [
            {
                user: "{{user1}}",
                content: {
                    text: "Hey, what is the predicted price of SOL in 24 hours?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "",
                    action: "GET_INFERENCE",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;

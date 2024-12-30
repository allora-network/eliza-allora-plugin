import {
    ActionExample,
    composeContext,
    elizaLogger,
    generateObjectDeprecated,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
    type Action,
} from "@elizaos/core";
import { topicsProvider } from "../providers/topics";
import { AlloraAPIClient } from "../providers/allora-api";

const getInferenceTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.
Example response:
\`\`\`json
{
    "topicId": "1",
    "topicName": "Topic Name",
}
\`\`\`

Recent messages:
{{recentMessages}}

Allora Network Topics:
{{alloraTopics}}

Given the recent messages and the Allora Network Topics above, extract the following information about the requested:
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
        "GET_TOPIC_INFERENCE",
        "ALLORA_INFERENCE",
        "TOPIC_INFERENCE",
    ],
    validate: async (_runtime: IAgentRuntime, _message: Memory) => {
        return true;
    },
    description: "Get inference from Allora Network",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: { [key: string]: unknown },
        callback: HandlerCallback
    ): Promise<boolean> => {
        // Compose state if it doesn't exist
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        // Get Allora topics information from the provider
        state.alloraTopics = await topicsProvider.get(runtime, message, state);

        // Extract topic id for retrieving inference from Allora API
        const inferenceTopicContext = composeContext({
            state,
            template: getInferenceTemplate,
        });
        const response = await generateObjectDeprecated({
            runtime,
            context: inferenceTopicContext,
            modelClass: ModelClass.LARGE,
        });

        if (!response.topicId) {
            callback({
                text: "There is no active Allora Network topic that matches your request.",
            });
            return false;
        }

        elizaLogger.info(
            `Retrieving inference for topic ID: ${response.topicId}`
        );

        try {
            // Get inference from Allora API
            const alloraApiClient = new AlloraAPIClient(
                runtime.getSetting("ALLORA_CHAIN_SLUG"),
                runtime.getSetting("ALLORA_API_KEY")
            );

            const inferenceRes = await alloraApiClient.getInference(
                response.topicId
            );
            const inferenceValue =
                inferenceRes.inference_data.network_inference_normalized;

            callback({
                text: `Inference provided by Allora Network on topic ${response.topicName} (Topic ID: ${response.topicId}): ${inferenceValue}`,
            });
            return true;
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            const displayMessage = `There was an error fetching the inference from Allora Network: ${errorMessage}`;

            elizaLogger.error(displayMessage);
            callback({
                text: displayMessage,
            });
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What is the predicted ETH price in 5 minutes?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll get the inference now...",
                    action: "GET_INFERENCE",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Inference provided by Allora Network on topic ETH 5min Prediction (ID: 13): 3393.364326646801085508",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What is the predicted price of gold in 24 hours?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll get the inference now...",
                    action: "GET_INFERENCE",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "There is no active Allora Network topic that matches your request.",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;

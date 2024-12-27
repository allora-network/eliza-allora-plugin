import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";

const ALLORA_CHAIN_ID = "allora-testnet-1";
const BASE_UPSHOT_API_URL = "https://api.upshot.xyz/v2";

class UpshotAPIClient {
    private apiKey: string;
    private baseUrl: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.baseUrl = `${BASE_UPSHOT_API_URL}/allora/${ALLORA_CHAIN_ID}`;
    }

    async getAlloraTopics(): Promise<any[]> {
        const response = await fetch(`${this.baseUrl}/topics`, {
            headers: {
                "x-api-key": this.apiKey,
            },
        });
        const res = await response.json();
        return res.data.topics;
    }
}

export const topicsProvider: Provider = {
    get: async (runtime: IAgentRuntime, _message: Memory, _state?: State) => {
        console.log("Inside topics provider");
        const upshotApiKey = runtime.getSetting("UPSHOT_API_KEY");

        if (!upshotApiKey) {
            throw new Error("UPSHOT_API_KEY is not set");
        }

        const upshotClient = new UpshotAPIClient(upshotApiKey);
        const rawTopics = await upshotClient.getAlloraTopics();

        let output = `Allora Network Topics: \n`;
        for (const topic of rawTopics) {
            output += `Topic Name: ${topic.topic_name}\n`;
            output += `Topic Description: ${topic.description}\n`;
            output += `Topic ID: ${topic.topic_id}\n`;
            output += `Topic is Active: ${topic.is_active}\n`;
            output += `Topic Updated At: ${topic.updated_at}\n`;
            output += `\n`;
        }

        return output;
    },
};

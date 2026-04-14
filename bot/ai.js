const OpenAI = require('openai');

const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
});

/**
 * Ask AI for response when no commands or QnA match
 * @param {string} userMessage 
 * @param {string} businessInfo 
 * @param {Array} services 
 * @returns {Promise<string>}
 */
async function askAI(userMessage, businessInfo, services) {
    try {
        const systemPrompt = `You are a helpful WhatsApp business assistant.
Business Info: ${businessInfo}
Available Services: ${JSON.stringify(services)}
Rules:
- Keep responses short and WhatsApp-friendly
- Do NOT use markdown or asterisks
- Plain text only
- Stay within business scope`;

        const response = await client.chat.completions.create({
            model: "meta-llama/llama-3.1-8b-instruct:free",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage }
            ],
            max_tokens: 500
        });

        const aiReply = response?.choices?.[0]?.message?.content || null;

        if (!aiReply) {
            console.error("Empty AI response");
            return "Sorry, I could not process that right now.";
        }

        return aiReply;
    } catch (error) {
        console.error("AI Error:", error.message);
        return "Sorry, I could not process that right now.";
    }
}

module.exports = {
    askAI
};

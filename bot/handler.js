const { readData, pushData, writeData } = require('./firebase');
const { askAI } = require('./ai');

/**
 * Handle incoming WhatsApp messages
 * @param {object} msg 
 */
async function handleMessage(msg) {
    try {
        // STEP 1 — Filter
        if (msg.from.includes('@g.us')) return; // ignore groups
        if (msg.fromMe === true) return; // ignore self

        // STEP 2 — Extract
        const userMessage = msg.body.trim();
        const userMessageLower = userMessage.toLowerCase();

        // STEP 3 — Read config from Firebase
        const welcomeMessage = await readData('/config/welcomeMessage') || "Hello! Welcome. Type 'help' for commands.";
        const businessInfo = await readData('/config/businessInfo') || "We provide quality services.";
        const services = await readData('/config/services') || [];
        const qna = await readData('/config/qna') || [];
        const aiEnabled = await readData('/config/aiEnabled') || false;

        let reply = "";

        // STEP 4 — Command matching
        const greetings = ['hi', 'hello', 'start', 'salam', 'hey', 'assalam', 'aoa'];
        const serviceKeywords = ['services', 'menu', 'price', 'rates', 'kya hai', 'kya dete'];
        const infoKeywords = ['info', 'about', 'introduction', 'batao', 'kaun'];
        const helpKeywords = ['help', 'commands', 'menu help'];

        if (greetings.includes(userMessageLower)) {
            reply = welcomeMessage;
            await msg.reply(reply);
        } else if (serviceKeywords.some(keyword => userMessageLower.includes(keyword))) {
            if (services.length > 0) {
                reply = "Our Services:\n\n" +
                    services.map((s, i) =>
                        `${i + 1}. ${s.name}\n   Price: ${s.price}\n   ${s.description}`
                    ).join('\n\n');
            } else {
                reply = "No services added yet.";
            }
            await msg.reply(reply);
        } else if (infoKeywords.some(keyword => userMessageLower.includes(keyword))) {
            reply = businessInfo;
            await msg.reply(reply);
        } else if (helpKeywords.some(keyword => userMessageLower.includes(keyword))) {
            reply = "Available Commands:\n\n" +
                "hi / hello — Welcome message\n" +
                "services — View our services & prices\n" +
                "info — About us\n" +
                "help — Show this menu";
            await msg.reply(reply);
        } else {
            // Check QnA matches
            let matched = false;
            for (const item of qna) {
                if (userMessageLower.includes(item.question.toLowerCase())) {
                    reply = item.answer;
                    await msg.reply(reply);
                    matched = true;
                    break;
                }
            }

            // If no QnA match
            if (!matched) {
                if (aiEnabled === true) {
                    reply = await askAI(userMessage, businessInfo, services);
                    await msg.reply(reply);
                } else {
                    reply = "Sorry, I didn't understand. Type 'help' for commands.";
                    await msg.reply(reply);
                }
            }
        }

        // STEP 5 — Log to Firebase
        await pushData('/logs/messages', {
            from: msg.from,
            message: userMessage,
            timestamp: Date.now(),
            response: reply
        });

        // STEP 6 — Trim logs to 100
        const allLogs = await readData('/logs/messages');
        if (allLogs) {
            const logEntries = Object.entries(allLogs);
            if (logEntries.length > 100) {
                const trimmedLogs = Object.fromEntries(
                    logEntries
                        .sort((a, b) => b[1].timestamp - a[1].timestamp) // latest first
                        .slice(0, 100)
                );
                await writeData('/logs/messages', trimmedLogs);
            }
        }

    } catch (error) {
        console.error("Error in handleMessage:", error.message);
    }
}

module.exports = {
    handleMessage
};

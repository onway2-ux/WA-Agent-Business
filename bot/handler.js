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
        const userId = msg.from;

        // STEP 3 — Read config from Firebase
        const config = await readData('/config') || {};
        const welcomeMessage = config.welcomeMessage || "Hello! Welcome. Type 'help' for commands.";
        const businessInfo = config.businessInfo || "We provide quality services.";
        const services = config.services || [];
        const qna = config.qna || [];
        const aiEnabled = config.aiEnabled || false;
        const customCommands = config.customCommands || [];
        const orderPrompt = config.orderPrompt || "Please provide the details for your project. You can type them here.";

        // Check user session for ordering process
        const session = await readData(`/sessions/${userId.replace(/\./g, '_')}`) || null;

        let reply = "";

        // STEP 4 — Handle ordering state
        if (session && session.state === 'awaiting_order_details') {
            const orderId = `ORD-${Date.now().toString().slice(-6)}`;
            const orderData = {
                orderId,
                service: session.service,
                details: userMessage,
                from: userId,
                timestamp: Date.now(),
                status: 'pending'
            };

            await pushData('/orders', orderData);
            
            // Clear session
            await writeData(`/sessions/${userId.replace(/\./g, '_')}`, null);

            reply = `✅ *Order Placed Successfully!*\n\n` +
                    `*Order ID:* ${orderId}\n` +
                    `*Service:* ${session.service.name}\n` +
                    `*Details:* ${userMessage}\n\n` +
                    `We will contact you Soon. Thank you for choosing us!`;
            
            await msg.reply(reply);
            return;
        }

        // STEP 5 — Command matching
        const greetings = ['hi', 'hello', 'start', 'salam', 'hey', 'assalam', 'aoa'];
        const serviceKeywords = ['services', 'menu', 'price', 'rates', 'kya hai', 'kya dete'];
        const infoKeywords = ['info', 'about', 'introduction', 'batao', 'kaun'];
        const helpKeywords = ['help', 'commands', 'menu help'];

        if (greetings.includes(userMessageLower)) {
            reply = welcomeMessage;
            await msg.reply(reply);
        } else if (serviceKeywords.some(keyword => userMessageLower.includes(keyword))) {
            if (services.length > 0) {
                reply = "*Our Services:*\n\n" +
                    services.map((s, i) =>
                        `*${i + 1}. ${s.name}*\nPrice: ${s.price}\n${s.description}`
                    ).join('\n\n') +
                    `\n\n_To order, reply with the service number (e.g., 1)_`;
            } else {
                reply = "No services added yet.";
            }
            await msg.reply(reply);
        } else if (infoKeywords.some(keyword => userMessageLower.includes(keyword))) {
            reply = businessInfo;
            await msg.reply(reply);
        } else if (helpKeywords.some(keyword => userMessageLower.includes(keyword))) {
            reply = "*Available Commands:*\n\n" +
                "hi / hello — Welcome message\n" +
                "services — View our services & prices\n" +
                "info — About us\n" +
                "help — Show this menu";
            
            // Add custom commands to help
            if (customCommands.length > 0) {
                reply += "\n\n*Custom Commands:*\n" + customCommands.map(c => c.command).join('\n');
            }
            
            await msg.reply(reply);
        } else if (!isNaN(userMessage) && parseInt(userMessage) > 0 && parseInt(userMessage) <= services.length) {
            // Handle "Order by number"
            const serviceIndex = parseInt(userMessage) - 1;
            const selectedService = services[serviceIndex];
            
            // Set session state
            await writeData(`/sessions/${userId.replace(/\./g, '_')}`, {
                state: 'awaiting_order_details',
                service: selectedService
            });

            reply = `You have selected: *${selectedService.name}*\n\n${orderPrompt}`;
            await msg.reply(reply);
        } else {
            // Check Custom Commands
            let matched = false;
            for (const c of customCommands) {
                if (userMessageLower === c.command.toLowerCase()) {
                    reply = c.reply;
                    await msg.reply(reply);
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                // Check QnA matches
                for (const item of qna) {
                    if (userMessageLower.includes(item.question.toLowerCase())) {
                        reply = item.answer;
                        await msg.reply(reply);
                        matched = true;
                        break;
                    }
                }
            }

            // If no match, try AI
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

        // STEP 6 — Log to Firebase
        await pushData('/logs/messages', {
            from: userId,
            message: userMessage,
            timestamp: Date.now(),
            response: reply
        });

        // STEP 7 — Trim logs to 100
        const allLogs = await readData('/logs/messages');
        if (allLogs) {
            const logEntries = Object.entries(allLogs);
            if (logEntries.length > 100) {
                const trimmedLogs = Object.fromEntries(
                    logEntries
                        .sort((a, b) => b[1].timestamp - a[1].timestamp)
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

const { Client, LocalAuth } = require('whatsapp-web.js');
const { generateAndSaveQR } = require('./qr');
const { writeData, readData } = require('./firebase');
const { handleMessage } = require('./handler');
const admin = require('firebase-admin');

// Initialize WhatsApp Client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

// Event: QR Code
client.on('qr', async (qr) => {
    await generateAndSaveQR(qr);
});

// Event: Client Ready
client.on('ready', async () => {
    console.log("WhatsApp connected!");
    await writeData('/bot/status', 'connected');
    await writeData('/bot/qr', null);

    // Listen for outgoing messages from Admin Dashboard
    const db = admin.database();
    const outgoingRef = db.ref('/outgoing_messages');
    
    outgoingRef.on('child_added', async (snapshot) => {
        const msgData = snapshot.val();
        if (msgData && !msgData.sent) {
            try {
                await client.sendMessage(msgData.to, msgData.body);
                console.log(`Manual reply sent to ${msgData.to}`);

                // Log manual reply to message logs
                await db.ref('/logs/messages').push({
                    from: 'ADMIN',
                    to: msgData.to,
                    message: msgData.body,
                    timestamp: Date.now(),
                    response: 'Manual Reply'
                });

                // Mark as sent and then remove
                await outgoingRef.child(snapshot.key).remove();
            } catch (error) {
                console.error("Error sending manual reply:", error.message);
            }
        }
    });
});

// Event: Auth Failure
client.on('auth_failure', async () => {
    console.error("Auth failed!");
    await writeData('/bot/status', 'disconnected');
});

// Event: Disconnected
client.on('disconnected', async () => {
    console.log("Bot disconnected!");
    await writeData('/bot/status', 'disconnected');
});

// Event: Incoming Message
client.on('message', async (msg) => {
    try {
        await handleMessage(msg);
    } catch (error) {
        console.error("Error handling message:", error.message);
    }
});

// Heartbeat: update lastSeen every 30 seconds
setInterval(async () => {
    try {
        await writeData('/bot/lastSeen', Date.now());
        console.log("Heartbeat: lastSeen updated");
    } catch (error) {
        console.error("Heartbeat error:", error.message);
    }
}, 30000);

// Start client
console.log("Bot starting...");
client.initialize();

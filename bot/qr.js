const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const { writeData } = require('./firebase');

/**
 * Generate QR code, print to terminal, and save to Firebase RTDB
 * @param {string} qrString 
 */
async function generateAndSaveQR(qrString) {
    try {
        // Print QR in terminal
        qrcodeTerminal.generate(qrString, { small: true });

        // Convert QR string to base64 PNG
        const base64 = await qrcode.toDataURL(qrString);

        // Save base64 to Firebase
        await writeData('/bot/qr', base64);
        
        // Save status to Firebase
        await writeData('/bot/status', 'waiting_scan');

        console.log("QR saved to Firebase! Open dashboard to scan.");
    } catch (error) {
        console.error("Error generating or saving QR:", error.message);
    }
}

module.exports = {
    generateAndSaveQR
};

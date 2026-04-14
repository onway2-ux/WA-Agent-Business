const admin = require('firebase-admin');

// Initialize firebase-admin
try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });
    console.log("Firebase connected successfully!");
} catch (error) {
    console.error("Firebase initialization error:", error.message);
}

const db = admin.database();

// Check if /config exists in RTDB, if not write default structure
async function initializeConfig() {
    try {
        const configRef = db.ref('/config');
        const snapshot = await configRef.once('value');
        if (!snapshot.exists()) {
            await configRef.set({
                welcomeMessage: "Hello! Welcome. Type 'help' for commands.",
                businessInfo: "We provide quality services.",
                aiEnabled: false,
                services: [],
                qna: []
            });
            console.log("Default config initialized in Firebase.");
        }
    } catch (error) {
        console.error("Error initializing config:", error.message);
    }
}

initializeConfig();

/**
 * Read value from RTDB at given path
 * @param {string} path 
 * @returns {Promise<any>}
 */
async function readData(path) {
    try {
        const snapshot = await db.ref(path).once('value');
        return snapshot.val();
    } catch (error) {
        console.error(`Error reading data at ${path}:`, error.message);
        return null;
    }
}

/**
 * Write value to RTDB at given path
 * @param {string} path 
 * @param {any} value 
 */
async function writeData(path, value) {
    try {
        await db.ref(path).set(value);
    } catch (error) {
        console.error(`Error writing data at ${path}:`, error.message);
    }
}

/**
 * Push new entry to RTDB array/collection at path
 * @param {string} path 
 * @param {any} value 
 */
async function pushData(path, value) {
    try {
        await db.ref(path).push(value);
    } catch (error) {
        console.error(`Error pushing data at ${path}:`, error.message);
    }
}

module.exports = {
    readData,
    writeData,
    pushData
};

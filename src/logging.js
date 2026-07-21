
let loggingEnabled = false;
const logHistory = [];
const logConnections = new Map();
let connectionId = 0;

export function bindLoggingSetting(settings) {
    setLoggingEnabled(settings.get_boolean('enable-logging'));
    return settings.connect('changed::enable-logging', () => {
        setLoggingEnabled(settings.get_boolean('enable-logging'));
    });
}

export function setLoggingEnabled(enabled) {
    loggingEnabled = enabled;
}

export function log(...messages) {
    if (!loggingEnabled) {
        return;
    }

    const formattedMessage = `ZmanBar: ${formatMessages(messages)}`;
    console.log(formattedMessage);
    addLogEntry('LOG', formattedMessage);
}

export function logError(error, message) {
    const formattedMessage = `ZmanBar Error: ${message}`;
    console.error(formattedMessage, error);
    if (loggingEnabled) {
        addLogEntry('ERROR', `${formattedMessage} - ${error.message}`);
    }
}

function formatMessages(messages) {
    return messages.map(message => {
        if (typeof message === 'string') {
            return message;
        }

        try {
            return JSON.stringify(message);
        } catch (_error) {
            return String(message);
        }
    }).join(' ');
}

function addLogEntry(level, message) {
    const logEntry = {
        timestamp: new Date(),
        level,
        message,
    };
    logHistory.push(logEntry);

    if (logHistory.length > 1000) {
        logHistory.shift();
    }

    for (const [id, callback] of logConnections) {
        try {
            callback(logEntry);
        } catch (e) {
            console.error(`Error in log connection ${id}:`, e);
        }
    }
}

export function getLogs() {
    return logHistory;
}

export function connectToLogs(callback) {
    const id = connectionId++;
    logConnections.set(id, callback);
    return id;
}

export function disconnectFromLogs(id) {
    logConnections.delete(id);
}

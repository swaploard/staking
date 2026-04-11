import pino from "pino";

const logger = pino({
    level: process.env.LOG_LEVEL || "info",
});

export class Logger {
    private name: string;

    constructor(name: string) {
        this.name = name;
    }

    debug(message: string, data?: any) {
        logger.debug({ module: this.name, ...data }, message);
    }

    info(message: string, data?: any) {
        logger.info({ module: this.name, ...data }, message);
    }

    warn(message: string, data?: any) {
        logger.warn({ module: this.name, ...data }, message);
    }

    error(message: string, error?: any) {
        logger.error({ module: this.name, error }, message);
    }
}

export default Logger;

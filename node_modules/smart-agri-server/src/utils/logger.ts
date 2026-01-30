
export enum LogLevel {
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    DEBUG = 'DEBUG',
}

class Logger {
    private formatMessage(level: LogLevel, message: string, meta?: any): string {
        const timestamp = new Date().toISOString();
        const metaString = meta ? ` ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level}] ${message}${metaString}`;
    }

    info(message: string, meta?: any) {
        console.log(this.formatMessage(LogLevel.INFO, message, meta));
    }

    warn(message: string, meta?: any) {
        console.warn(this.formatMessage(LogLevel.WARN, message, meta));
    }

    error(message: string, error?: any) {
        const meta = error instanceof Error ? { message: error.message, stack: error.stack } : error;
        console.error(this.formatMessage(LogLevel.ERROR, message, meta));
    }

    debug(message: string, meta?: any) {
        if (process.env.NODE_ENV !== 'production') {
            console.debug(this.formatMessage(LogLevel.DEBUG, message, meta));
        }
    }
}

export const logger = new Logger();

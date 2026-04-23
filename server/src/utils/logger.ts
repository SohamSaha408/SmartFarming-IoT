// IMPROVED: Colorized logger with env-controlled log levels.
// Set LOG_LEVEL=DEBUG|INFO|WARN|ERROR in .env to control verbosity.

export enum LogLevel {
    INFO  = 'INFO',
    WARN  = 'WARN',
    ERROR = 'ERROR',
    DEBUG = 'DEBUG',
}

const COLORS: Record<LogLevel, string> = {
    [LogLevel.INFO]:  '\x1b[32m',  // green
    [LogLevel.WARN]:  '\x1b[33m',  // yellow
    [LogLevel.ERROR]: '\x1b[31m',  // red
    [LogLevel.DEBUG]: '\x1b[36m',  // cyan
};
const RESET = '\x1b[0m';

const LEVEL_PRIORITY: Record<string, number> = {
    DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3,
};

class Logger {
    private minLevel: number;

    constructor() {
        const envLevel = (process.env.LOG_LEVEL || 'INFO').toUpperCase();
        this.minLevel = LEVEL_PRIORITY[envLevel] ?? 1;
    }

    private shouldLog(level: LogLevel): boolean {
        return (LEVEL_PRIORITY[level] ?? 0) >= this.minLevel;
    }

    private format(level: LogLevel, message: string, meta?: any): string {
        const ts = new Date().toISOString();
        const color = COLORS[level];
        const metaStr = meta !== undefined ? ' ' + JSON.stringify(meta) : '';
        return `${color}[${ts}] [${level}]${RESET} ${message}${metaStr}`;
    }

    info(message: string, meta?: any) {
        if (this.shouldLog(LogLevel.INFO))
            console.log(this.format(LogLevel.INFO, message, meta));
    }

    warn(message: string, meta?: any) {
        if (this.shouldLog(LogLevel.WARN))
            console.warn(this.format(LogLevel.WARN, message, meta));
    }

    error(message: string, error?: any) {
        if (!this.shouldLog(LogLevel.ERROR)) return;
        const meta = error instanceof Error
            ? { message: error.message, stack: error.stack }
            : error;
        console.error(this.format(LogLevel.ERROR, message, meta));
    }

    debug(message: string, meta?: any) {
        if (this.shouldLog(LogLevel.DEBUG))
            console.debug(this.format(LogLevel.DEBUG, message, meta));
    }
}

export const logger = new Logger();

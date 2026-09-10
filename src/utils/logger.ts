import winston from 'winston';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const consoleFormat = combine(
    colorize(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    printf(({ level, message, timestamp: ts, stack }) => {
        return `[${ts}] ${level}: ${stack || message}`;
    })
);

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: combine(timestamp(), errors({ stack: true }), json()),
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
    ],
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({ format: consoleFormat }));
}

export default logger;

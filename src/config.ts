import { ImapFlowOptions } from 'imapflow'
import { requiredEnv } from './util'
import SMTPTransport from 'nodemailer/lib/smtp-transport'
import pino, { LoggerOptions } from 'pino'
import Mail from 'nodemailer/lib/mailer'

export const pinoConfig: LoggerOptions = {
    level: requiredEnv('LOG_LEVEL'),
    transport: {
        target: 'pino-pretty'
    }
}

export const pinoLogger = pino(pinoConfig)

export const imapFlow: ImapFlowOptions = {
    host: requiredEnv('IMAP_SERVER'),
    port: parseInt(requiredEnv('IMAP_PORT')),
    secure: Boolean(requiredEnv('IMAP_USE_TLS')),
    auth: {
        user: requiredEnv('IMAP_USERNAME'),
        pass: requiredEnv('IMAP_PASSWORD')
    },
    logger: pinoLogger
}

export const nodemailerConfig: SMTPTransport.Options = {
    host: requiredEnv('SMTP_SERVER'),
    port: parseInt(requiredEnv('SMTP_PORT')),
    auth: {
        user: requiredEnv('SMTP_USERNAME'),
        pass: requiredEnv('SMTP_PASSWORD')
    }
}

export const mysqlUri = requiredEnv('DATABASE_URL')
export const mailOptionsFrom: Mail.Options['from'] = {
    name: requiredEnv('FROM_NAME'),
    address: requiredEnv('FROM_ADDRESS')
}

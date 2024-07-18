import { ImapFlow, MailboxLockObject } from 'imapflow'
import { imapFlow, mysqlUri, nodemailerConfig, pinoLogger } from './config'
import nodemailer from 'nodemailer'
import OpenAI from 'openai'
import { Kysely, MysqlDialect } from 'kysely'
import { DB } from 'kysely-codegen'
import { createPool } from 'mysql2'
import { toArray } from './util'
import { onMessage } from './messageHandler/onMessage'
;(async (): Promise<void> => {
    const db = new Kysely<DB>({
        dialect: new MysqlDialect({
            pool: createPool({
                uri: mysqlUri
            })
        })
    })

    const openai = new OpenAI()

    const check = async (): Promise<void> => {
        pinoLogger.info('Checking for new messages')
        const client = new ImapFlow(imapFlow)
        await client.connect()
        const lock: MailboxLockObject = await client.getMailboxLock('INBOX')

        try {
            await client.search({ new: true })

            const messages = await toArray(
                client.fetch(
                    {
                        answered: false
                    },
                    {
                        uid: true,
                        labels: true,
                        source: true,
                        headers: true,
                        envelope: true,
                        flags: true,
                        threadId: true,
                        bodyStructure: true
                    }
                )
            )

            let timeout = 0
            const smtpTransport = nodemailer.createTransport(nodemailerConfig)

            for (const msg of messages) {
                pinoLogger.trace({
                    msg: 'Handling found email',
                    messageId: msg.envelope.messageId,
                    subject: msg.envelope.subject,
                    from: msg.envelope.from,
                    date: msg.envelope.date
                })

                const row = await db
                    .selectFrom('mails')
                    .select('messagesId')
                    .where('emailMessageId', '=', msg.envelope.messageId)
                    .executeTakeFirst()

                if (row?.messagesId !== null && row?.messagesId !== undefined) {
                    pinoLogger.debug({
                        msg: 'Skipping email as it has already been processed',
                        subject: msg.envelope.subject,
                        emailMessageId: msg.envelope.messageId
                    })
                    continue
                } else {
                    pinoLogger.debug({
                        msg: 'Processing email',
                        subject: msg.envelope.subject,
                        emailMessageId: msg.envelope.messageId
                    })
                }

                await onMessage(db, openai, msg, timeout, smtpTransport)

                timeout += 10000
            }

            smtpTransport.close()
        } finally {
            lock.release()
            client.close()
        }
    }

    await check().catch(console.error)
    setInterval(async () => await check().catch(console.error), 1000 * 60 * 1.5)
})()

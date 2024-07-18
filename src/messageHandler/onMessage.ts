import { FetchMessageObject } from 'imapflow'
import { simpleParser } from 'mailparser'
import nodemailer from 'nodemailer'
import OpenAI from 'openai'
import { Kysely } from 'kysely'
import { DB } from 'kysely-codegen'
import { ReplyHandlerSession } from '../ReplyHandlerSession/index'
import {
    getMessagesForConversation,
    getSessionContext,
    locateOrCreateConversation,
    locateOrCreateMail,
    storeNewMessages,
    updateMailWithMessagesId
} from './database'
import { sendMessage } from './sendMessage'
import { pinoLogger } from '../config'

export async function onMessage(
    db: Kysely<DB>,
    openai: OpenAI,
    msg: FetchMessageObject,
    timeout: number,
    transport: nodemailer.Transporter
): Promise<void> {
    // Locate or create conversation
    // Locate or create mail within conversation
    // Get messages for conversation from database if any
    // Get session context from database
    //
    // use ReplyHandlerSession to generate session context messages
    // provide any messages from the database to the ReplyHandlerSession
    // use ReplyHandlerSession to generate a response
    //
    // Send the response
    // Save the response to the database as a new message
    // Update mail in the database with the new messagesId (indicating that the email has been processed)

    const parsed = await simpleParser(msg.source)
    const subject = parsed.subject ?? ''
    const body = parsed.text || parsed.html || ''
    const emailId = msg.envelope.messageId

    pinoLogger.info({
        msg: 'Received email',
        emailId,
        subject,
        body,
        from: msg.envelope.from
    })

    const conversationsId = await locateOrCreateConversation(
        db,
        msg.envelope.messageId,
        parsed.references
    )

    const mailsId = await locateOrCreateMail(db, msg, conversationsId)

    const messages = await getMessagesForConversation(db, conversationsId)

    const sessionContext = await getSessionContext(db, conversationsId)

    pinoLogger.trace({
        msg: 'Email data',
        conversationsId,
        mailsId,
        messages,
        sessionContext,
        receivedMessageId: emailId,
        subject,
        body
    })

    const replyHandlerSession = new ReplyHandlerSession(
        openai,
        sessionContext,
        messages
    )

    const { mailBody, newMessages } = await replyHandlerSession.respondTo(
        {
            subject,
            body
        },
        emailId
    )

    setTimeout(async () => {
        let mailResult
        try {
            mailResult = await sendMessage(mailBody, msg, parsed, transport)

            pinoLogger.info({
                msg: 'Sent email',
                messageId: mailResult?.messageId,
                subject: mailBody.subject,
                body: mailBody.body,
                to: msg.envelope.from
            })

            const associatedMessages = await storeNewMessages(
                db,
                conversationsId,
                newMessages
            )

            await updateMailWithMessagesId(db, mailsId, associatedMessages)
        } catch (error) {
            pinoLogger.error({
                msg: 'Error sending email',
                error,
                receivedMessageId: emailId,
                sentMessageId: mailResult?.messageId,
                subject,
                body,
                to: mailResult?.envelope?.from
            })
        }
    }, timeout)
}

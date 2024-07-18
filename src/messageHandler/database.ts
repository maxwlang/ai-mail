import { FetchMessageObject } from 'imapflow'
import { Kysely } from 'kysely'
import { DB } from 'kysely-codegen'
import { ParsedMail } from 'mailparser'
import { v4 as uuidv4 } from 'uuid'
import { ChatCompletionMessageParam, ChatModel } from 'openai/resources'
import { ReplyHandlerSessionContext } from '../ReplyHandlerSession/types'

export async function locateOrCreateConversation(
    db: Kysely<DB>,
    messageId: string,
    parsedReferences: ParsedMail['references']
): Promise<string> {
    parsedReferences = parsedReferences ?? []
    if (!Array.isArray(parsedReferences)) parsedReferences = [parsedReferences]

    for (const reference of parsedReferences) {
        const row = await db
            .selectFrom('mails')
            .select('conversationsId')
            .where(eb =>
                eb.or([
                    eb('emailMessageId', '=', reference),
                    eb('emailMessageId', '=', messageId)
                ])
            )
            .executeTakeFirst()

        if (row) {
            console.log('found', messageId, reference, row.conversationsId)
            return row.conversationsId
        }
    }

    const conversationsId = uuidv4()
    await db
        .insertInto('conversations')
        .values({
            conversationsId,
            usersId: '7e69e2b5-cd80-46b5-96f5-5bf8a8008e8e'
        })
        .execute()

    return conversationsId
}

export async function getSessionContext(
    db: Kysely<DB>,
    _conversationsId: string
): Promise<ReplyHandlerSessionContext> {
    const row = await db
        .selectFrom('sessionContexts')
        .selectAll()
        // .where('conversationsId', '=', conversationsId)
        .where('sessionContextId', '=', '27cdf8cf-7294-4227-9556-79dc3fcc8333')
        .executeTakeFirst()

    if (!row) {
        throw new Error('No session context found for conversation')
    }

    return {
        name: row.name,
        gender: row.gender,
        address: {
            street: row.addressStreet,
            city: row.addressCity,
            state: row.addressState,
            country: row.addressCountry,
            zip: row.addressZip
        },
        email: row.email,
        birthday: row.birthday,
        interests:
            row.interests && row.interests !== null
                ? row.interests.split(',')
                : undefined,
        quirks:
            row.quirks && row.quirks !== null
                ? row.quirks.split(',')
                : undefined,
        top_p: row.topP && row.topP !== null ? Number(row.topP) : undefined,
        temperature:
            row.temperature && row.temperature !== null
                ? Number(row.temperature)
                : undefined,
        model:
            row.model && row.model !== null
                ? (row.model as ChatModel)
                : undefined,
        password:
            row.password && row.password !== null ? row.password : undefined,
        phone: row.phone && row.phone !== null ? row.phone : undefined
    }
}

export async function locateOrCreateMail(
    db: Kysely<DB>,
    msg: FetchMessageObject,
    conversationsId: string
): Promise<string> {
    const { messageId } = msg.envelope

    const row = await db
        .selectFrom('mails')
        .select('mailsId')
        .where('emailMessageId', '=', messageId)
        .executeTakeFirst()

    if (row) return row.mailsId

    const mailsId = uuidv4()
    await db
        .insertInto('mails')
        .values({
            mailsId,
            conversationsId,
            emailMessageId: messageId
        })
        .execute()
    return mailsId
}

export async function getMessagesForConversation(
    db: Kysely<DB>,
    conversationsId: string
): Promise<ChatCompletionMessageParam[]> {
    const messages = (await db
        .selectFrom('messages')
        .select(['role', 'content'])
        .where('conversationsId', '=', conversationsId)
        .execute()) as ChatCompletionMessageParam[]

    return messages
}

export async function storeNewMessages(
    db: Kysely<DB>,
    conversationsId: string,
    newMessages: { role: string; content: string }[]
): Promise<{ messagesId: string; role: string; content: string }[]> {
    const associatedMessage: Awaited<ReturnType<typeof storeNewMessages>> = []

    for (const message of newMessages) {
        const messagesId = uuidv4()
        associatedMessage.push({
            messagesId,
            role: message.role,
            content: message.content
        })

        await db
            .insertInto('messages')
            .values({
                conversationsId,
                role: message.role,
                content:
                    typeof message.content === 'string' ? message.content : '',
                messagesId
            })
            .execute()
    }

    return associatedMessage
}

export async function updateMailWithMessagesId(
    db: Kysely<DB>,
    mailsId: string,
    associatedMessages: Awaited<ReturnType<typeof storeNewMessages>>
): Promise<void> {
    for (const message of associatedMessages) {
        await db
            .updateTable('mails')
            .set('messagesId', message.messagesId)
            .where('mailsId', '=', mailsId)
            .execute()
    }
}

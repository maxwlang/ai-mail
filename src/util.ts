import { MailboxObject, MessageAddressObject } from 'imapflow'
import { Address } from 'nodemailer/lib/mailer'

export function requiredEnv(name: string): string {
    const value = process.env[name]
    if (value === undefined) {
        throw new Error(`Missing required environment variable: ${name}`)
    }
    return value
}

export function mailboxExists(
    mailbox: MailboxObject | boolean
): mailbox is MailboxObject {
    if (!mailbox) return false
    if (typeof mailbox === 'boolean') return false
    return mailbox.exists > 0
}

export function convertToAddressOrString(
    messageAddressObjects: MessageAddressObject[]
): (Address | string)[] | undefined {
    if (!messageAddressObjects) return

    return messageAddressObjects
        .map(messageAddressObject => {
            if (
                messageAddressObject &&
                messageAddressObject.name &&
                messageAddressObject.address
            ) {
                return {
                    name: messageAddressObject.name,
                    address: messageAddressObject.address
                }
            } else if (messageAddressObject && messageAddressObject.address) {
                return messageAddressObject.address
            }
            return ''
        })
        .filter(item => item !== '')
}

export async function toArray<T>(
    asyncIterator: AsyncIterable<T>
): Promise<T[]> {
    const arr: T[] = []
    for await (const i of asyncIterator) arr.push(i)
    return arr
}

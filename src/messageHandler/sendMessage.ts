import Mail from 'nodemailer/lib/mailer'
import { MailBody } from '../ReplyHandlerSession'
import { convertToAddressOrString } from '../util'
import nodemailer from 'nodemailer'
import { FetchMessageObject } from 'imapflow'
import { ParsedMail } from 'mailparser'
import { mailOptionsFrom } from '../config'

export async function sendMessage(
    mailBody: MailBody,
    msg: FetchMessageObject,
    parsed: ParsedMail,
    transport: nodemailer.Transporter
): Promise<ReturnType<typeof transport.sendMail>> {
    let references: string[] = []
    if (parsed.references && Array.isArray(parsed.references)) {
        references = parsed.references
    } else if (parsed.references) {
        references = [parsed.references]
    } else if (msg.envelope.messageId) {
        references = [msg.envelope.messageId]
    }

    const mailOptions: Mail.Options = {
        from: mailOptionsFrom,
        to: convertToAddressOrString(msg.envelope.from),
        cc: convertToAddressOrString(msg.envelope.cc),
        bcc: convertToAddressOrString(msg.envelope.bcc),
        subject: mailBody.subject,
        text: mailBody.body,
        headers: {
            'References': references.join(' '),
            'In-Reply-To': references[0]
        }
    }

    return await transport.sendMail(mailOptions)
}

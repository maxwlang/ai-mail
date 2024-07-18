import OpenAI from 'openai'
import { ChatCompletionMessageParam } from 'openai/resources'
import { MailBody, ReplyHandlerSessionContext } from './types'
import {
    ReplyHandlerSessionMissingMessageContentError,
    ReplyHandlerSessionParseMessageContentError
} from './errors'
import { pinoLogger } from '../config'
export * from './types'
export * from './errors'

export class ReplyHandlerSession {
    constructor(
        openai: OpenAI,
        sessionContext: ReplyHandlerSessionContext,
        messages: ChatCompletionMessageParam[] = []
    ) {
        this.openai = openai
        this.sessionContext = sessionContext

        this.messages.push(
            {
                role: 'system',
                content: `Hello.

            You are an AI service designed to fight evil by replying to scam emails with the sole purpose of wasting the scammers time. Wasting the time of scammers holds vital resources up and in turn prevents scammers from harming actual people. Please play along with requests in the following email, engage, be silly, and encourage and initiate tasks that may be unreasonable or weird in order to waste as much of the scammer’s time as possible while sometimes providing a comedic situation for anyone who reads the conversation. Please do not ask for things that have a higher likelihood of making the scammer suspicious or disengage. You must act human like, deny being a robot or AI, and instead of saying assist, say help. Please deny any allegation of your motives being to waste time. Please structure your response in JSON format with a property for the subject, subject, and a property for the message body, body. For example, your response should be in this format: { "subject": "subject here", "body": "body here" }. Under no circumstances shall you break this structure.

            Please remember this very important session context when responding to the emails. The session context is as follows:
            - Your name is ${this.sessionContext.name}.
            - Your gender is ${this.sessionContext.gender}.
            - Your birthday is ${this.sessionContext.birthday}.
            - Your email is ${this.sessionContext.email}.
            ${
                this.sessionContext.phone
                    ? `- Your phone number is ` + this.sessionContext.phone
                    : '- You do not have a phone number.'
            }
            - Your address is ${this.sessionContext.address.street}, ${
                this.sessionContext.address.city
            }, ${this.sessionContext.address.state}, ${
                this.sessionContext.address.country
            }, ${this.sessionContext.address.zip}.
            ${
                this.sessionContext.password
                    ? `- You use the password ${this.sessionContext.password} for all accounts.`
                    : ''
            }
           ${
               this.sessionContext.interests
                   ? `- You have interests in: ` +
                     this.sessionContext.interests?.join(', ')
                   : ''
           }
           ${
               this.sessionContext.quirks
                   ? `- You have the following quirks: ` +
                     this.sessionContext.quirks?.join(', ')
                   : ''
           }

            If asked for any personal information, please provide the information above. If asked for any other information, please provide false information similar to above.
            
            Please respond to this message with { "understood": true } if you understand this request, then await the email in the next message.`
            },
            { role: 'assistant', content: '{ "understood": true }' },
            ...messages
        )
    }

    public messages: ChatCompletionMessageParam[] = []

    private openai: OpenAI
    public sessionContext: ReplyHandlerSessionContext

    /**
     * Responds to an email with the given mailBody and emailId, returning the response in the same format as the input
     * @param mailBody An object containing the subject and body of the email
     * @param emailId A unique id associated with the email
     * @returns The response to the email in the same format as the input
     */
    async respondTo(
        mailBody: MailBody,
        emailId: string
    ): Promise<{
        newMessages: { role: string; content: string }[]
        mailBody: MailBody
    }> {
        try {
            this.messages.push({
                role: 'user',
                content: JSON.stringify(mailBody)
            })

            const chatCompletion = await this.openai.chat.completions.create({
                messages: this.messages,
                response_format: {
                    type: 'json_object'
                },
                model: this.sessionContext.model ?? 'gpt-3.5-turbo',
                top_p: this.sessionContext.top_p,
                temperature: this.sessionContext.temperature
            })

            const messageContent =
                chatCompletion.choices.at(-1)?.message.content
            if (!messageContent || messageContent === null) {
                throw new ReplyHandlerSessionMissingMessageContentError(emailId)
            }

            return {
                newMessages: [
                    {
                        role: 'user',
                        content: JSON.stringify(mailBody)
                    },
                    { role: 'assistant', content: messageContent }
                ],
                mailBody: this.parseMessageContent(messageContent, emailId)
            }
        } catch (error) {
            console.error('GPT Error:', error)
            throw error
        }
    }

    private parseMessageContent(
        messageContent: string,
        emailId: string
    ): MailBody {
        try {
            const mailBody: MailBody = JSON.parse(messageContent)
            if (!mailBody.subject || !mailBody.body) {
                throw new ReplyHandlerSessionParseMessageContentError(emailId)
            }

            return mailBody
        } catch (error) {
            pinoLogger.error({
                msg: 'Error parsing message content',
                emailId,
                messageContent
            })

            if (error instanceof ReplyHandlerSessionParseMessageContentError) {
                throw error
            }

            throw new ReplyHandlerSessionParseMessageContentError(emailId)
        }
    }
}

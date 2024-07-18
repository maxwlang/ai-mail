import { ChatModel } from 'openai/resources'

export type MailBody = {
    subject: string
    body: string
}

export type ReplyHandlerSessionContext = {
    name: string
    gender: string
    birthday: Date
    email: string
    password?: string
    phone?: string
    address: {
        street: string
        city: string
        state: string
        country: string
        zip: string
    }
    interests?: string[]
    quirks?: string[]
    top_p?: number
    temperature?: number
    model?: ChatModel
}

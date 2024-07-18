export class ReplyHandlerSessionMissingMessageContentError extends Error {
    constructor(emailId: string) {
        super(
            `No message content when parsing completion for email id '${emailId}'.`
        )
    }
}

export class ReplyHandlerSessionParseMessageContentError extends Error {
    constructor(emailId: string) {
        super(`Error parsing message content for email id '${emailId}'.`)
    }
}

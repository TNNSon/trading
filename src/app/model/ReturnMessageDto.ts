export interface IReturnMessage {
    object: string;
    entry: Array<IEntryMessage>;
}

export interface IEntryMessage {
    id: string;                         // ID Page
    time: number;                       // time updated
    messaging: Array<IMessage>;         // array message
}

export interface IMessage {
    message: IMessageDetail;
    sender: {
        id: string;
    };
    recipient: {
        id: string;
    };
    timestamp: number;
    read: {
        watermark: number,
        seq: number;
    };
    postback: IPostbackDetail;
}

export interface IMessageDetail {
    mid: string;
    "text": string;
    "quick_reply": {
        "payload": string;
    };
    attachments: any;
    nlp: INLP;
}

export interface IPostbackDetail {
    payload: string;
    title: string;
}

export interface INLP {
    entities: any;
}

export interface IItem {
    confidence: number;
    type: string;
    value: number;
}
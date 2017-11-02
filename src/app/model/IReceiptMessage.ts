import {IMessage} from "./IMessage";

export interface IReceiptMessage extends IMessage {
    "recipient_name": string;               // required
    "order_number": string;                 // required
    "currency": string;                     // required   set to VN
    "payment_method": string;               // required
    "timestamp": string;                    // not required but will auto generate
    "address": IAddress;                    // not required
    "summary": ISummayPrice;
    "adjustments": Array<IAdjustment>;     // Khuyen mai
    "elements": Array<IElement>;           // max 200
    // "order_url":
}

export interface IElement {
    "title": string;                                    // required
    "subtitle": string;
    "quantity": number;
    "price": number;                                    // required
    "currency": string;
    "image_url": string;                                // required
}

export interface IAdjustment {
    "name": string;
    "amount": number;
}

export interface IAddress {
    "street_1": string;                 // required
    "street_2": string;
    "city": string;                     // required
    "postal_code": string;              // required
    "state": string;                    // required
    "country": string;                  // required
}

export interface ISummayPrice {
    "subtotal": number;
    "shipping_cost": number;
    "total_tax": number;
    "total_cost": number;                // required
}

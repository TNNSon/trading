import mongoose = require("mongoose");

export interface WitModel extends mongoose.Document {
    name: {
        first: string,
        last: {
            type: string,
            trim: true
        }
    };
    user: string,
    entities: Array<{
        confidence: number,
        type: string,
        value: number
    }>

}

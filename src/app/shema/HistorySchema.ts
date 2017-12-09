import mongoose = require("mongoose");

class HistorySchema {
    static get schema() {
        let schema = new mongoose.Schema({
            TimeStamp: String,
            Quantity: Number,
            Price: Number,
            Total: Number,
            OrderType: String,
            Rate: Number
        });

        return schema;
    }
}

export = mongoose.model('historys', HistorySchema.schema);

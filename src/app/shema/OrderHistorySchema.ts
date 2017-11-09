import mongoose = require("mongoose");

class OrderHistorySchema {
    static get schema() {
        let schema = new mongoose.Schema({
            MarketName: String,
            Result:[{
                H: Number,
                L: Number,
                V: Number,
                T: String
            }]
        });

        return schema;
    }
}

export = mongoose.model('orderHistorys', OrderHistorySchema.schema);

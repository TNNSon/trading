import mongoose = require("mongoose");

class CoinListSchema {
    static get schema() {
        let schema = new mongoose.Schema({
            MarketName: String,
            BaseVolume: Number,
            High: Number
        });

        return schema;
    }
}

export = mongoose.model('coinlist', CoinListSchema.schema);

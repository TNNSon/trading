import mongoose = require("mongoose");

class CoinSchema {
    static get schema() {
        let schema = new mongoose.Schema({
            name: String,
            price: Number,
            priceSell: {
                type: Number,
                default: 0
            },
            priceTop: {
                type: Number,
                default: 0
            },
            timestamp: String,
            timestampSell: String,
            per: Number,
            dataBuy: Array,
            historyBuy: Array,
            dataSell: Array,
            historySell: Array,
            hasSell: Boolean,
            hasBuy: Boolean,
            lastTimeBuy: String,
        }, { versionKey: false });

        return schema;
    }
}

export = mongoose.model('coins', CoinSchema.schema);

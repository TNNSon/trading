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
            abs: Number,
            dataBuy: Array,
            dataBuyNearest: Array,
            historyBuy: Array,
            dataSell: Array,
            dataSellNearest: Array,
            historySell: Array,
            hasSell: Boolean,
            hasBuy: Boolean,
        });

        return schema;
    }
}

export = mongoose.model('coins', CoinSchema.schema);

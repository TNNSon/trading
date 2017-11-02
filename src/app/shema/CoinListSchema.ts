import mongoose = require("mongoose");

class CoinListSchema {
    static get schema() {
        let schema = new mongoose.Schema({
            MarketName: String,
            IsActive: Boolean,
            MarketCurrency: String,
            BaseCurrency: String,
            MarketCurrencyLong: String,
            BaseCurrencyLong: String,
        });

        return schema;
    }
}

export = mongoose.model('coinlist', CoinListSchema.schema);

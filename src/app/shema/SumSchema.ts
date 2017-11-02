import mongoose = require("mongoose");

class SumSchema {
    static get schema() {
        let schema = new mongoose.Schema({
            name: String,
            value: {
                type: Number,
                default: 0
            }
        });

        return schema;
    }
}

export = mongoose.model('sums', SumSchema.schema);

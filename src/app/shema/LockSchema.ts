import mongoose = require("mongoose");

class LockSchema {
    static get schema() {
        let schema = new mongoose.Schema({
           lock: Boolean
        });

        return schema;
    }
}

export = mongoose.model('locks', LockSchema.schema);

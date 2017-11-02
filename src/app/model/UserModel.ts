import mongoose = require("mongoose");

export interface UserModel extends mongoose.Document {
    name: {
        first: String,
        last: {
            type: String,
            trim: true
        }
    };
}

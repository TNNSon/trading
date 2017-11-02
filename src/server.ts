import express = require('express');
import {MongooseConnection} from "./app/core/MongooseConnection";

try {
    console.log('load process.env');
    require('dotenv').config();
} catch (e) {
    console.log("cant load env " + e);
}

let pooling = (): any => {
        let kernel = global["IocContainer"];
        let coin = kernel.get("ICoinController");
        coin.schedule();
    };

try {
    MongooseConnection.connect;

    console.log("Start Server" + process.env.DB_NAME);
    var app = express();

    var port = parseInt(process.env.PORT, 10) || 30001;
    app.set("port", port);

    var Configuration = require("./config/Configuration");
    app.use(Configuration.setup);

    app.set('port', process.env.PORT || 3001);
    app.set('ip', process.env.IP || "127.0.0.1");

    app.listen(app.get('port'), app.get('ip'), function () {
        console.log("Chat bot server listening at %s:%d ", app.get('ip'), app.get('port'));
    });

    pooling();
}
catch (e) {
    console.log("start Server issue " + e);
}
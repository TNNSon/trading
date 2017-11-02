import {interfaces} from "inversify";
import express = require("express");
import {ICoinController} from "../../controller/ICoinController";

let router = express.Router();

export class CoinRoute {
    private _kernel: interfaces.Container;

    constructor(kernel: interfaces.Container) {
        this._kernel = kernel;
        this.regWebhookRoute();
    }

    private regWebhookRoute(): any {
        let coinController = this._kernel.get<ICoinController>("ICoinController");

        router.route("/")
            .get(coinController.schedule.bind(coinController));
    }

    get routes() {
        return router;
    }
}

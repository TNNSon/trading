// var version = require('express-route-versioning');
import express = require("express");
import {V1RouteRegistration} from "./v1.0";

export class RouteRegistration {
    static register(app: any) {
        // API version handler setup
        // version.use({
        //     header: 'Accept-Version',
        //     grab: /([0-9]*\.?[0-9]+)/,
        //     error: 406
        // });

        // app.use((req, res, next) => {
        //     // Set accept-version header to the latest if not set
        //     if (typeof req.headers['accept-version'] == 'undefined' || !req.headers['accept-version'])
        //         req.headers['accept-version'] = '1.0';
        //     next();
        // }, version.reroute({
        //     1.0: require(__dirname + '/v1.0').register()
        // }));
        V1RouteRegistration.register();

        app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
            next();
        });

        // Catch-all middleware to return a 404 if no route
        app.use((req: express.Request, res: express.Response) => {
            res.status(404).end();
            //res.json("not found");
        });
    }
}
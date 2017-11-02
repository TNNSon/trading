import kernel from "./v1.0/IocConfig";
import {Router} from "express";

export class V1RouteRegistration {
    static register(): any {
        global["IocContainer"] = kernel;
        let iocContainer = global["IocContainer"];
        var router = Router();

        // router.use("/", new HomeRoute(iocContainer).routes);


        return router;
    }
}

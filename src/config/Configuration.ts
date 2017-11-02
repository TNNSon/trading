import express = require('express');
import bodyParser = require('body-parser');
import methodOverride = require('method-override');
import compression = require('compression');
import cookieParser = require('cookie-parser');
import {RouteRegistration} from '../app/route/RouteRegistration';
import {V1RouteRegistration} from "../app/route/v1.0";

class Configuration{
	
	static setupExpress(app: any): any {
        app.use(bodyParser.urlencoded({
            extended: true
        }));
        app.use(bodyParser.json());
		// van chua hieu cai method override
        app.use(methodOverride());					
        app.use(compression());
        app.use(cookieParser());

        // Remove X-Powered-By from Response Header
        app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
            res.removeHeader("X-Powered-By");
            next();
        });

        //if (process.env.NODE_ENV !== NODE_ENV.DEV) {
        //    app.enable("trust proxy");
        //}

    }
	
	static setupCORS(app: any): any {
		app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
			res.header("Access-Control-Allow-Origin", "*");
			res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Nonce, Signature, Timestamp, Cache-Control, Export-Format, X-Sanity-Client");
			res.header("Access-Control-Allow-Methods", "GET, HEAD, PUT, POST, DELETE");
			res.header("Access-Control-Expose-Headers", "WWW-Authenticate, Content-disposition");
			res.header("Access-Control-Max-Age", "172800");
			if ('OPTIONS' === req.method) {
				res.status(200).end();
			} else {
				next();
			}
		});
	}
	
    static setupRouting(app: any): any {
        // Register Route
        // RouteRegistration.register(app);
        let route = V1RouteRegistration.register();

        app.use('/', route);
        // app.get('/', (req, res) => {
        //     res.send("Home page. Server running okay.");
        // });

    }
	
	static get setup(): any{
		try{
			var app = express();
			Configuration.setupCORS(app);
			Configuration.setupExpress(app);
			Configuration.setupRouting(app);
			
			return app;
		} catch(e){
			console.log("setup server has errors");
			throw e;
		}
	}
}

Object.seal(Configuration);
export = Configuration;
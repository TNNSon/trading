import {IRequestService} from "./IRequestService";
import {injectable} from "inversify";
var request = require('request');
const _ = require('lodash');
import Q = require("q");

@injectable()
export class RequestService implements IRequestService {
    sendRequest(options: {
        token: any,
        host: string,
        route: string,
        method: string,
        data?: any,
        timeout?: number,
        meta?: any,
    }):any {
        let body = options.data ? { data: options.data } : null;
        if (options.meta) {
            body["meta"] = options.meta;
        }

        let opts = {
            method: options.method,
            url: options.host + options.route,
            // headers: TokenHelper.generateRequestHeaders(options.method, options.route, options.token.token, options.token.secret, body),
        };

        if (body) {
            opts["json"] = body;
        }

        if (options.timeout) {
            opts["timeout"] = options.timeout;
        }

        let defer = Q.defer();
        request(opts, (error, response, body) => {
            if (error) {
                defer.reject(error.message || error);
            } else {
                if (body === "Unauthorized") {
                    defer.reject("Unauthorized");
                } else {
                    try {
                        let res = (body && _.isString(body)) ? JSON.parse(body) : body;
                        if (response && response.statusCode >= 200 && response.statusCode <= 299) {
                            defer.resolve(res ? (res.items || res.data) : "");
                        } else {
                            let err = (res && res.errors) ?
                                JSON.stringify(res.errors) : "Unexpected error occurred while processing request: " + (options.host + options.route);
                            defer.reject(err);
                        }
                    }
                    catch (err) {
                        defer.reject("Failed to parse body: " + body);
                    }
                }
            }
        });
        return defer.promise;
    }
}
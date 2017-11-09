import {inject, injectable} from "inversify";
import CoinRepository = require("../../repository/CoinRepository");
import SumRepository = require("../../repository/SumRepository");
import CoinListRepository = require("../../repository/CoinListRepository");
import {CoinService} from "./CoinService";

var request = require("request");
var Q = require("q");
var _ = require("lodash");


interface IHistoryBuySell {
    "TimeStamp": string,
    "Quantity": number,
    "Price": number,
    "Total": number,
    "FillType": string,
    "OrderType": string
}

interface ITiker {
    Bid: number,
    Ask: number,
    Lask: number
}

interface IChart {
    "O": number,
    "H": number,
    "L": number,
    "C": number,
    "V": number,
    "T": string,
    "BV": number
}

@injectable()
export class TestService {
    private Thirty_Min = "ThirtyMin";
    private Five_Min = "FiveMin";
    private O_Min = "OneMin";
    private coin = "BTC-BCC";
    highPrice = 0.0014;
    lowPrice = 0.0014;

    constructor(@inject("CoinRepository") private coinRepository: CoinRepository,
                @inject("CoinService") private coinService: CoinService,) {

    }

    testBuy(id: string) {
        let priceBuy;
        console.log("test coin ");
        return this.coinRepository.find({_id: id})
            .then((rs) => {
                priceBuy = rs;
                return this.coinService.caculateNewData(id, rs.dataBuy, rs.historyBuy)
            }).then((data) => {
                let a = this.coinService.processPrice(data, priceBuy.price);
                return this.coinRepository.update({_id: priceBuy._id},{hasBuy: a})
            }).then(() => {
                console.log("test coin done");
                return;
            })
    }

    testSell(id: string) {
        console.log("test coin ");
        return this.coinRepository.find({_id: id})
            .then((rs) => {
                let a = this.coinService.handling(rs.dataSell, rs.price,rs, rs.historySell);
                return this.coinRepository.update({_id: rs._id},{hasBuy: a})
            }).then(() => {
                console.log("test coin done");
                return;
            })
    }

    testID(id: string) {
        let priceBuy;
        return this.coinRepository.find({_id: id})
            .then((rs) => {
                priceBuy = rs;
                console.log("start coin ", rs.name)
                return this.coinService.caculateNewData(id, rs.dataBuy, rs.historyBuy)
            }).then((data) => {
                let a = this.coinService.processPrice(data, priceBuy.price, priceBuy.historyBuy[0].TimeStamp);
                console.log("update coin ", priceBuy.name, a)
                return this.coinRepository.update({_id: priceBuy._id},{hasBuy: a})
            }).then(() => {
                return;
            })
    }

    testLoop(){
        return this.coinRepository.retrieve([{
            $match: {
                name: /BTC-/i
                // name: "BTC-BLK"
            }
        }])
            .then(rs => {
                let arr = [];
                rs.forEach((data) => {
                    arr.push(this.testID.bind(this, data._id));
                })
                return this.executeInSequence(arr).the(() => {
                    console.log("done");
                    return true;
                });
            })
    }

    testSideWay(coin: string){
        return this.getData(coin, this.Five_Min)
            .then((rs) => {

                let data = _.filter(rs.result, (data) => {
                   return  new Date(data.T) < new Date("2017-11-03T18:00:00");
                });
                data = _.takeRight(data, 144);
                let abs = _.meanBy(this.coinService.dva(_.cloneDeep(data)), "V");
                let test = this.coinService.checkSideway(data, abs);
                console.log(test);
            })
    }



    getData(coinName: string, tick: string): any {
        let url = "https://bittrex.com/Api/v2.0/pub/market/GetTicks?marketName=COIN&tickInterval=TICK"
            .replace("COIN", coinName).replace("TICK", tick);
        return this.request(url);
    }


    getListData(): any {
        let defer: any = Q.defer();
        let url = "https://bittrex.com/api/v1.1/public/getmarketsummaries";
        request({
            method: "GET",
            uri: url
        }, (error: any, response: any, body: any) => {
            if (!error && response.statusCode === 200) {
                let res = (body && _.isString(body)) ? JSON.parse(body) : body;
                defer.resolve(res);
            } else {
                console.error("Unable to send message.");
                console.error(response);
                console.error(error);
                defer.resolve(null);
            }
        });

        return defer.promise;
    }

    updateCoin() {
        return this.getListData()
            .then((rs) => {
                return this.coinListRepository.create(rs.result);
            })
    }

    request(url, method: string = "GET") {
        let defer: any = Q.defer();
        request({
            method: method,
            uri: url
        }, (error: any, response: any, body: any) => {
            if (!error && response.statusCode === 200) {
                let res = (body && _.isString(body)) ? JSON.parse(body) : body;
                defer.resolve(res);
            } else {
                console.error("Unable to send message.");
                console.error(response);
                console.error(error);
                defer.resolve(null);
            }
        });

        return defer.promise;
    }

    private executeInSequence(functions: any[]): any {
        return functions.reduce((p, func) => {
            return p.then(() => {
                return Q.fcall(func);
            });
        }, Q(null));
    }
}
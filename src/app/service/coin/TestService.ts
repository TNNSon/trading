import {inject, injectable} from "inversify";
import CoinRepository = require("../../repository/CoinRepository");
import SumRepository = require("../../repository/SumRepository");
import CoinListRepository = require("../../repository/CoinListRepository");
import {CoinService} from "./CoinService";
import HistoryRepository = require("../../repository/HistoryRepository");
import OrderHistoryRepository = require("../../repository/OrderHistoryRepository");

let mongodb = require('mongodb');
let MongoClient = mongodb.MongoClient;
var request = require("request");
var Q = require("q");
var _ = require("lodash");
let Promise = require('bluebird');

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
    db;

    constructor(@inject("CoinRepository") private coinRepository: CoinRepository,
                @inject("CoinService") private coinService: CoinService,
                @inject("HistoryRepository") private historyRepository: HistoryRepository,
                @inject("OrderHistoryRepository") private orderHistoryRepository: OrderHistoryRepository,
                @inject("CoinListRepository") private coinListRepository: CoinListRepository) {

    }

    testBuy(id: string) {
        let priceBuy;
        console.log("test coin ", id);
        return this.coinRepository.find({_id: id})
            .then((rs) => {

                priceBuy = rs;
                let history;
                if (new Date(rs.historyBuy[0].TimeStamp).getTime() > new Date(rs.historyBuy[rs.historyBuy.length - 1].TimeStamp).getTime()) {
                    history = _.cloneDeep(rs.historyBuy)
                } else {
                    history = _.reverse(_.cloneDeep(rs.historyBuy))
                }
                // let thirTyMins = _.slice(_.takeRight(rs.dataBuy, 144),0,143);
                // let temp = thirTyMins[thirTyMins.length - 1];
                // let historyData = _.filter(rs.historyBuy, (o) => {
                //     return new Date(temp.T).getTime() < new Date(o.TimeStamp).getTime()
                // });
                // let data = this.coinService.caculateNewData(_.slice(rs.dataBuy, 0, rs.dataBuy.length - 1), history,"")
                // let time = new Date(temp.getFullYear(), temp.getMonth(), temp.getDate(), temp.getHours(), temp.getMinutes() + 5, 0).getTime();
                // history = _.filter(history, (o) => {
                //     return time < new Date(o.TimeStamp).getTime()
                // });
                let thirTyMins = rs.dataBuy;

                let temp = new Date(thirTyMins[thirTyMins.length - 3].T);
                let time = new Date(temp.getFullYear(), temp.getMonth(), temp.getDate(), temp.getHours(), temp.getMinutes(), 0).getTime();
                let historyData = _.filter(history, (o) => {
                    return time < new Date(o.TimeStamp).getTime()
                });

                let data = this.coinService.caculateNewData(_.slice(rs.dataBuy, 0, thirTyMins.length - 3), historyData);
                // let data = this.coinService.caculateNewData(_.slice(rs.dataBuy, 0, rs.dataBuy.length - 3),history)
                // let a = this.coinService.processPrice(thirTyMins, priceBuy.price, historyData);
                let a = this.coinService.processPrice(data, priceBuy.price, priceBuy.timestamp);
                // let a = this.coinService.buyCoin(data, priceBuy.price, rs.timestamp);
                return this.coinRepository.update({_id: priceBuy._id}, {hasBuy: a})
            }).then(() => {
                console.log("test coin done");
                return;
            })
    }

    testBuyOldData(id: string) {
        let priceBuy;
        console.log("test coin ");
        return this.coinRepository.find({_id: id})
            .then((rs) => {
                priceBuy = rs;
                let history;
                if (new Date(rs.historyBuy[0].TimeStamp).getTime() > new Date(rs.historyBuy[rs.historyBuy.length - 1].TimeStamp).getTime()) {
                    history = _.cloneDeep(rs.historyBuy)
                } else {
                    history = _.reverse(_.cloneDeep(rs.historyBuy))
                }
                let thirTyMins = _.slice(_.takeRight(rs.dataBuy, 144), 0, 143);
                let temp = thirTyMins[thirTyMins.length - 1];
                let historyData = _.filter(rs.historyBuy, (o) => {
                    return new Date(temp.T).getTime() < new Date(o.TimeStamp).getTime()
                });
                // let data = this.coinService.caculateNewData(thirTyMins, historyData,"")
                // let time = new Date(temp.getFullYear(), temp.getMonth(), temp.getDate(), temp.getHours(), temp.getMinutes() + 5, 0).getTime();
                // history = _.filter(history, (o) => {
                //     return time < new Date(o.TimeStamp).getTime()
                // });
                // let data = this.coinService.caculateNewData(_.slice(rs.dataBuy, 0, rs.dataBuy.length - 1),history)
                // let a = this.coinService.processPrice(data, priceBuy.price, rs.historyBuy[0].TimeStamp);
                let a = this.coinService.processPrice(thirTyMins, priceBuy.price, rs.historyBuy);
                // let a = this.coinService.buyCoin(data, priceBuy.price, rs.timestamp);
                return this.coinRepository.update({_id: priceBuy._id}, {hasBuy: a})
            }).then(() => {
                console.log("test coin done");
                return;
            })
    }

    testSell(id: string) {
        console.log("test coin ");
        let priceBuy, data;
        return this.coinRepository.find({_id: id})
            .then((rs) => {
                if (rs.priceSell === 0) {
                    return null;
                }
                priceBuy = rs;
                console.log("start coin ", rs.name);
                let thirTyMins = rs.dataSell;

                let temp = new Date(thirTyMins[thirTyMins.length - 3].T);
                let time = new Date(temp.getFullYear(), temp.getMonth(), temp.getDate(), temp.getHours(), temp.getMinutes(), 0).getTime();
                let historyData = _.filter(rs.historySell, (o) => {
                    return time < new Date(o.TimeStamp).getTime()
                });

                let data = this.coinService.caculateNewData(_.slice(rs.dataSell, 0, thirTyMins.length - 3), historyData);
                let a = this.coinService.handling(data, priceBuy.priceSell, priceBuy, rs.historySell[0].TimeStamp);
                return this.coinRepository.update({_id: id}, {hasSell: a})
            }).then((rs) => {
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
                return this.coinService.caculateNewData(rs.dataBuy, rs.historyBuy)
            }).then((data) => {
                let a = this.coinService.processPrice(data, priceBuy.price, priceBuy.historyBuy[0].TimeStamp);
                console.log("update coin ", priceBuy.name, a)
                return this.coinRepository.update({_id: priceBuy._id}, {hasBuy: a})
            }).then(() => {
                return;
            })
    }

    testLoop() {
        return this.coinRepository.retrieve([{
            $match: {
                name: /BTC-/i,
                per: { $lt: 0}
                // name: "BTC-BLK"
            }
        }])
            .then(rs => {
                let arr = [];
                rs.forEach((data) => {
                    // arr.push(this.testBuyOldData.bind(this, data._id));
                    arr.push(this.testBuy.bind(this, data._id));
                    // arr.push(this.testSell.bind(this, data._id));
                })
                return this.executeInSequence(arr).then(() => {
                    console.log("done");
                    return true;
                });
            }).catch((err) => {
                console.log(err);
            })
    }

    testSideWay(coin: string) {
        return this.getData(coin, this.Five_Min)
            .then((rs) => {

                let data = _.filter(rs.result, (data) => {
                    return new Date(data.T) < new Date("2017-11-03T18:00:00");
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

    find(collec) {
        return MongoClient.connect('mongodb://localhost/bittrex', {promiseLibrary: Promise})
            .then(function (db) {
                return db.collection(collec).find({}).toArray()
            });
    }

    runEach() {
        return this.coinListRepository.retrieve([{
            $match: {
                MarketName: /BTC-/i
                // MarketName: "BTC-2GIVE"
            }
        },
            {
                $match: {
                    $or: [{High: {$gte: 0.000002}}, {BaseVolume: {$gt: 10.5}}]
                }
            }])
            .then((rs) => {
                let arr = [];
                rs.forEach((d) => {
                    arr.push(this.testCoin.bind(this, d.MarketName));
                });
                return this.executeInSequence(arr);
            });
    }

    testCoin(coinName: string = "BTC-MTL") {
        // this.find("markets_" + coinName, {}).then((rs) => {
        //     console.log(rs);
        // })
        console.log("test coin ", coinName);
        return Q.all([this.find("markets_" + coinName), this.orderHistoryRepository.find({MarketName: coinName})])
            .spread((data, history) => {
                let length = data.length;
                let arr = [],
                    time,
                    Ttime,
                    bid = null,
                    ask = null,
                    j = 0;
                let promises = [];
                let historyGet;
                data = _.sortBy(data, (o) => {
                    return new Date(o.TimeStamp)
                });
                for (let i = 200; i < length - 20; i++) {
                    bid = null;
                    ask = null;
                    arr.push(data[i]);
                    time = new Date(arr[arr.length - 1].TimeStamp);
                    Ttime = new Date(arr[0].TimeStamp);
                    if (_.clone(Ttime).setMinutes(Ttime.getMinutes() + 20) < new Date(data[i].TimeStamp).getTime()) {
                        arr = _.tail(arr);
                    }
                    j = i;
                    while (bid === null || ask === null) {
                        if (data[j].OrderType == "SELL") {
                            bid = data[j].Rate
                        }
                        if (data[j].OrderType == "BUY") {
                            ask = data[j].Rate
                        }
                        j++;
                    }

                    historyGet = _.filter(history.Result, (d) => {
                        return new Date(d.T) < time && new Date(d.T) > new Date("2017-11-12T12:30:24.01")
                    })
                    let clone = historyGet.length < 144 ? historyGet : _.cloneDeep(_.slice(historyGet, historyGet.length - 144))
                    promises.push(this.aggregateCoin.bind(this, time, coinName, _.reverse(_.cloneDeep(arr)), clone, {
                        result: {
                            Bid: bid,
                            Ask: ask
                        }
                    }))
                }

                return this.executeInSequence(promises);
            })
            .then(() => {
                console.log("test done", coinName)
                return true;
            })
    }


    aggregateCoin(time, coin, historyResult, fiveMins, tickerRs) {
        let thirTyMins,
            historyData,
            temp,
            ticker;
        let insertData;
        // console.log("start coin ", coin);
        // return this.orderHistoryRepository.find({MarketName: coin, "Result": {$elemMatch: {T: {$lte: time}}}})
        //     .then((rsT) => {
        return Q.fcall(() => {
            thirTyMins = fiveMins,
                ticker = tickerRs;


            temp = new Date(thirTyMins[thirTyMins.length - 2].T);
            let time = new Date(temp.getFullYear(), temp.getMonth(), temp.getDate(), temp.getHours(), temp.getMinutes() + 5, 0).getTime();
            historyData = _.filter(historyResult, (o) => {
                return time < new Date(o.TimeStamp).getTime()
            });

            insertData = this.coinService.caculateNewData(_.slice(thirTyMins, 0, thirTyMins.length - 1), historyData);
            //     return this.orderHistoryRepository.update({_id: "5a0ae88db6c38c1d68219fd5"}, {Result: insertData});
            // })
            // .then(() => {
            try {
                return this.coinService.caculateBuyOrSell(insertData, historyData[historyData.length - 1].TimeStamp, ticker.result, coin, new Date(time), historyData);
            } catch (e) {
                console.log(e);
                return;
            }
        }, (err) => {
            return true;
        })
    }

    orderHistoryCoin(coin: string, time: string) {
        return this.orderHistoryRepository.retrieve(
            {
                $match: {
                    MarketName: coin,
                    Result: {
                        $lte: time
                    }
                }
            })
    }

    getHistory(lte: string, gt: string) {
        return this.historyRepository.retrieve({
            $match: {
                TimeStamp: {
                    $gt: gt,
                    $lte: new Date(lte).toISOString()
                }
            }
        })
    }

    private executeInSequence(functions: any[]): any {
        return functions.reduce((p, func) => {
            return p.then(() => {
                return Q.fcall(func);
            });
        }, Q(null));
    }
}
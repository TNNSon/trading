import {inject, injectable} from "inversify";
import CoinRepository = require("../../repository/CoinRepository");
import SumRepository = require("../../repository/SumRepository");
import CoinListRepository = require("../../repository/CoinListRepository");
import OrderHistoryRepository = require("../../repository/OrderHistoryRepository");
import {log} from "util";

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
export class CoinService {
    private Thirty_Min = "ThirtyMin";
    private Five_Min = "FiveMin";
    private O_Min = "OneMin";
    private coin = "BTC-BCC";
    highPrice = 0.0014;
    lowPrice = 0.0014;

    constructor(@inject("CoinRepository") private coinRepository: CoinRepository,
                @inject("SumRepository") private sumRepository: SumRepository,
                @inject("CoinListRepository") private coinListRepository: CoinListRepository,
                @inject("OrderHistoryRepository") private orderHistoryRepository: OrderHistoryRepository) {

    }

    loop() {
        console.log(" test start ", new Date().toISOString());
        try {
            return this.coinListRepository.retrieve([{
                $match: {
                    // MarketName: /BTC-/i
                    MarketName: "BTC-2GIVE"
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
                        arr.push(this.aggregateCoin.bind(this, d.MarketName));
                    });
                    return this.executeInSequence(arr)
                        .then(() => {
                            console.log(" test done ", new Date().toISOString());
                            return true;
                        });
                })
        }
        catch (err) {
            console.log(err);
            return;
        }

    }

    aggregateCoin(coin) {
        let thirTyMins,
            historyData,
            temp,
            ticker;
        console.log("start coin ", coin);
        return Q.all([this.orderHistoryRepository.find({MarketName: coin}), this.getHistory(coin), this.getPrice(coin)])
            .spread((rsT, history, tickerRs: any) => {
                thirTyMins = rsT.Result,
                    ticker = tickerRs;

                if (rsT && rsT.Result && history && history.result && ticker && ticker.result) {

                    temp = new Date(thirTyMins[thirTyMins.length - 2].T);
                    let time = new Date(temp.getFullYear(), temp.getMonth(), temp.getDate(), temp.getHours(), temp.getMinutes() + 5, 0).getTime();
                    historyData = _.filter(history.result, (o) => {
                        return time < new Date(o.TimeStamp).getTime()
                    });

                } else {
                    throw Error("cant get data " + coin);
                }
                return this.caculateNewData(rsT._id, _.slice(rsT.Result, 0 , thirTyMins.length - 1), historyData)
            })
            .then((oldData) => {
                try {
                    return this.caculateBuyOrSell(oldData, historyData[0].TimeStamp, ticker.result, coin, new Date());
                } catch (e) {
                    console.log(e);
                    return;
                }
            }, (err) => {
                return true;
            })

    }


    caculateBuyOrSell(rsT: Array<IChart>,lastTimeBuy: string, priceBuy: ITiker, name, time) {
        return this.coinRepository.find({name: name, priceSell: 0})
            .then((coin) => {
                if (coin) {
                    let priceTop = this.handling(rsT, priceBuy.Bid, coin);
                    if (priceTop) {
                        return this.sumRepository.find({name: name})
                            .then((sum) => {
                                let promise = [];
                                console.log("sell " + name + "  " + priceBuy.Bid);
                                if (!sum || !sum.value || sum.value === 0) {
                                    promise.push(this.sumRepository.create(
                                        {
                                            name: name,
                                            value: 1 + 1 * ((_.round((priceBuy.Bid / coin.price * 100 - 100), 2) / 100))
                                        }))
                                } else {
                                    promise.push(this.sumRepository.update({name: name},
                                        {
                                            value: sum.value + sum.value * ((_.round((priceBuy.Bid / coin.price * 100 - 100), 2) / 100))
                                        }))
                                }
                                promise.push(this.coinRepository.update({name: name, _id: coin._id},
                                    {
                                        priceSell: priceBuy.Bid,
                                        timestampSell: time.toISOString(),
                                        per: _.round((priceBuy.Bid / coin.price * 100 - 100), 2) - 0.5,
                                        priceTop: priceTop,
                                        dataSell: rsT
                                    }));
                                return Q.all(promise);
                            })
                    }

                    return false;
                } else {
                    if (this.processPrice(rsT, priceBuy.Ask, lastTimeBuy)) {
                        console.log("buy ", coin);
                        return this.coinRepository.create({
                            name: name,
                            timestamp: time.toISOString(),
                            price: priceBuy.Ask,
                            dataBuy: rsT
                        })
                    }

                    return false;
                }
            });
    }

    handling(data: Array<IChart>, price: number, dataBuy) {
        let dataNearest = data[data.length - 1];
        let time = ((new Date(dataNearest.T).getTime() - new Date(data[data.length - 2].T).getTime()) / 1000) / 60;
        let sum = dataNearest.V / (time > 0 ? time : 1) * 5;

        let maxPrice = _.maxBy(_.filter(data, (o) => {
            return new Date(dataBuy.timestamp).getTime() < new Date(o.T).getTime()
        }), (d) => {
            return d.H;
        });

        if (!maxPrice) {
            return false;
        }
        let abs = _.meanBy(this.dva(_.cloneDeep(data)), "V");

        // if (this.checkSideway(data, abs) && price > dataBuy.price) {
        if (this.checkSideway(data) && price > dataBuy.price) {
            return true;
        }

        // if (this.checkSideway(data, abs) && price <= dataBuy.price) {
        if (this.checkSideway(data) && price <= dataBuy.price) {
            return false;
        }

        if (abs / (sum) > 5) {
            return maxPrice.H;
        }
        if (maxPrice.H / price * 100 - 100 >= 3 /*&& new Date(data.TimeStamp).getTime() - new Date(dataBuy.timestamp).getTime() > 300000 */) {
            return maxPrice.H;
        }

        if (price / dataBuy.price * 100 - 100 >= 3) {
            return maxPrice.H;
        }

        return false;
    }

    updateHighPrice(data: Array<IChart>, returnIndexMin: number = 0) {
        let indexMax = 0,
            max: any = data[0],
            indexMin = 0,
            min: any = data[0],
            length = data.length;

        for (let i = 0; i < length; i++) {
            if (max.H < data[i].H) {
                max = data[i];
                indexMax = i;
            }

            if (min.L > data[i].L) {
                min = data[i];
                indexMin = i;
            }
        }
        returnIndexMin += indexMin;
        min["index"] = returnIndexMin;

        if (new Date(min.T).getTime() > new Date(max.T).getTime()) {
            if (max.H / min.L * 100 - 100 > 7 && indexMin !== 0) {
                return this.updateHighPrice(_.slice(data, indexMin), returnIndexMin);
            } else {
                return min;
            }
        } else {
            if (indexMax == data.length || indexMax == 0) {
                return min;
            } else {
                return this.updateHighPrice(_.slice(data, indexMax), returnIndexMin);
            }
        }
    }
    processPrice(data: Array<IChart>, priceBuy: number, lastTimeBuy: string) {
        let lastData = data[data.length -1];
        data = _.sortBy(data, "T")
        if (_.isObject(data[data.length - 1].H)) {
            data = _.slice(data, 0, data.length - 1)
        }
        let abs = _.meanBy(this.dva(_.cloneDeep(data)), "V");
        let absD = _.meanBy(_.cloneDeep(data), "V");

        var low = Math.round(145 * 0.025);
        var high = 145 - low;
        var data2 = data.slice(low, high);
        let absPrice = _.meanBy(_.cloneDeep(data2), (data) => { return (data.H + data.L)/2;});
        let time = ((new Date(lastTimeBuy).getTime() - new Date(lastData.T).getTime()) / 1000) / 60;
        let sumExpect =  lastData.V / _.round(time % 5) * 5;
        // let minPrice1 = this.updateHighPrice(data);
        // let minPrice = this.getMin(data);
        let minLast = this.zigzag(data);
        // bo qua truong hop dang ngay day'
        // if (minPrice["index"] === data.length - 1  && sum / ( abs * 1.75) < 3.5 && absD / abs > 1.4 /*|| max < ((lastChart.L + lastChart.O + lastChart.H + lastChart.C) / 4)*/) {
        //     return false;
        // }
        //
        // if(minPrice["index"] === data.length - 1  && sum / ( abs * 1.75) < 2 && absD / abs < 1.4 ) {
        //     return false;
        // }

        // if (priceBuy / minPrice.L * 100 - 100 > 3 && priceBuy / minPrice.L * 100 - 100 < 3.5 && sum > abs * 1.75 && this.checkSideway(data)) {
        //     return true;
        // } else if (priceBuy / minPrice.L * 100 - 100 > 2.5 && priceBuy / minPrice.L * 100 - 100 < 3.5 && sum > abs * 5 && this.checkSideway(data)) {
        //     return true;
        // }

        // if (minPrice.index !== minPrice1.index) {
        //     console.log("test");
        // }
        if(priceBuy < absPrice) {
            return false;
        }
        if (absD / abs > 1.7) {
            if(priceBuy < absPrice*1.25) {
                return false;
            }
            if (priceBuy / minLast.price * 100 - 100 > 2 && priceBuy / minLast.price * 100 - 100 < 10 && sumExpect > abs * 5 && this.checkSideway(data)) {
                return true;
            }
            return false;
        } else if (absD / abs > 1.4) {
            if (priceBuy / minLast.price * 100 - 100 > 2.5 && priceBuy / minLast.price * 100 - 100 < 3.5 && sumExpect > abs * 2.9 && this.checkSideway(data)) {
                return true;
            }
            return false;

        } else {
            if (priceBuy / minLast.price * 100 - 100 > 3 && priceBuy / minLast.price * 100 - 100 < 3.5 && sumExpect > abs * 1.75 && this.checkSideway(data)) {
                return true;
            }
            return false;
        }
    }
    processPrice1(data: Array<IChart>, priceBuy: number) {
        data = _.sortBy(data, "T");
        if (_.isObject(data[data.length - 1].H)) {
            data = _.slice(data, 0, data.length - 1)
        }
        let abs = _.meanBy(this.dva(_.cloneDeep(data)), "V");
        let sum = 0;

        let minPrice = this.zigzag(data);
        // bo qua truong hop dang ngay day'
        if (minPrice["index"] === data.length - 1 /*|| max < ((lastChart.L + lastChart.H) / 2*/) {
            return false;
        }
        if (priceBuy / minPrice.L * 100 - 100 > 3 && priceBuy / minPrice.L * 100 - 100 < 3.5 && sum > abs * 2 && !this.checkSideway(data, abs)) {
            return true;
        } else if (priceBuy / minPrice.L * 100 - 100 > 2.5 && priceBuy / minPrice.L * 100 - 100 < 3.5 && sum > abs * 5 && !this.checkSideway(data, abs)) {
            return true;
        }

        return false;
    }

    zigzag(data: Array<IChart>) {
        let length = data.length,
            swg = {
                items: [],
                value: {
                    type: "",
                    price: 0,
                    t: ""
                }
            }, curr_price,
            type = "low";
        swg.value = {type: 'low', price: data[0].H, t: data[0].T};
        swg.items.push(swg.value);
        for (let i = 1; i < length; i++) {
            curr_price = data[i];
            if (type == 'high') {
                if (curr_price.L <= swg.value.price * 0.93) {
                    type = "low";
                    swg.value = {type: 'low', price: curr_price.L, t: curr_price.T};
                    swg.items.push(_.cloneDeep(swg.value));
                } else if (curr_price.H > swg.value.price) {
                    swg.value.price = curr_price.H;
                    swg.value.t = curr_price.T;
                    swg.items[swg.items.length - 1] = swg.value;
                }
            } else {
                if (curr_price.H >= swg.value.price * 1.07) {
                    type = "high";
                    swg.value = {type: 'high', price: curr_price.H, t: curr_price.T};
                    swg.items.push(_.cloneDeep(swg.value));
                } else if (curr_price.L < swg.value.price) {
                    swg.value.price = curr_price.L;
                    swg.value.t = curr_price.T;
                    swg.items[swg.items.length - 1] = swg.value;
                }
            }
        }
        return _.findLast(swg.items, function (d) {
            return d.type === "low"
        });
    }

    checkSideway(data: Array<IChart>) {
        let max = 0,
            min;
        for (let i = 96; i < data.length; i++) {

            if (data[i].H > max) {
                max = data[i].H;
            }
            if (!min) {
                min = data[i].L;
            }
            if (data[i].L < min) {
                min = data[i].L;
            }
        }
        if (max / min < 6) {
            return true;
        } else {
            return false;
        }
    }

    checkSideway1(data: Array<IChart>, abs) {
        let max = 0,
            min,
            sum = 0,
            count = 0,
            indexMin = data.length - 5;
        for (let i = indexMin; i < data.length; i++) {
            if (data[i].H / data[i].L < 2) {
                count++;
            }
            if (data[i].H > max) {
                max = data[i].H;
            }
            if (!min) {
                min = 1000000000000000;
            }
            if (data[i].L < min) {
                indexMin = i;
                min = data[i].L;
            }
        }
        if (indexMin !== data.length - 1) {
            for (let i = indexMin; i < data.length; i++) {
                sum += data[i].V;
            }
        } else {
            sum = 0;
        }

        // add abs de tranh truong hop nen giam lai mua nhieu
        // if (count >= 3) {
        //     return true;
        // }
        if (max / min < 3 && sum / (abs * 3) <= 0) {
            return true;
        } else {
            false
        }
    }

    dva(data) {
        data.sort(function (a, b) {
            return a.V - b.V
        })
        var l = data.length;
        var low = Math.round(l * 0.025);
        var high = l - low;
        var data2 = data.slice(low, high);
        var sum = 0;     // stores sum of elements
        var sumsq = 0; // stores sum of squares
        for (var i = 0; i < data2.length; ++i) {
            sum += data2[i].V;
            sumsq += data2[i].V * data2[i].V;
        }
        var mean = sum / l;
        var varience = sumsq / l - mean * mean;
        var sd = Math.sqrt(varience);
        var data3 = new Array(); // uses for data which is 3 standard deviations from the mean
        for (var i = 0; i < data2.length; ++i) {
            if (data2[i].V > mean - 3 * sd && data2[i].V < mean + 3 * sd)
                data3.push(data2[i]);
        }
        return data3;
    }

    standardDeviation(values) {
        var avg = this.average(values);

        var squareDiffs = values.map(function (value) {
            var diff = value.V - avg;
            var sqrDiff = diff * diff;
            return {V: sqrDiff};
        });

        var avgSquareDiff = this.average(squareDiffs);

        var stdDev = Math.sqrt(avgSquareDiff);
        return stdDev;
    }

    average(data) {
        var sum = data.reduce(function (sum, value) {
            return sum + value.V;
        }, 0);

        var avg = sum / data.length;
        return avg;
    }


    getChartHistory(coinName: string, tick: string): any {
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
                console.error(error);
                defer.reject(null);
            }
        });

        return defer.promise;
    }

    caculateNewData(id: string, oldData: Array<any>, newData: Array<IHistoryBuySell>) {
        let insertData;
        return Q.fcall(() => {
            newData = _.reverse(newData);
            let lastTime = new Date(oldData[oldData.length - 1].T);
            let temp1 = {H: 0, L: 100000000000000000000000000, V: 0, T: ""};
            let currTime = new Date(lastTime.getFullYear(), lastTime.getMonth(), lastTime.getDate(), lastTime.getHours(), lastTime.getMinutes() + 10, 0);
            let length = newData.length;
            let timeNow, count = 1, exclude = 0, per = 0;
            for (let i = 0; i < length; i++) {
                timeNow = ((new Date(newData[i].TimeStamp).getTime() - new Date(currTime.setMilliseconds(1)).getTime()) / 1000) / 60;
                per = timeNow / 5;

                if (new Date(newData[i].TimeStamp).getTime() - currTime.getTime() >= 0) {
                    count++;
                    temp1.T = new Date(_.clone(currTime).setMinutes(currTime.getMinutes() - 5)).toISOString();
                    if(temp1.H !== 0){
                        exclude++;
                        oldData.push(_.cloneDeep(temp1));
                    }
                    currTime = new Date(currTime.getFullYear(), currTime.getMonth(), currTime.getDate(), currTime.getHours(), currTime.getMinutes() + 5, 0);
                    while(new Date(newData[i].TimeStamp).getTime() - currTime.getTime() > 0){
                        currTime = new Date(currTime.getFullYear(), currTime.getMonth(), currTime.getDate(), currTime.getHours(), currTime.getMinutes() + 5, 0);
                    }
                    temp1 = {H: 0, L: 100000000000000000000000000, V: 0, T: ""};
                }

                    if (newData[i].Price > temp1.H) {
                        temp1.H = newData[i].Price;
                    }

                    if (newData[i].Price < temp1.L) {
                        temp1.L = newData[i].Price;
                    }

                    temp1.V += newData[i].Quantity;
            }

            insertData = _.slice(_.cloneDeep(oldData),count - 1 - (exclude ? (exclude - 1) : 0) );
            return this.orderHistoryRepository.update({_id : id.toString()}, {Result: insertData});
        }).then(() => {
            return insertData;
        })
    }


    getPrice(coin) {
        let url = "https://bittrex.com/api/v1.1/public/getticker?market=coin".replace("coin", coin);
        return this.request(url);
    }

    getHistory(coin: string) {
        let url = "https://bittrex.com/api/v1.1/public/getmarkethistory?market=".concat(coin);
        return this.request(url);
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
                console.error(error);
                defer.reject(null);
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

    prepareData() {
        console.log(" prepare data start  ", new Date().toISOString());
        return this.orderHistoryRepository.drop()
            .then(() => {
                return this.coinListRepository.retrieve([{
                    $match: {
                        // MarketName: "BTC-1ST"
                        MarketName: /BTC-/i
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
                            arr.push(this.prepareCoin.bind(this, d.MarketName));
                        });
                        return this.executeInSequence(arr)
                    })
                    .then(() => {
                        console.log(" prepare data done ", new Date().toISOString());
                        return true;
                    });
            })
    }

    prepareCoin(coin: string) {
        try {
            console.log("get coin", coin);
            return this.getChartHistory(coin, this.Five_Min)
                .then((rs) => {
                    return this.orderHistoryRepository.create({MarketName: coin, Result: _.takeRight(rs.result, 144)});
                })
        } catch (e) {
            console.log("can''t get data coin", coin);
            return true;
        }

    }
}
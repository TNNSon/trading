import {inject, injectable} from "inversify";
import CoinRepository = require("../../repository/CoinRepository");
import SumRepository = require("../../repository/SumRepository");
import CoinListRepository = require("../../repository/CoinListRepository");

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
                @inject("CoinListRepository") private coinListRepository: CoinListRepository) {

    }

    loop() {
        console.log(" test start ", new Date().toISOString());
        try {
            return this.coinListRepository.retrieve({BaseCurrency: "BTC", IsActive: true})
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
        }

    }

    test() {
        return this.coinRepository.find({name: "BTC-XVC"})
            .then((rs) => {
                let a = this.processPrice(rs.dataBuy, rs.price, rs.historyBuy)
                console.log(a);
            })
    }

    aggregateCoin(coin) {
        return Q.all([this.getData(coin, this.Five_Min), this.getHistory(coin), this.getPrice(coin)])
            .spread((rsT, history, ticker: any) => {
                if (rsT && rsT.result && history && history.result && ticker && ticker.result) {
                    let thirTyMins,
                        historyData,
                        temp;
                    thirTyMins = _.takeRight(rsT.result, 144);
                    temp = thirTyMins[thirTyMins.length - 1];
                    historyData = _.filter(history.result, (o) => {
                        return new Date(temp.T).getTime() < new Date(o.TimeStamp).getTime()
                    });

                    return this.runHistory(thirTyMins, ticker.result, historyData, coin, new Date());
                }

                return false;
            });
    }

    runHistory(rsT: Array<IChart>, priceBuy: ITiker, historyNearest: Array<IHistoryBuySell>, name, time) {
        return this.coinRepository.find({name: name, priceSell: 0})
            .then((coin) => {
                if (coin) {
                    let priceTop = this.handling(rsT, priceBuy.Bid, coin);
                    if (priceTop) {
                        return this.sumRepository.find({name: name})
                            .then((sum) => {
                                let promise = [];
                                console.log("sell " + name + "  "  +  priceBuy.Bid );
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
                                        per: _.round((priceBuy.Bid / coin.price * 100 - 100), 2),
                                        priceTop: priceTop,
                                        dataSell: rsT,
                                        historySell: historyNearest
                                    }));
                                return Q.all(promise);
                            })
                    }

                    return false;
                } else {
                    if (this.processPrice(rsT, priceBuy.Ask, historyNearest)) {
                        console.log("buy ", coin);
                        return this.coinRepository.create({
                            name: name,
                            timestamp: time.toISOString(),
                            price: priceBuy.Ask,
                            dataBuy: rsT,
                            historyBuy: historyNearest
                        })
                    }

                    return false;
                }
            });
    }

    handling(rsT: Array<IChart>, price: number, dataBuy) {
        "start Hangling"
        let max = _.maxBy(_.filter(rsT, (o) => {
            return new Date(dataBuy.timestamp).getTime() < new Date(o.T).getTime()
        }), (d) => {
            return d.H;
        });

        if (!max) {
            return false;
        }

        if (this.checkSideway(rsT) && price > dataBuy.price) {
            return true;
        }

        if (this.checkSideway(rsT) && price <= dataBuy.price) {
            return false;
        }

        if (max.H / price * 100 - 100 >= 3 /*&& new Date(data.TimeStamp).getTime() - new Date(dataBuy.timestamp).getTime() > 300000 */) {
            return max.H;
        }

        // if (data.Price / min.L * 100 - 100 >= 3 ) {
        //     return max.H;
        // }

        return false;
    }

    updateHighPrice(data: Array<IChart>, returnIndexMin: number = 0) {
        let indexMax = 0,
            max: any = data[0],
            indexMin = 0,
            min: any = data[0],
            length = data.length;
        min["index"] = indexMin;

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

    processPrice(data: Array<IChart>, priceBuy: number, historyData: Array<IHistoryBuySell>) {

        data = _.sortBy(data, "T")
        if (_.isObject(data[data.length - 1].H)) {
            data = _.slice(data, 0, data.length - 1)
        }
        let max = 0, min = historyData.length > 0 ? historyData[0].Price : 0, sumSell = 0, sumBuy = 0;
        let abs = _.meanBy(this.dva(_.cloneDeep(data)), "V");
        let sum = 0, time;

        let lastChart;

        if (historyData.length === 0) {
            sum = data[data.length - 1].V;
            lastChart = data[data.length - 1];
        } else {

            time = ((new Date(historyData[0].TimeStamp).getTime() - new Date(data[data.length - 1].T).getTime()) / 1000) / 60;

            if (time <= 5) {
                historyData.forEach((h) => {
                    sum += h.Quantity;
                    if (max < h.Price) {
                        max = h.Price;
                    }

                    if (min > h.Price) {
                        min = h.Price;
                    }

                    if (h.OrderType === "SELL") {
                        sumSell += h.Quantity;
                    } else {
                        sumBuy += h.Quantity;
                    }
                });
                sum = sum / time * 5
            }
            else {
                let temp: any = {V: 0, H: 0, L: historyData.length > 0 ? historyData[0].Price : 0};
                let temp2: any = {V: 0, H: 0, L: historyData.length > 0 ? historyData[0].Price : 0};
                let max = 0, min = historyData.length > 0 ? historyData[0].Price : 0, sumSell = 0, sumBuy = 0;
                let sum = 0;
                historyData.forEach((h) => {
                    if (new Date(h.TimeStamp).getTime() < new Date(data[data.length - 1].T).getTime() + 300000) {
                        temp.V += h.Quantity;
                        if (temp.H < h.Price) {
                            temp.H = h.Price;
                        }

                        if (temp.L > h.Price) {
                            temp.L = h.Price;
                        }
                    } else if (new Date(h.TimeStamp).getTime() < new Date(data[data.length - 1].T).getTime() + 300000) {
                        temp2.V += h.Quantity;
                        if (temp2.H < h.Price) {
                            temp2.H = h.Price;
                        }

                        if (temp2.L > h.Price) {
                            temp2.L = h.Price;
                        }
                    } else {
                        sum += h.Quantity;
                        if (max < h.Price) {
                            max = h.Price;
                        }

                        if (min > h.Price) {
                            min = h.Price;
                        }

                        if (h.OrderType === "SELL") {
                            sumSell += h.Quantity;
                        } else {
                            sumBuy += h.Quantity;
                        }
                    }

                })
                data.push(temp)
                if (time > 10) {
                    data.push(temp2)
                }
                sum = sum / (time % 5) * 5
            }
            lastChart = data[data.length - 1];
            data.push({L: min, H: max, T: historyData[0].TimeStamp, V: sum, O: null, C: null, BV: null})
        }

        let minPrice = this.updateHighPrice(data);
        // bo qua truong hop dang ngay day'
        if (minPrice["index"] === data.length - 1 || max < ((lastChart.L + lastChart.O + lastChart.H + lastChart.C) / 4)) {
            return false;
        }
        if (priceBuy / minPrice.L * 100 - 100 > 3 && priceBuy / minPrice.L * 100 - 100 < 3.5 && sum > abs * 1.75 && this.checkSideway(data)) {
            return true;
        } else if (priceBuy / minPrice.L * 100 - 100 > 2.5 && priceBuy / minPrice.L * 100 - 100 < 3.5 && sum > abs * 5 && this.checkSideway(data)) {
            return true;
        }

        return false;
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


    getData(coinName: string, tick: string): any {
        let url = "https://bittrex.com/Api/v2.0/pub/market/GetTicks?marketName=COIN&tickInterval=TICK"
            .replace("COIN", coinName).replace("TICK", tick);
        return this.request(url);
    }


    getListData(): any {
        let defer: any = Q.defer();
        let url = "https://bittrex.com/api/v1.1/public/getmarkets";
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
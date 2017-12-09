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
            return this.sumRepository.find({name: "total"})
                .then((rs) => {
                    return this.coinListRepository.retrieve([{
                        $match: {
                            MarketName: /BTC-/i
                            // MarketName: "BTC-AUR"
                        }
                    },
                        {
                            $match: {
                                $or: [{High: {$gte: 0.000002}}, {BaseVolume: {$gt: 10.5}}]
                            }
                        }]);
                })
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
        let insertData, timeNow;
        // console.log("start coin ", coin);
        return Q.all([this.orderHistoryRepository.find({MarketName: coin}), this.getHistory(coin), this.getPrice(coin)])
            .spread((rsT, history, tickerRs: any) => {
                thirTyMins = rsT.Result,
                    ticker = tickerRs;
                timeNow = new Date().toISOString();
                let split = thirTyMins.length - 2;

                if (rsT && rsT.Result && history && history.result && ticker && ticker.result) {
                    let lastedHistory = history.result[history.result.length - 1].TimeStamp;
                    if (new Date(lastedHistory).getTime() - new Date(thirTyMins[thirTyMins.length - 2].T).getTime() <= 300000) {
                        temp = new Date(thirTyMins[thirTyMins.length - 2].T)
                    } else {
                        temp = new Date(thirTyMins[thirTyMins.length - 1].T)
                        split = thirTyMins.length - 1
                    }
                    let time = new Date(temp.getFullYear(), temp.getMonth(), temp.getDate(), temp.getHours(), temp.getMinutes(), 0).getTime();
                    historyData = _.filter(history.result, (o) => {
                        return time < new Date(o.TimeStamp).getTime()
                    });

                } else {
                    throw Error("cant get data " + coin);
                }
                insertData = this.caculateNewData(_.slice(rsT.Result, 0, split), historyData);
                return this.orderHistoryRepository.update({_id: rsT._id.toString()}, {Result: insertData});
            })
            .then(() => {
                try {
                    return this.caculateBuyOrSell(insertData, historyData[0].TimeStamp, ticker.result, coin, timeNow, historyData);
                } catch (e) {
                    console.log(e);
                    return;
                }
            }, (err) => {
                return true;
            })

    }

    caculateBuyOrSell(rsT: Array<IChart>, lastTimeBuy: string, priceBuy: ITiker, name, time, historyData) {
        let promise = [];
        console.log("coin ", name)
        return this.coinRepository.find({name: name, priceSell: 0})
            .then((coin) => {
                if (coin) {
                    let priceTop = this.handling(rsT, priceBuy.Bid, coin, lastTimeBuy);
                    if (priceTop) {
                        return this.sumRepository.find({name: "total"})
                            .then((sum) => {

                                console.log("sell " + name + "  " + priceBuy.Bid + " ", _.round((priceBuy.Bid / coin.price * 100 - 100), 2) - 0.5);
                                promise.push(this.sumRepository.update({name: "total"},
                                    {
                                        value: _.round(parseFloat(sum.value) + (1 * (((_.round((priceBuy.Bid / coin.price), 2)) - 0.005))), 5)
                                    }));
                                promise.push(this.coinRepository.update({name: name, _id: coin._id},
                                    {
                                        priceSell: priceBuy.Bid,
                                        timestampSell: time,
                                        per: _.round((priceBuy.Bid / coin.price * 100 - 100), 2) - 0.5,
                                        priceTop: priceTop,
                                        dataSell: rsT,
                                        historySell: historyData
                                    }));
                                return Q.all(promise);
                            })
                    }

                    return false;
                } else {
                    // if (this.buyCoin(rsT, priceBuy.Ask, lastTimeBuy)) {
                    if (this.processPrice(rsT, priceBuy.Ask, time)) {
                        return this.sumRepository.find({name: "total"})
                            .then((sum) => {
                                console.log("buy ", coin);
                                promise.push(this.sumRepository.update({name: "total"},
                                    {
                                        value: sum.value - 1
                                    }));
                                promise.push(this.coinRepository.create({
                                    name: name,
                                    timestamp: time,
                                    price: priceBuy.Ask,
                                    dataBuy: rsT,
                                    historyBuy: historyData
                                }));
                                return Q.all(promise);
                            })

                    }

                    return false;
                }
            });
    }

    handling(rsT: Array<IChart>, price: number, dataBuy, timeNow: string) {
        // "start Hangling"
        let data = _.filter(rsT, (o) => {
            return new Date(dataBuy.timestamp).getTime() < new Date(o.T).getTime()
        });
        let max = _.maxBy(data, (d) => {
            return d.H;
        });

        // check sau 50 phut ban   4-5 cay chart

        // if gia cao

        if (!max) {
            return false;
        }
        let lastData = rsT[rsT.length - 1];
        // let time = ((new Date(timeNow).getTime() - new Date(lastData.T).getTime()) / 1000) / 60;
        // if(time > 5){
        //     return false;
        // }
        // let abs = _.meanBy(this.dva(_.cloneDeep(rsT)), "V");
        // let sumExpect = lastData.V / _.round(time % 5, 2) * 5;      // * 1.8 if time < 0.6
        // if(sumExpect > abs * 1.3 && price > dataBuy.price) {
        //     return false;
        // }

        if (new Date(data[data.length - 1].TimeStamp).getTime() - new Date(dataBuy.timestamp).getTime() > 900000 && dataBuy.price * 1.005 >= price) {
            return true;
        }

        if (this.checkSideway(data) && price > dataBuy.price * 1.005) {
            return true;
        }

        if (this.checkSideway(data) && price <= dataBuy.price && dataBuy.price / price < 1.024
            && new Date(data[data.length - 1].TimeStamp).getTime() - new Date(dataBuy.timestamp).getTime() < 900000) {
            return false;
        }

        if (max.H / price * 100 - 100 >= 2.4 && data[data.length - 1].L < price) {
            return true;
        }

        if (price / dataBuy.price * 100 - 100 >= 3) {
            return true;
        }

        if (new Date(data[data.length - 1].TimeStamp).getTime() - new Date(dataBuy.timestamp).getTime() > 2160000) {
            if (max / dataBuy.price >= 1.005 && max / price < 1.005) {
                return false;
            }

            return true;
        }

        return false;
    }

    // handling(rsT: Array<IChart>, price: number, dataBuy) {
    //     let max = _.maxBy(_.filter(rsT, (o) => {
    //         return new Date(dataBuy.timestamp).getTime() < new Date(o.T).getTime()
    //     }), (d) => {
    //         return d.H;
    //     });
    //
    //     if (!max) {
    //         return false;
    //     }
    //
    //     if (this.checkSideway(rsT) && price > dataBuy.price) {
    //         return true;
    //     }
    //
    //     if (this.checkSideway(rsT) && price * 1.01 >= dataBuy.price) {
    //         return false;
    //     }
    //
    //     if (max.H / price * 100 - 100 >= 3 /*&& new Date(data.TimeStamp).getTime() - new Date(dataBuy.timestamp).getTime() > 300000 */) {
    //         return max.H;
    //     }
    //
    //     if (price / dataBuy.price * 100 - 100 >= 3 ) {
    //         return max.H;
    //     }
    //     return false;
    // }
    handling1(data: Array<IChart>, price: number, dataBuy, lastTimeBuy) {
        let dataNearest1 = data[data.length - 1];
        let time = ((new Date(lastTimeBuy).getTime() - new Date(dataNearest1.T).getTime()) / 1000) / 60;
        let sum = dataNearest1.V / (time > 0 ? time : 1) * 5;

        if (dataNearest1.type == "SELL" && dataNearest1.H / dataNearest1.L < 1.015 && time > 2.5) {
            return true;
        }

        let maxPrice = _.maxBy(_.filter(data, (o) => {
            return new Date(dataBuy.timestamp).getTime() < new Date(o.T).getTime()
        }), (d) => {
            return d.H;
        });

        let sideway = _.filter(data, (o) => {
            return new Date(dataBuy.timestamp).getTime() < new Date(o.T).getTime()
        })

        if (new Date(lastTimeBuy).getTime() - new Date(dataBuy.timestamp).getTime() > 1800000) {
            return true;
        }

        if (!maxPrice && price / dataBuy.price * 100 - 100 > -2) {
            return false;
        }

        let abs = _.meanBy(this.dva(_.cloneDeep(data)), "V");

        // if (this.checkSideway(data, abs) && price > dataBuy.price) {
        // let maxSideWay = this.getSideWay(data);
        if (this.checkSideway(sideway) && price > dataBuy.price) {
            return false;
        }

        // if (this.checkSideway(data, abs) && price <= dataBuy.price) {
        if (this.checkSideway(sideway) && price * 1.015 <= dataBuy.price) {
            return true;
        }

        // if (abs / (sum) > 5) {
        //     return true;
        // }
        if (maxPrice && maxPrice.H / price * 100 - 100 >= 3 /*&& new Date(data.TimeStamp).getTime() - new Date(dataBuy.timestamp).getTime() > 300000 */) {
            return true;
        }

        if (price / dataBuy.price * 100 - 100 >= 3) {
            return true;
        }

        if (price / dataBuy.price * 100 - 100 < -3) {
            return true;
        }

        return false;
    }

    updateHighPrice1(data: Array<IChart>, returnIndexMin: number = 0) {
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

    updateHighPrice(data: Array<IChart>) {
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

        if (new Date(min.T).getTime() > new Date(max.T).getTime()) {
            if (max.H / min.L * 100 - 100 > 7 && indexMin !== 0) {
                return this.updateHighPrice(_.slice(data, indexMin));
            } else {
                return min;
            }
        } else {
            if (indexMax == data.length || indexMax == 0) {
                return min;
            } else {
                return this.updateHighPrice(_.slice(data, indexMax));
            }
        }
    }

    processPriceold(data: Array<IChart>, priceBuy: number, historyData) {
        let max = 0, min = historyData[0].Price, time, sumSell = 0, sumBuy = 0;
        let abs = _.meanBy(this.dva(data), "V");
        let sum = 0;
        if (historyData.length === 0) {
            sum = data[data.length - 1].V;
        } else {
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
            })
            time = _.round((new Date(historyData[0].TimeStamp).getTime() - new Date(historyData[historyData.length - 1].TimeStamp).getTime()) / 1000) / 60;

            if (time < 5) {
                sum = sum / time * 5
            }

            data.push({L: min, H: max, T: historyData[0].TimeStamp, V: sum, O: null, C: null, BV: null})
        }

        // let lastData = data[data.length - 1];
        // let time = ((new Date(lastTimeBuy).getTime() - new Date(lastData.T).getTime()) / 1000) / 60;
        // if(time > 5){
        //     return false;
        // }
        // let sumExpect = lastData.V / (_.round(time % 5), 2) * 5;
        data = _.sortBy(data, "T");
        let minPrice = this.updateHighPrice(data);

        if (priceBuy / minPrice.L * 100 - 100 > 3 && priceBuy / minPrice.L * 100 - 100 < 4 && sum > abs * 1.75 && this.checkSideway(data)) {
            return true;
        } else if (priceBuy / minPrice.L * 100 - 100 > 2 && priceBuy / minPrice.L * 100 - 100 < 3.5 && sum > abs * 5 && this.checkSideway(data)) {
            return true;
        }

        return false;
    }

    processPrice(data: Array<IChart>, priceBuy: number, lastTimeBuy: string) {
        // 5a1476b2c11732316c73bde8 test die mvao
        data = _.sortBy(data, "T")
        let nowData = data[data.length - 1];
        let time = ((new Date(lastTimeBuy).getTime() - new Date(nowData.T).getTime()) / 1000) / 60;
        let sumExpect = nowData.V / _.round(time % 5, 2) * 5;      // * 1.8 if time < 0.6
        if (nowData.type === "SELL" || nowData.H / data[data.length - 2].L < 1.01) {
            return false;
        }
        // if (_.isObject(data[data.length - 1].H)) {
        data = _.slice(data, 0, data.length - 1)
        let lastData = data[data.length - 1];

        let abs = _.meanBy(this.dva(_.cloneDeep(data)), "V");
        let absD = _.meanBy(_.cloneDeep(data), "V");

        var low = Math.round(145 * 0.025);
        var high = 145 - low;
        var data2 = data.slice(low, high);
        // let absPrice = _.meanBy(_.cloneDeep(data2), (data) => {
        //     return (data.H + data.L) / 2;
        // });
        let absPrice = _.meanBy(_.cloneDeep(data2), (data) => { return (data.H + data.L)/2;});
        if (time > 5) {
            return false;
        }
        // let minPrice1 = this.updateHighPrice(data);
        // let minPrice = this.getMin(data);
        let minLast = this.zigzag(data);

        let sideway = this.getSideWay(data);
        if (sideway) {
            if (sideway.length >= 18 && priceBuy > sideway.price && sumExpect > abs * 5) {  // default = 2
                return (lastData.V > abs * 1.75 && (lastData.type == "BUY" || !lastData.type) ) ? true : false;
            }

            if (absD / abs > 1.7) {
                if (priceBuy < absPrice * 1.04) {
                    return false;
                }
                if (priceBuy / minLast.price * 100 - 100 > 2 && priceBuy / minLast.price * 100 - 100 < 10 && sumExpect > abs * 5) {
                    return true;
                }
                return false;
            } else if (absD / abs > 1.4) {
                if (priceBuy / minLast.price * 100 - 100 > 2.5 && priceBuy / minLast.price * 100 - 100 < 3.5 && sumExpect > abs * 2.9) {
                    return true;
                }
                return false;

            }

            // default 0.65
            if (priceBuy >= minLast.price * 1.065) {
                return false;
            }
            if (sumExpect > abs * 6.5 && priceBuy <= sideway.price * 1.03 && priceBuy > sideway.price * 1.005) { // 12
                return true;
            }
            if (priceBuy / sideway.price * 100 - 100 > 2 && priceBuy / sideway.price * 100 - 100 < 3.5 && sumExpect > abs * 1.5) {
                return true;
            } else if (priceBuy / sideway.price * 100 - 100 > 2.5 && priceBuy / sideway.price * 100 - 100 < 3.5 && sumExpect > abs * 5) {   // max = 12
                return true;
            } else {
                return false;
            }
        } else {
            if (minLast.type === "low" && minLast.i <= data.length - 1) {
                if (data[data.length - 1].L * 1.01 > priceBuy) {
                    return false;
                }
            }

            if(priceBuy / minLast.price < 1.25 && priceBuy / minLast.price > 1.12
                && minLast.lastPrice && priceBuy / minLast.lastPrice < 1.035 && sumExpect > abs * 1.5) {
                return true;
            }

            if (minLast.type === "high" && minLast.i <= data.length - 1) {
                if (data[data.length - 1].L * 1.01 > priceBuy) {
                    return false;
                }
            }
            let dataNearest = data[data.length - 1];

            if (priceBuy / minLast.price * 100 - 100 > 3 && priceBuy / minLast.price * 100 - 100 < 3.5 && sumExpect > abs * 2 && dataNearest.type === "BUY" && dataNearest.V > abs / 2) {
                return true;
            } else if (priceBuy / minLast.price * 100 - 100 > 2.5 && priceBuy / minLast.price * 100 - 100 < 3.5 && sumExpect > abs * 5 && dataNearest.type === "BUY"  && dataNearest.V > abs / 2) {
                return true;
            } else {
                return false;
            }
        }
    }

    buyCoin(data: Array<IChart>, priceBuy: number, lastTimeBuy: string) {
        let lastData = data[data.length - 1];
        if (lastData.type === "SELL") {
            return false;
        }

        let fiveMinsLastest = data[data.length - 2];
        data = _.sortBy(data, "T")
        let time = ((new Date(lastTimeBuy).getTime() - new Date(lastData.T).getTime()) / 1000) / 60;
        if (time <= 0) {
            return false;
        }
        // if (_.isObject(data[data.length - 1].H)) {
        if (time <= 5) {
            data = _.slice(data, 0, data.length - 1)
        }
        // }
        let abs = _.meanBy(this.dva(_.cloneDeep(data)), "V");
        let absD = _.meanBy(_.cloneDeep(data), "V");

        var low = Math.round(145 * 0.025);
        var high = 145 - low;
        var data2 = data.slice(low, high);
        let absPrice = _.meanBy(_.cloneDeep(data2), (data) => {
            return (data.H + data.L) / 2;
        });
        console.log("process price", lastTimeBuy, lastData.T);

        let sumExpect = lastData.V / _.round(time % 5, 2) * 5;
        let minPrice = this.zigzag(data);

        // xu ly day la low
        if (minPrice.type === "low") {
            // case 1: đáy và dữ liệu mua lại tăng
            if (minPrice.i === data.length - 1 && fiveMinsLastest.V > abs * 1.8 && sumExpect > abs * 1.7
                && priceBuy > minPrice.price * 1.017 && fiveMinsLastest.V < sumExpect * 1.1) {
                return true;
            }
        } else {
            let maxSideWay = this.getSideWay(data);
            if (maxSideWay) {
                if (priceBuy > maxSideWay * 1.007 && priceBuy < maxSideWay * 1.02 && sumExpect > abs * 1.7) {
                    return true;
                }
            }
        }

        return false;
    }

    getSideWay(data: Array<IChart>) {
        let length = data.length,
            i = data.length,
            count = 0;
        let min = data[length - 1].H,
            max = data[length - 1].L,
            temp;
        while ((max / min) < 1.04) {  // defaukt 1.024
            i--;
            if (i === (length - 19)) {
                break;
            }

            temp = _.clone(max);
            if (data[i].H / data[i].L < 1.003) {
                continue;
            } else {
                count++;
            }
            if (data[i].H > max) {
                max = data[i].H;
            }
            if (data[i].L < min) {
                min = data[i].L;
            }
        }
        // default 8, current = 5
        if(count <= 4) {
             return null;
        } else {
            return (count >= 8 || length - i >= 12 ) ? {price: temp, length: length - i} : null;
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
                    t: "",
                    i: 0
                }
            }, curr_price,
            type = "low";
        swg.value = {type: 'low', price: data[0].H, t: data[0].T, i: 0};
        swg.items.push(swg.value);
        let lowPrice = {type: 'low', price: data[0].H, t: data[0].T, i: 0};
        for (let i = 1; i < length; i++) {
            curr_price = data[i];
            if (type == 'high') {
                if (curr_price.L <= swg.value.price * 0.92) {
                    type = "low";
                    swg.value = {type: 'low', price: curr_price.L, t: curr_price.T, i: i};
                    swg.items.push({type: 'low', price: curr_price.L, t: curr_price.T, i: i});
                } else if (curr_price.H > swg.value.price) {
                    swg.value.price = curr_price.H;
                    swg.value.t = curr_price.T;
                    swg.value.i = i;
                    swg.items[swg.items.length - 1] = swg.value;
                }

                if (lowPrice.price >= curr_price.L) {
                    lowPrice.price = curr_price.L;
                    lowPrice.t = curr_price.T;
                    lowPrice.i = i;
                }
            } else {
                if (curr_price.H >= swg.value.price * 1.08) {
                    type = "high";
                    swg.value = {type: 'high', price: curr_price.H, t: curr_price.T, i: i};
                    lowPrice = {type: 'high', price: curr_price.H, t: curr_price.T, i: i};
                    swg.items.push({type: 'high', price: curr_price.H, t: curr_price.T, i: i});
                } else if (curr_price.L < swg.value.price) {
                    swg.value.price = curr_price.L;
                    swg.value.t = curr_price.T;
                    swg.value.i = i;
                    swg.items[swg.items.length - 1] = swg.value;
                }
            }
        }
        // return _.findLast(swg.items, function (d) {
        //     return d.type === "low"
        // });
        let last = swg.items[swg.items.length - 1];
        //add i >= 142 de tranh dinh roi giam
        if (last.type === "low") {
            return last;
        } else {
            if (last.i === length - 1 && swg.items.length >= 2) {
                if (last.price / swg.items[swg.items.length - 2].price <= 1.05) {
                    return last;
                } else {
                    swg.items[swg.items.length - 2].lastPrice = last.price;
                    return swg.items[swg.items.length - 2];
                }
            }
            return lowPrice;
        }
    }

    checkShortSideWay(data: Array<IChart>) {
        let count = 0;

        for (let i = 0; i < data.length; i++) {

            if (data[i].H / data[i].L < 1.009) {
                count++;
            }
        }
        if (count >= 5) {
            return true;
        } else {
            return false;
        }
    }

    checkSideway(data: Array<IChart>) {
        let max = 0,
            min,
            count = 0;
        // if (data.length < 1) {
        //     return false;
        // }

        for (let i = 0; i < data.length; i++) {
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
        if (max / min < 1.04) {
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
        return this.tryRequest(url);
    }


    getListData(): any {
        let defer: any = Q.defer();
        let url = "https://bittrex.com/api/v1.1/public/getmarketsummaries";
        request({
            method: "GET",
            uri: url,
            maxAttempts: 5,  // (default) try 5 times
            retryDelay: 5000, // (default) wait for 5s before trying again
            retrySrategy: request.RetryStrategies.HTTPOrNetworkError
        }, (error: any, response: any, body: any) => {
            if (!error && response.statusCode === 200) {
                let res = (body && _.isString(body)) ? JSON.parse(body) : body;
                defer.resolve(res);
            } else {
                console.error("Unable to send message.");
                console.error(error);
                defer.resolve(null);
            }
        });

        return defer.promise;
    }

    caculateNewData(oldData: Array<any>, newData: Array<IHistoryBuySell>/*, now: string*/) {
        newData = _.reverse(_.cloneDeep(newData));
        let lastTime = new Date(oldData[oldData.length - 1].T);
        let temp1 = {H: 0, L: 100000000000000000000000000, V: 0, T: ""};
        let currTime = new Date(lastTime.getFullYear(), lastTime.getMonth(), lastTime.getDate(), lastTime.getHours(), lastTime.getMinutes() + 5, 0);
        let length = newData.length;
        let timeNow, count = 1, exclude = 0, per = 0;
        let sumSell = 0, sumBuy = 0;
        for (let i = 0; i < length; i++) {
            timeNow = ((new Date(newData[i].TimeStamp).getTime() - new Date(currTime.setMilliseconds(1)).getTime()) / 1000) / 60;
            per = timeNow / 5;

            if (new Date(newData[i].TimeStamp).getTime() - currTime.getTime() >= 0 || i === length - 1) {
                count++;
                temp1.T = new Date(_.clone(currTime).setMinutes(currTime.getMinutes() - 5)).toISOString();
                if (temp1.H !== 0) {
                    if (sumSell * 1.25 >= sumBuy) {
                        temp1.type = "SELL";
                    } else {
                        temp1.type = "BUY";
                    }
                    oldData.push(_.cloneDeep(temp1));
                    sumBuy = 0;
                    sumSell = 0;
                } else {
                    exclude++;
                }
                // currTime = new Date(currTime.getFullYear(), currTime.getMonth(), currTime.getDate(), currTime.getHours(), currTime.getMinutes() + 5, 0);
                while (new Date(newData[i].TimeStamp).getTime() - currTime.getTime() > 0) {
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

            if (newData[i].OrderType === "SELL") {
                sumSell += newData[i].Quantity;
            } else {
                sumBuy += newData[i].Quantity;
            }

            temp1.V += newData[i].Quantity;
        }

        // if (new Date(newData[newData.length - 1].TimeStamp).getTime() > new Date(_.clone(currTime).setMinutes(currTime.getMinutes() - 5)).getTime()) {
        //     temp1.T = new Date(_.clone(currTime).setMinutes(currTime.getMinutes() - 5)).toISOString();
        //     if (sumSell >= sumBuy) {
        //         temp1.type = "SELL";
        //     } else {
        //         temp1.type = "BUY";
        //     }
        //     oldData.push(_.cloneDeep(temp1));
        // }

        return _.slice(_.cloneDeep(oldData), (oldData.length > 144 ? oldData.length - 144 : 0));
    }


    getPrice(coin) {
        let url = "https://bittrex.com/api/v1.1/public/getticker?market=coin".replace("coin", coin);
        return this.tryRequest(url);
    }

    getHistory(coin: string) {
        let url = "https://bittrex.com/api/v1.1/public/getmarkethistory?market=".concat(coin);
        return this.tryRequest(url);
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
            uri: url,
            timeout: 10000
        }, (error: any, response: any, body: any) => {
            if (!error && response.statusCode === 200) {
                let res = (body && _.isString(body)) ? JSON.parse(body) : body;
                defer.resolve(res);
            } else {
                console.error("Unable to send message.");
                console.error(error);
                defer.resolve(null);
            }
        });

        return defer.promise;
    }

    tryRequest(url) {
        return this.request(url)
            .then((rs) => {
                if (rs) {
                    return rs;
                } else {
                    return this.tryRequest(url);
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
                            arr.push(this.prepareCoin.bind(this, d.MarketName, 144));
                        });
                        return this.executeInSequence(arr)
                    })
                    .then(() => {
                        console.log(" prepare data done ", new Date().toISOString());
                        return true;
                    });
            })
    }

    prepareCoin(coin: string, number?: number) {
        try {
            console.log("get coin", coin);
            return this.getChartHistory(coin, this.Five_Min)
                .then((rs) => {
                    let result;
                    if (number) {
                        result = _.takeRight(rs.result, number);
                    } else {
                        result = rs.result;
                    }
                    return this.orderHistoryRepository.create({MarketName: coin, Result: result});
                })
        } catch (e) {
            console.log("can''t get data coin", coin);
            return true;
        }

    }
}
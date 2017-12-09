import {inject, injectable} from "inversify";
import {ICoinController} from "./ICoinController";
import {ICoinService} from "../service/coin/ICoinService";
import LockRepository = require("../repository/LockRepository");
import {CoinService} from "../service/coin/CoinService";
import {TestService} from "../service/coin/TestService";

let schedule = require("node-schedule");

@injectable()
export class CoinController implements ICoinController {
    constructor(@inject("CoinService") private coinService: CoinService,
                @inject("TestService") private testService: TestService,
                @inject("LockRepository") private lockRepository: LockRepository) {

    }

    public schedule(): any {
        // this.lockRepository.update({lock: true},{lock: false})
        //     .then(() => {
        //         this.coinService.prepareData()
        //             .then(() => {
        //                 return this.loopFuntion()
        //             });
        //     })

        // return this.coinService.prepareData();
        // return this.testService.testLoop();
        return this.testService.testBuy("5a2979aff0bd0009b87c7972");
        // 5a146f4ec11732316c738756
        //5a1470f5c11732316c739461
        // return this.testService.testSell("5a15e525a52c8b29fc3bd12e");
        // return this.coinService.testSideWay("BTC-MEME");
        // return this.testService.runEach();
        // return this.testService.testCoin();
        // return this.coinService.testGetMin("BTC-NXC");
    }

    loopFuntion(){
        return this.lockRepository.find({lock: false})
            .then((rs) => {
                this.lockRepository.update({lock: false},{lock: true});
                if (rs) {
                    return this.coinService.loop()
                        .then((rs) => {
                            return this.lockRepository.update({lock: true},{lock: false})
                                .then(() => {
                                return this.loopFuntion()
                                });
                        },(err) => {
                            console.log("error",err);
                            return true;
                        });
                }
            })
    }

    updateCoin() {
        return this.coinService.updateCoin();
    }
}

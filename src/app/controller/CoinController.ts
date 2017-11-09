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
        //                 schedule.scheduleJob("* * * * *", () => {
        //                     return this.lockRepository.find({lock: false})
        //                         .then((rs) => {
        //                             this.lockRepository.update({lock: false},{lock: true});
        //                             if (rs) {
        //                                 return this.coinService.loop()
                                            // .then((rs) => {
                                            //     return this.lockRepository.update({lock: true},{lock: false});
                                            // },(err) => {
                                            //     console.log("error",err);
                                            //     return true;
                                            // });
                                    // }
                                // })
                        // });
                    // });
            // })

        // return this.coinService.prepareData();
        // return this.testService.testBuy("5a0337b70b4a742ef4532b15");
        // return this.coinService.testSideWay("BTC-MEME");
        return this.testService.testLoop();
        // return this.coinService.testGetMin("BTC-NXC");
    }

    updateCoin() {
        return this.coinService.updateCoin();
    }
}

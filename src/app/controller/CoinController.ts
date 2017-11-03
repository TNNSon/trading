import {inject, injectable} from "inversify";
import {ICoinController} from "./ICoinController";
import {ICoinService} from "../service/coin/ICoinService";
import LockRepository = require("../repository/LockRepository");
import {CoinService} from "../service/coin/CoinService";

let schedule = require("node-schedule");

@injectable()
export class CoinController implements ICoinController {
    constructor(@inject("CoinService") private coinService: CoinService,
                @inject("LockRepository") private lockRepository: LockRepository) {

    }

    public schedule(): any {
        schedule.scheduleJob("* * * * *", () => {
            return this.lockRepository.find({lock: false})
                .then((rs) => {
                    this.lockRepository.update({lock: false},{lock: true});
                    if (rs) {
                        return this.coinService.loop()
                            .then((rs) => {
                                return this.lockRepository.update({lock: true},{lock: false});
                            });
                    }
                })
        });
        // return this.coinService.test();
        // return this.coinService.testGetMin("BTC-NXC");
    }

    updateCoin() {
        return this.coinService.updateCoin();
    }
}

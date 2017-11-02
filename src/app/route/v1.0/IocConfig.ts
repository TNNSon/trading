import "reflect-metadata";
import {Container} from "inversify";
import {IRepositoryBase} from "../../core/IRepositoryBase";
import RepositoryBase = require("../../core/RepositoryBase");
import {CoinService} from "../../service/coin/CoinService";
import {CoinController} from "../../controller/CoinController";
import {ICoinController} from "../../controller/ICoinController";
import CoinRepository = require("../../repository/CoinRepository");
import SumRepository = require("../../repository/SumRepository");
import LockRepository = require("../../repository/LockRepository");
import CoinListRepository = require("../../repository/CoinListRepository");

class IocConfig {
    static init(): Container {
        let kernel: Container = new Container();

        kernel.bind<IRepositoryBase>("IRepositoryBase").to(RepositoryBase);
        kernel.bind<CoinRepository>("CoinRepository").to(CoinRepository);
        kernel.bind<SumRepository>("SumRepository").to(SumRepository);
        kernel.bind<LockRepository>("LockRepository").to(LockRepository);
        kernel.bind<CoinListRepository>("CoinListRepository").to(CoinListRepository);

        kernel.bind<CoinService>("CoinService").to(CoinService);

        kernel.bind<ICoinController>("ICoinController").to(CoinController);

        return kernel;
    }
}

export default IocConfig.init();

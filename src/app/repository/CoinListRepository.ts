import "reflect-metadata";
import {injectable, Container} from "inversify";
import RepositoryBase = require("../core/RepositoryBase");

var CoinListSchema = require("../shema/CoinListSchema");

@injectable()
class CoinListRepository extends RepositoryBase<{}>{
    constructor() {
        super(CoinListSchema);
    }
}

Object.seal(CoinListRepository);
export = CoinListRepository;
import "reflect-metadata";
import {injectable, Container} from "inversify";
import RepositoryBase = require("../core/RepositoryBase");

var CoinSchema = require("../shema/CoinSchema");

@injectable()
class CoinRepository extends RepositoryBase<{}>{
    constructor() {
        super(CoinSchema);
    }
}

Object.seal(CoinRepository);
export = CoinRepository;
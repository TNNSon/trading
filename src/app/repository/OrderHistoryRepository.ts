import "reflect-metadata";
import {injectable} from "inversify";
import RepositoryBase = require("../core/RepositoryBase");

var OrderHistorySchema = require("../shema/OrderHistorySchema");

@injectable()
class OrderHistoryRepository extends RepositoryBase<{}>{
    constructor() {
        super(OrderHistorySchema);
    }
}

Object.seal(OrderHistoryRepository);
export = OrderHistoryRepository;
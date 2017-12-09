import "reflect-metadata";
import {injectable, Container} from "inversify";
import RepositoryBase = require("../core/RepositoryBase");

var HistorySchema = require("../shema/HistorySchema");

@injectable()
class HistoryRepository extends RepositoryBase<{}>{
    constructor() {
        super(HistorySchema);
    }
}

Object.seal(HistoryRepository);
export = HistoryRepository;
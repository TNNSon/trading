import "reflect-metadata";
import {injectable, Container} from "inversify";
import RepositoryBase = require("../core/RepositoryBase");

var SumSchema = require("../shema/SumSchema");

@injectable()
class SumRepository extends RepositoryBase<{}>{
    constructor() {
        super(SumSchema);
    }
}

Object.seal(SumRepository);
export = SumRepository;
import "reflect-metadata";
import {injectable, Container} from "inversify";
import RepositoryBase = require("../core/RepositoryBase");

var LockSchema = require("../shema/LockSchema");

@injectable()
class LockRepository extends RepositoryBase<{}>{
    constructor() {
        super(LockSchema);
    }
}

Object.seal(LockRepository);
export = LockRepository;
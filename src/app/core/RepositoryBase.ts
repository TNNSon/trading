import mongoose = require("mongoose");
import {IRepositoryBase} from "./IRepositoryBase";
import {injectable, multiInject, unmanaged} from "inversify";

var Q = require("q");

@injectable()
class RepositoryBase<T> implements IRepositoryBase {
    private _model: mongoose.Model<mongoose.Document>;

    constructor(@unmanaged() schemaModel: mongoose.Model<mongoose.Document>) {
        this._model = schemaModel;
    }

    public retrieve(filter: any): any {
        return this._model.find(filter);
    }

    public create(item: any): any {
        return Q(this._model.create(item))
            .then((rs) => {
                return rs.toObject();
            });
    }

    public update(cond: any, item: any): any {
        return Q(this._model.update(cond, item));
    }

    public findById(modelId: string): any {
        return Q(this._model.findById(mongoose.Types.ObjectId(modelId)));
    }

    public find(conds: any): any {
        return Q(this._model.findOne(conds).lean().exec((err, rs) => {
                return rs;
        }))
    }

    public delete(_id: string): any {
        return this._model.remove({_id: this.toObjectId(_id)});
    }

    public findOneAndUpdate(conds: any, update: any): any {
        return this._model.findOneAndUpdate(conds, update,{upsert: true});
    }

    public toObjectId(_id: string): mongoose.Types.ObjectId {
        return mongoose.Types.ObjectId.createFromHexString(_id)
    }
}

export = RepositoryBase;
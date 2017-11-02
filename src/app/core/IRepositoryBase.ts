export interface IRepositoryBase {
    retrieve(filter: any): any;

    create(item: any): any;

    update(cond: any, item: any): any

    findById(modelId: string): any;

    delete(_id: string): any;

    findOneAndUpdate(conds: any, update: any): any

    toObjectId (_id: string): any;
}
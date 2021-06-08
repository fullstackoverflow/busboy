import Busboy from 'busboy';
import { IncomingMessage } from 'http';
import { Context } from 'koa';

export type onFile<T> = (fieldname: string, file: NodeJS.ReadableStream, filename: string, encoding?: string, mimetype?: string) => Promise<T>;

export function File<T>(onFile: onFile<T>): MethodDecorator {
    return function (target: any, key: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;
        if (method.constructor.name === "AsyncFunction") {
            descriptor.value = async function (ctx: Context) {
                const instance = new BusBoy({ headers: ctx.headers }, onFile);
                const { fields, files } = await instance.parse(ctx.request.req);
                (ctx.request as any).body = Object.assign({}, (ctx.request as any).body, fields, files);
                return await method.apply(this, arguments);
            };
        } else {
            throw new Error("File Decorator Must Used For Async Function");
        }
    };
}

export function middleware<T>(onFile: onFile<T>) {
    return async function (ctx, next) {
        const instance = new BusBoy({ headers: ctx.headers }, onFile);
        const { fields, files } = await instance.parse(ctx.request.req);
        (ctx.request as any).body = Object.assign({}, (ctx.request as any).body, fields, files);
        await next();
    }
}

export class BusBoy<T> extends Busboy {
    private CustomOnFile: onFile<T>;

    private fields: Object = {};

    private files = [];

    private onEnd: (...args: any[]) => void

    constructor(
        options: busboy.BusboyConfig,
        onFile: onFile<T>
    ) {
        super(options);
        this.CustomOnFile = onFile;
    }

    private clean() {
        return () => {
            this.removeListener('field', this.onField);
            this.removeListener('file', this.onFile);
            if (this.onEnd) {
                this.removeListener('end', this.onEnd);
                this.removeListener('error', this.onEnd);
                this.removeListener('partsLimit', this.onEnd);
                this.removeListener('filesLimit', this.onEnd);
                this.removeListener('fieldsLimit', this.onEnd);
                this.removeListener('finish', this.onEnd);
            }
        }
    }

    private onField(fields: string, name: any, fieldnameTruncated: boolean, valTruncated: boolean, encoding: string, mimetype: string) {
        this.fields[fields] = name;
    }

    private onFile(fieldname: string, file: NodeJS.ReadableStream, filename: string, encoding: string, mimetype: string, cache: any) {
        this.files.push({ field: fieldname, result: this.CustomOnFile(fieldname, file, filename, encoding, mimetype) });
    }

    private onEndFactory(resolve, reject) {
        const OnEnd = (err) => {
            if (err) {
                return reject(err);
            }
            this.clean();
            Promise.all(this.files.map(async i => ({ field: i.field, result: await i.result }))).then(i => {
                resolve({
                    fields: this.fields,
                    files: i.reduce((pre, curr) => {
                        pre[curr.field] = curr.result;
                        return pre;
                    }, {})
                })
            }).catch(reject);
        }
        return OnEnd;
    }


    async parse(req: IncomingMessage): Promise<{ fields: any, files: any }> {
        return new Promise((resolve, reject) => {
            this.onEnd = this.onEndFactory(resolve, reject);
            this.on('field', this.onField)
                .on('file', this.onFile)
                .on('partsLimit', () => {
                    this.clean();
                    reject("partsLimit");
                })
                .on('filesLimit', () => {
                    this.clean();
                    reject("filesLimit");
                })
                .on('fieldsLimit', () => {
                    this.clean();
                    reject("filesLimit");
                })
                .on('finish', this.onEnd)
            req.pipe(this);
        })

    }
}
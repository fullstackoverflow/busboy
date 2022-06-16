import busboy from "busboy";
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

type Result = {
    fields: any,
    files: any
}

export class BusBoy<T> {

    private _parse: Promise<Result>

    private instance: ReturnType<typeof busboy>;

    constructor(
        options: busboy.BusboyConfig,
        onFile: onFile<T>
    ) {
        this.instance = busboy(options);
        this._parse = new Promise<Result>((resolve, reject) => {
            const result: Result = {
                fields: {},
                files: {}
            };
            const promises: Promise<void>[] = [];
            this.instance.on('file', (name, file, info) => {
                promises.push(new Promise(async (res, rej) => {
                    try {
                        const obj = await onFile(name, file, info.filename, info.encoding, info.mimeType);
                        result.files[name] = obj;
                        res();
                    } catch (e) {
                        rej(e);
                    }
                }))
            });
            this.instance.on('field', (name, val, info) => {
                result.fields[name] = val;
            });
            this.instance.on('finish', () => {
                Promise.all(promises).then(() => {
                    resolve(result);
                }).catch(e => {
                    reject(e);
                });
            });
        });
    }

    async parse(req: IncomingMessage): Promise<Result> {
        req.pipe(this.instance);
        return this._parse;
    }
}
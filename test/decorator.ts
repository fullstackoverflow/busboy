import Koa from 'koa';
import { BusBoy, File } from '../lib';

export const app = new Koa();

class Test {
    @File(async (fieldname: string, file: NodeJS.ReadableStream, filename: string, encoding: string, mimetype: string) => {
        file.resume();
        return filename;
    })
    async handler(ctx, next) {
        ctx.body = ctx.request.body;
        await next();
    }
}

const instance = new Test();

app.use(instance.handler);

export const server = app.listen(3000);
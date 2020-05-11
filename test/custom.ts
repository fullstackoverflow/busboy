import Koa from 'koa';
import { BusBoy, File, middleware } from '../lib';

export const app = new Koa();

app.use(async (ctx, next) => {
    const instance = new BusBoy({ headers: ctx.headers }, async (fieldname: string, file: NodeJS.ReadableStream, filename: string, encoding: string, mimetype: string) => {
        file.resume();
        return filename;
    });
    const { fields, files } = await instance.parse(ctx.request.req);
    ctx.body = Object.assign({}, (ctx.request as any).body, fields, files);
});

export const server = app.listen(3002);
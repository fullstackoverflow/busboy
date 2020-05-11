import Koa from 'koa';
import { BusBoy, File, middleware } from '../lib';

export const app = new Koa();

app.use(
    middleware(
        async (fieldname: string, file: NodeJS.ReadableStream, filename: string, encoding: string, mimetype: string) => {
            file.resume();
            return filename;
        }
    )
);

app.use((ctx, next) => {
    ctx.body = (ctx.request as any).body;
})

export const server = app.listen(3001);
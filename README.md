[![codecov](https://codecov.io/gh/fullstackoverflow/busboy/branch/master/graph/badge.svg)](https://codecov.io/gh/fullstackoverflow/busboy)
[![NPM version](https://img.shields.io/npm/v/@tosee/busboy.svg)](https://www.npmjs.com/@tosee/busboy)
![Test](https://github.com/fullstackoverflow/busboy/workflows/Test/badge.svg)

# 介绍

```
(fieldname: string, file: NodeJS.ReadableStream, filename: string, encoding?: string, mimetype?: string) => Promise<any>;
```
该函数声明对文件流的处理,其中file流必须在该函数中被消费,该函数fieldname参数的作为parse函数返回值的files的对象的key,返回值作为value,即在实现为
```
(fieldname: string, file: NodeJS.ReadableStream, filename: string, encoding?: string, mimetype?: string) => {
    file.resume();
    return filname;
};
```
的情况下
```
const form = new FormData();
form.append("test",buffer,'test.jpg');
form.append("field","test");
```
parse函数的输出为
```
{
    field:"test",
    test:"test.jpg"
}
```

自定义
```
import { BusBoy, File, middleware } from '@tosee/busboy';
const app = new Koa();

app.use(async (ctx, next) => {
    const instance = new BusBoy({ headers: ctx.headers }, async (fieldname: string, file: NodeJS.ReadableStream, filename: string, encoding: string, mimetype: string) => {
        file.resume();
        return filename;
    });
    const { fields, files } = await instance.parse(ctx.request.req);
    ctx.body = Object.assign({}, (ctx.request as any).body, fields, files);
});

app.listen(3002);
```

装饰器
```
import Koa from 'koa';
import { BusBoy, File } from '@tosee/busboy';

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
```

中间件
```
import Koa from 'koa';
import { BusBoy, File, middleware } from '@tosee/busboy';

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
```
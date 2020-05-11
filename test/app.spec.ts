import "reflect-metadata";
import { Test, Expect, TestFixture, Timeout, SetupFixture } from "alsatian";
import koa from 'koa';
import request from "supertest";
import { server as s1 } from "./decorator";
import { server as s2 } from "./custom";
import { server as s3 } from "./middleware";
import { resolve } from "path";
import { readFileSync } from "fs";

@TestFixture('Middleware Test')
export class MiddlewareTest {
    i1: request.SuperTest<request.Test>;
    i2: request.SuperTest<request.Test>;
    i3: request.SuperTest<request.Test>;

    @SetupFixture
    init() {
        this.i1 = request(s1);
        this.i2 = request(s2);
        this.i3 = request(s3);
    }

    @Test(`formdata decorator parse should work`)
    @Timeout(10000)
    public async decorator() {
        const response = await this.i1.post("/formdata").attach("file", readFileSync(resolve(__dirname, "./test.md")),"test.md").field("test", "test");
        Expect(response.status).toBe(200);
        Expect(response.body).toEqual({ "file": "test.md", test: 'test' });
    }

    @Test(`formdata custom parse should work`)
    @Timeout(10000)
    public async custom() {
        const response = await this.i2.post("/formdata").attach("file", readFileSync(resolve(__dirname, "./test.md")),"test.md").field("test", "test");
        Expect(response.status).toBe(200);
        Expect(response.body).toEqual({ "file": "test.md", test: 'test' });
    }

    @Test(`formdata middleware parse should work`)
    @Timeout(10000)
    public async middleware() {
        const response = await this.i3.post("/formdata").attach("file", readFileSync(resolve(__dirname, "./test.md")),"test.md").field("test", "test");
        Expect(response.status).toBe(200);
        Expect(response.body).toEqual({ "file": "test.md", test: 'test' });
    }
}


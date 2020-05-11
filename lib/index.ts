import Busboy from 'busboy';
import { IncomingMessage } from 'http';
import { Context } from 'koa';

type onFile = (fieldname: string, file: NodeJS.ReadableStream, filename: string, encoding?: string, mimetype?: string) => Promise<any>;
type onField = (fieldname: string, val: any, fieldnameTruncated: boolean, valTruncated: boolean, encoding: string, mimetype: string) => any;

export function File(onFile: onFile): MethodDecorator {
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

export function middleware(onFile: onFile) {
    return async function (ctx, next) {
        const instance = new BusBoy({ headers: ctx.headers }, onFile);
        const { fields, files } = await instance.parse(ctx.request.req);
        (ctx.request as any).body = Object.assign({}, (ctx.request as any).body, fields, files);
        await next();
    }
}

export class BusBoy extends Busboy {
    private CustomOnFile: onFile;

    constructor(
        options: busboy.BusboyConfig,
        onFile: onFile
    ) {
        super(options);
        this.CustomOnFile = onFile;
    }

    private clean(onFile: (fieldname: string, file: NodeJS.ReadableStream, filename: string, encoding: string, mimetype: string) => any, onField: onField, onEnd: (err) => any) {
        return () => {
            this.removeListener('field', onField);
            this.removeListener('file', onFile);
            this.removeListener('end', onEnd);
            this.removeListener('error', onEnd);
            this.removeListener('partsLimit', onEnd);
            this.removeListener('filesLimit', onEnd);
            this.removeListener('fieldsLimit', onEnd);
            this.removeListener('finish', onEnd);
        }
    }

    private onField(cache: any) {
        return (fields: string, name: any, fieldnameTruncated: boolean, valTruncated: boolean, encoding: string, mimetype: string) => {
            cache[fields] = name;
        }
    }

    private onFile(cache: any) {
        return (fieldname: string, file: NodeJS.ReadableStream, filename: string, encoding: string, mimetype: string) => {
            cache.push({ field: fieldname, result: this.CustomOnFile(fieldname, file, filename, encoding, mimetype) });
        }
    }

    private onEnd(resolve, reject, fields: any, files: any[]) {
        return (err) => {
            if (err) {
                return reject(err);
            }
            Promise.all(files.map(async i => ({ field: i.field, result: await i.result }))).then(i => {
                resolve({
                    fields,
                    files: i.reduce((pre, curr) => {
                        pre[curr.field] = curr.result;
                        return pre;
                    }, {})
                })
            }).catch(reject);
        }
    }


    async parse(req: IncomingMessage): Promise<{ fields: any, files: any }> {
        const fields = {};
        const files = [];
        return new Promise((resolve, reject) => {
            const onField = this.onField(fields);
            const onFile = this.onFile(files);
            const onEnd = this.onEnd(resolve, reject, fields, files);
            const clean = this.clean(onFile, onField, onEnd);
            req.on('close', clean);
            this.on('field', onField)
                .on('file', onFile)
                .on('partsLimit', () => {
                    clean();
                    reject("partsLimit");
                })
                .on('filesLimit', () => {
                    clean();
                    reject("filesLimit");
                })
                .on('fieldsLimit', () => {
                    clean();
                    reject("filesLimit");
                })
                .on('finish', onEnd)
            req.pipe(this);
        })

    }
}

// module.exports = function (request, options) {
//     options = options || {};
//     options.headers = options.headers || request.headers;
//     const customOnFile = typeof options.onFile === "function" ? options.onFile : false;
//     delete options.onFile;
//     const customOnEnd = typeof options.onEnd === "function" ? options.onEnd : false;
//     delete options.onEnd;
//     const busboy = new Busboy(options);

//     return new Promise((resolve, reject) => {
//         const fields = {};
//         const filePromises = [];

//         request.on('close', cleanup);

//         busboy
//             .on('field', onField.bind(null, fields))
//             .on('file', onFile.bind(null, filePromises))
//             .on('close', cleanup)
//             .on('error', onError)
//             .on('end', onEnd)
//             .on('finish', onEnd);

//         busboy.on('partsLimit', function () {
//             const err = new Error('Reach parts limit');
//             err.code = 'Request_parts_limit';
//             err.status = 413;
//             onError(err);
//         });

//         busboy.on('filesLimit', () => {
//             const err = new Error('Reach files limit');
//             err.code = 'Request_files_limit';
//             err.status = 413;
//             onError(err);
//         });

//         busboy.on('fieldsLimit', () => {
//             const err = new Error('Reach fields limit');
//             err.code = 'Request_fields_limit';
//             err.status = 413;
//             onError(err);
//         });

//         request.pipe(busboy);

//         function onError(err) {
//             cleanup();
//             return reject(err);
//         }

//         function onEnd(err) {
//             if (err) {
//                 return reject(err);
//             }
//             if (customOnFile) {
//                 cleanup();
//                 resolve({ fields });
//             } else {
//                 Promise.all(filePromises)
//                     .then((files) => {
//                         cleanup();
//                         resolve({ fields, files });
//                     })
//                     .catch(reject);
//             }
//         }

//         function cleanup() {
//             busboy.removeListener('field', onField);
//             busboy.removeListener('file', customOnFile || onFile);
//             busboy.removeListener('close', cleanup);
//             busboy.removeListener('end', cleanup);
//             busboy.removeListener('error', onEnd);
//             busboy.removeListener('partsLimit', onEnd);
//             busboy.removeListener('filesLimit', onEnd);
//             busboy.removeListener('fieldsLimit', onEnd);
//             busboy.removeListener('finish', onEnd);
//         }
//     });
// };

// function onField(fields, name, val, fieldnameTruncated, valTruncated) {
//     // don't overwrite prototypes
//     if (getDescriptor(Object.prototype, name)) return;

//     // This looks like a stringified array, let's parse it
//     if (name.indexOf('[') > -1) {
//         const obj = objectFromBluePrint(extractFormData(name), val);
//         reconcile(obj, fields);

//     } else {
//         if (fields.hasOwnProperty(name)) {
//             if (Array.isArray(fields[name])) {
//                 fields[name].push(val);
//             } else {
//                 fields[name] = [fields[name], val];
//             }
//         } else {
//             fields[name] = val;
//         }
//     }
// }

// function onFile(filePromises, fieldname, file, filename, encoding, mimetype) {

//     const tmpName = file.tmpName = Math.random().toString(16).substring(2) + '-' + filename;
//     const saveTo = path.join(os.tmpdir(), path.basename(tmpName));
//     const writeStream = fs.createWriteStream(saveTo);

//     const filePromise = new Promise((resolve, reject) => writeStream
//         .on('open', () => file
//             .pipe(writeStream)
//             .on('error', reject)
//             .on('finish', () => {
//                 const readStream = fs.createReadStream(saveTo);
//                 readStream.fieldname = fieldname;
//                 readStream.filename = filename;
//                 readStream.transferEncoding = readStream.encoding = encoding;
//                 readStream.mimeType = readStream.mime = mimetype;
//                 resolve(readStream);
//             })
//         )
//         .on('error', (err) => {
//             file
//                 .resume()
//                 .on('error', reject);
//             reject(err);
//         })
//     );
//     filePromises.push(filePromise);
// }

// /**
//  *
//  * Extract a hierarchy array from a stringified formData single input.
//  *
//  *
//  * i.e. topLevel[sub1][sub2] => [topLevel, sub1, sub2]
//  *
//  * @param  {String} string: Stringify representation of a formData Object
//  * @return {Array}
//  *
//  */
// const extractFormData = (string) => {
//     const arr = string.split('[');
//     const first = arr.shift();
//     const res = arr.map(v => v.split(']')[0]);
//     res.unshift(first);
//     return res;
// };

// /**
//  *
//  * Generate an object given an hierarchy blueprint and the value
//  *
//  * i.e. [key1, key2, key3] => { key1: {key2: { key3: value }}};
//  *
//  * @param  {Array} arr:   from extractFormData
//  * @param  {[type]} value: The actual value for this key
//  * @return {[type]}       [description]
//  *
//  */
// const objectFromBluePrint = (arr, value) => {
//     return arr
//         .reverse()
//         .reduce((acc, next) => {
//             if (Number(next).toString() === 'NaN') {
//                 return { [next]: acc };
//             } else {
//                 const newAcc = [];
//                 newAcc[Number(next)] = acc;
//                 return newAcc;
//             }
//         }, value);
// };

// /**
//  * Reconciles formatted data with already formatted data
//  *
//  * @param  {Object} obj extractedObject
//  * @param  {Object} target the field object
//  * @return {Object} reconciled fields
//  *
//  */
// const reconcile = (obj, target) => {
//     const key = Object.keys(obj)[0];
//     const val = obj[key];

//     // The reconciliation works even with array has
//     // Object.keys will yield the array indexes
//     // see https://jsbin.com/hulekomopo/1/
//     // Since array are in form of [ , , valu3] [value1, value2]
//     // the final array will be: [value1, value2, value3] has expected
//     if (target.hasOwnProperty(key)) {
//         return reconcile(val, target[key]);
//     } else {
//         return target[key] = val;
//     }

// };

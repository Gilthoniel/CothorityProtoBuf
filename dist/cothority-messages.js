(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
module.exports = asPromise;

/**
 * Returns a promise from a node-style callback function.
 * @memberof util
 * @param {function(?Error, ...*)} fn Function to call
 * @param {*} ctx Function context
 * @param {...*} params Function arguments
 * @returns {Promise<*>} Promisified function
 */
function asPromise(fn, ctx/*, varargs */) {
    var params = [];
    for (var i = 2; i < arguments.length;)
        params.push(arguments[i++]);
    var pending = true;
    return new Promise(function asPromiseExecutor(resolve, reject) {
        params.push(function asPromiseCallback(err/*, varargs */) {
            if (pending) {
                pending = false;
                if (err)
                    reject(err);
                else {
                    var args = [];
                    for (var i = 1; i < arguments.length;)
                        args.push(arguments[i++]);
                    resolve.apply(null, args);
                }
            }
        });
        try {
            fn.apply(ctx || this, params); // eslint-disable-line no-invalid-this
        } catch (err) {
            if (pending) {
                pending = false;
                reject(err);
            }
        }
    });
}

},{}],2:[function(require,module,exports){
"use strict";

/**
 * A minimal base64 implementation for number arrays.
 * @memberof util
 * @namespace
 */
var base64 = exports;

/**
 * Calculates the byte length of a base64 encoded string.
 * @param {string} string Base64 encoded string
 * @returns {number} Byte length
 */
base64.length = function length(string) {
    var p = string.length;
    if (!p)
        return 0;
    var n = 0;
    while (--p % 4 > 1 && string.charAt(p) === "=")
        ++n;
    return Math.ceil(string.length * 3) / 4 - n;
};

// Base64 encoding table
var b64 = new Array(64);

// Base64 decoding table
var s64 = new Array(123);

// 65..90, 97..122, 48..57, 43, 47
for (var i = 0; i < 64;)
    s64[b64[i] = i < 26 ? i + 65 : i < 52 ? i + 71 : i < 62 ? i - 4 : i - 59 | 43] = i++;

/**
 * Encodes a buffer to a base64 encoded string.
 * @param {Uint8Array} buffer Source buffer
 * @param {number} start Source start
 * @param {number} end Source end
 * @returns {string} Base64 encoded string
 */
base64.encode = function encode(buffer, start, end) {
    var string = []; // alt: new Array(Math.ceil((end - start) / 3) * 4);
    var i = 0, // output index
        j = 0, // goto index
        t;     // temporary
    while (start < end) {
        var b = buffer[start++];
        switch (j) {
            case 0:
                string[i++] = b64[b >> 2];
                t = (b & 3) << 4;
                j = 1;
                break;
            case 1:
                string[i++] = b64[t | b >> 4];
                t = (b & 15) << 2;
                j = 2;
                break;
            case 2:
                string[i++] = b64[t | b >> 6];
                string[i++] = b64[b & 63];
                j = 0;
                break;
        }
    }
    if (j) {
        string[i++] = b64[t];
        string[i  ] = 61;
        if (j === 1)
            string[i + 1] = 61;
    }
    return String.fromCharCode.apply(String, string);
};

var invalidEncoding = "invalid encoding";

/**
 * Decodes a base64 encoded string to a buffer.
 * @param {string} string Source string
 * @param {Uint8Array} buffer Destination buffer
 * @param {number} offset Destination offset
 * @returns {number} Number of bytes written
 * @throws {Error} If encoding is invalid
 */
base64.decode = function decode(string, buffer, offset) {
    var start = offset;
    var j = 0, // goto index
        t;     // temporary
    for (var i = 0; i < string.length;) {
        var c = string.charCodeAt(i++);
        if (c === 61 && j > 1)
            break;
        if ((c = s64[c]) === undefined)
            throw Error(invalidEncoding);
        switch (j) {
            case 0:
                t = c;
                j = 1;
                break;
            case 1:
                buffer[offset++] = t << 2 | (c & 48) >> 4;
                t = c;
                j = 2;
                break;
            case 2:
                buffer[offset++] = (t & 15) << 4 | (c & 60) >> 2;
                t = c;
                j = 3;
                break;
            case 3:
                buffer[offset++] = (t & 3) << 6 | c;
                j = 0;
                break;
        }
    }
    if (j === 1)
        throw Error(invalidEncoding);
    return offset - start;
};

/**
 * Tests if the specified string appears to be base64 encoded.
 * @param {string} string String to test
 * @returns {boolean} `true` if probably base64 encoded, otherwise false
 */
base64.test = function test(string) {
    return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(string);
};

},{}],3:[function(require,module,exports){
"use strict";
module.exports = codegen;

var blockOpenRe  = /[{[]$/,
    blockCloseRe = /^[}\]]/,
    casingRe     = /:$/,
    branchRe     = /^\s*(?:if|}?else if|while|for)\b|\b(?:else)\s*$/,
    breakRe      = /\b(?:break|continue)(?: \w+)?;?$|^\s*return\b/;

/**
 * A closure for generating functions programmatically.
 * @memberof util
 * @namespace
 * @function
 * @param {...string} params Function parameter names
 * @returns {Codegen} Codegen instance
 * @property {boolean} supported Whether code generation is supported by the environment.
 * @property {boolean} verbose=false When set to true, codegen will log generated code to console. Useful for debugging.
 * @property {function(string, ...*):string} sprintf Underlying sprintf implementation
 */
function codegen() {
    var params = [],
        src    = [],
        indent = 1,
        inCase = false;
    for (var i = 0; i < arguments.length;)
        params.push(arguments[i++]);

    /**
     * A codegen instance as returned by {@link codegen}, that also is a sprintf-like appender function.
     * @typedef Codegen
     * @type {function}
     * @param {string} format Format string
     * @param {...*} args Replacements
     * @returns {Codegen} Itself
     * @property {function(string=):string} str Stringifies the so far generated function source.
     * @property {function(string=, Object=):function} eof Ends generation and builds the function whilst applying a scope.
     */
    /**/
    function gen() {
        var args = [],
            i = 0;
        for (; i < arguments.length;)
            args.push(arguments[i++]);
        var line = sprintf.apply(null, args);
        var level = indent;
        if (src.length) {
            var prev = src[src.length - 1];

            // block open or one time branch
            if (blockOpenRe.test(prev))
                level = ++indent; // keep
            else if (branchRe.test(prev))
                ++level; // once

            // casing
            if (casingRe.test(prev) && !casingRe.test(line)) {
                level = ++indent;
                inCase = true;
            } else if (inCase && breakRe.test(prev)) {
                level = --indent;
                inCase = false;
            }

            // block close
            if (blockCloseRe.test(line))
                level = --indent;
        }
        for (i = 0; i < level; ++i)
            line = "\t" + line;
        src.push(line);
        return gen;
    }

    /**
     * Stringifies the so far generated function source.
     * @param {string} [name] Function name, defaults to generate an anonymous function
     * @returns {string} Function source using tabs for indentation
     * @inner
     */
    function str(name) {
        return "function" + (name ? " " + name.replace(/[^\w_$]/g, "_") : "") + "(" + params.join(",") + ") {\n" + src.join("\n") + "\n}";
    }

    gen.str = str;

    /**
     * Ends generation and builds the function whilst applying a scope.
     * @param {string} [name] Function name, defaults to generate an anonymous function
     * @param {Object.<string,*>} [scope] Function scope
     * @returns {function} The generated function, with scope applied if specified
     * @inner
     */
    function eof(name, scope) {
        if (typeof name === "object") {
            scope = name;
            name = undefined;
        }
        var source = gen.str(name);
        if (codegen.verbose)
            console.log("--- codegen ---\n" + source.replace(/^/mg, "> ").replace(/\t/g, "  ")); // eslint-disable-line no-console
        var keys = Object.keys(scope || (scope = {}));
        return Function.apply(null, keys.concat("return " + source)).apply(null, keys.map(function(key) { return scope[key]; })); // eslint-disable-line no-new-func
        //     ^ Creates a wrapper function with the scoped variable names as its parameters,
        //       calls it with the respective scoped variable values ^
        //       and returns our brand-new properly scoped function.
        //
        // This works because "Invoking the Function constructor as a function (without using the
        // new operator) has the same effect as invoking it as a constructor."
        // https://developer.mozilla.org/de/docs/Web/JavaScript/Reference/Global_Objects/Function
    }

    gen.eof = eof;

    return gen;
}

function sprintf(format) {
    var args = [],
        i = 1;
    for (; i < arguments.length;)
        args.push(arguments[i++]);
    i = 0;
    format = format.replace(/%([dfjs])/g, function($0, $1) {
        switch ($1) {
            case "d":
                return Math.floor(args[i++]);
            case "f":
                return Number(args[i++]);
            case "j":
                return JSON.stringify(args[i++]);
            default:
                return args[i++];
        }
    });
    if (i !== args.length)
        throw Error("argument count mismatch");
    return format;
}

codegen.sprintf   = sprintf;
codegen.supported = false; try { codegen.supported = codegen("a","b")("return a-b").eof()(2,1) === 1; } catch (e) {} // eslint-disable-line no-empty
codegen.verbose   = false;

},{}],4:[function(require,module,exports){
"use strict";
module.exports = EventEmitter;

/**
 * Constructs a new event emitter instance.
 * @classdesc A minimal event emitter.
 * @memberof util
 * @constructor
 */
function EventEmitter() {

    /**
     * Registered listeners.
     * @type {Object.<string,*>}
     * @private
     */
    this._listeners = {};
}

/**
 * Registers an event listener.
 * @param {string} evt Event name
 * @param {function} fn Listener
 * @param {*} [ctx] Listener context
 * @returns {util.EventEmitter} `this`
 */
EventEmitter.prototype.on = function on(evt, fn, ctx) {
    (this._listeners[evt] || (this._listeners[evt] = [])).push({
        fn  : fn,
        ctx : ctx || this
    });
    return this;
};

/**
 * Removes an event listener or any matching listeners if arguments are omitted.
 * @param {string} [evt] Event name. Removes all listeners if omitted.
 * @param {function} [fn] Listener to remove. Removes all listeners of `evt` if omitted.
 * @returns {util.EventEmitter} `this`
 */
EventEmitter.prototype.off = function off(evt, fn) {
    if (evt === undefined)
        this._listeners = {};
    else {
        if (fn === undefined)
            this._listeners[evt] = [];
        else {
            var listeners = this._listeners[evt];
            for (var i = 0; i < listeners.length;)
                if (listeners[i].fn === fn)
                    listeners.splice(i, 1);
                else
                    ++i;
        }
    }
    return this;
};

/**
 * Emits an event by calling its listeners with the specified arguments.
 * @param {string} evt Event name
 * @param {...*} args Arguments
 * @returns {util.EventEmitter} `this`
 */
EventEmitter.prototype.emit = function emit(evt) {
    var listeners = this._listeners[evt];
    if (listeners) {
        var args = [],
            i = 1;
        for (; i < arguments.length;)
            args.push(arguments[i++]);
        for (i = 0; i < listeners.length;)
            listeners[i].fn.apply(listeners[i++].ctx, args);
    }
    return this;
};

},{}],5:[function(require,module,exports){
"use strict";
module.exports = fetch;

var asPromise = require("@protobufjs/aspromise"),
    inquire   = require("@protobufjs/inquire");

var fs = inquire("fs");

/**
 * Node-style callback as used by {@link util.fetch}.
 * @typedef FetchCallback
 * @type {function}
 * @param {?Error} error Error, if any, otherwise `null`
 * @param {string} [contents] File contents, if there hasn't been an error
 * @returns {undefined}
 */

/**
 * Options as used by {@link util.fetch}.
 * @typedef FetchOptions
 * @type {Object}
 * @property {boolean} [binary=false] Whether expecting a binary response
 * @property {boolean} [xhr=false] If `true`, forces the use of XMLHttpRequest
 */

/**
 * Fetches the contents of a file.
 * @memberof util
 * @param {string} filename File path or url
 * @param {FetchOptions} options Fetch options
 * @param {FetchCallback} callback Callback function
 * @returns {undefined}
 */
function fetch(filename, options, callback) {
    if (typeof options === "function") {
        callback = options;
        options = {};
    } else if (!options)
        options = {};

    if (!callback)
        return asPromise(fetch, this, filename, options); // eslint-disable-line no-invalid-this

    // if a node-like filesystem is present, try it first but fall back to XHR if nothing is found.
    if (!options.xhr && fs && fs.readFile)
        return fs.readFile(filename, function fetchReadFileCallback(err, contents) {
            return err && typeof XMLHttpRequest !== "undefined"
                ? fetch.xhr(filename, options, callback)
                : err
                ? callback(err)
                : callback(null, options.binary ? contents : contents.toString("utf8"));
        });

    // use the XHR version otherwise.
    return fetch.xhr(filename, options, callback);
}

/**
 * Fetches the contents of a file.
 * @name util.fetch
 * @function
 * @param {string} path File path or url
 * @param {FetchCallback} callback Callback function
 * @returns {undefined}
 * @variation 2
 */

/**
 * Fetches the contents of a file.
 * @name util.fetch
 * @function
 * @param {string} path File path or url
 * @param {FetchOptions} [options] Fetch options
 * @returns {Promise<string|Uint8Array>} Promise
 * @variation 3
 */

/**/
fetch.xhr = function fetch_xhr(filename, options, callback) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange /* works everywhere */ = function fetchOnReadyStateChange() {

        if (xhr.readyState !== 4)
            return undefined;

        // local cors security errors return status 0 / empty string, too. afaik this cannot be
        // reliably distinguished from an actually empty file for security reasons. feel free
        // to send a pull request if you are aware of a solution.
        if (xhr.status !== 0 && xhr.status !== 200)
            return callback(Error("status " + xhr.status));

        // if binary data is expected, make sure that some sort of array is returned, even if
        // ArrayBuffers are not supported. the binary string fallback, however, is unsafe.
        if (options.binary) {
            var buffer = xhr.response;
            if (!buffer) {
                buffer = [];
                for (var i = 0; i < xhr.responseText.length; ++i)
                    buffer.push(xhr.responseText.charCodeAt(i) & 255);
            }
            return callback(null, typeof Uint8Array !== "undefined" ? new Uint8Array(buffer) : buffer);
        }
        return callback(null, xhr.responseText);
    };

    if (options.binary) {
        // ref: https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Sending_and_Receiving_Binary_Data#Receiving_binary_data_in_older_browsers
        if ("overrideMimeType" in xhr)
            xhr.overrideMimeType("text/plain; charset=x-user-defined");
        xhr.responseType = "arraybuffer";
    }

    xhr.open("GET", filename);
    xhr.send();
};

},{"@protobufjs/aspromise":1,"@protobufjs/inquire":6}],6:[function(require,module,exports){
"use strict";
module.exports = inquire;

/**
 * Requires a module only if available.
 * @memberof util
 * @param {string} moduleName Module to require
 * @returns {?Object} Required module if available and not empty, otherwise `null`
 */
function inquire(moduleName) {
    try {
        var mod = eval("quire".replace(/^/,"re"))(moduleName); // eslint-disable-line no-eval
        if (mod && (mod.length || Object.keys(mod).length))
            return mod;
    } catch (e) {} // eslint-disable-line no-empty
    return null;
}

},{}],7:[function(require,module,exports){
"use strict";

/**
 * A minimal path module to resolve Unix, Windows and URL paths alike.
 * @memberof util
 * @namespace
 */
var path = exports;

var isAbsolute =
/**
 * Tests if the specified path is absolute.
 * @param {string} path Path to test
 * @returns {boolean} `true` if path is absolute
 */
path.isAbsolute = function isAbsolute(path) {
    return /^(?:\/|\w+:)/.test(path);
};

var normalize =
/**
 * Normalizes the specified path.
 * @param {string} path Path to normalize
 * @returns {string} Normalized path
 */
path.normalize = function normalize(path) {
    path = path.replace(/\\/g, "/")
               .replace(/\/{2,}/g, "/");
    var parts    = path.split("/"),
        absolute = isAbsolute(path),
        prefix   = "";
    if (absolute)
        prefix = parts.shift() + "/";
    for (var i = 0; i < parts.length;) {
        if (parts[i] === "..") {
            if (i > 0 && parts[i - 1] !== "..")
                parts.splice(--i, 2);
            else if (absolute)
                parts.splice(i, 1);
            else
                ++i;
        } else if (parts[i] === ".")
            parts.splice(i, 1);
        else
            ++i;
    }
    return prefix + parts.join("/");
};

/**
 * Resolves the specified include path against the specified origin path.
 * @param {string} originPath Path to the origin file
 * @param {string} includePath Include path relative to origin path
 * @param {boolean} [alreadyNormalized=false] `true` if both paths are already known to be normalized
 * @returns {string} Path to the include file
 */
path.resolve = function resolve(originPath, includePath, alreadyNormalized) {
    if (!alreadyNormalized)
        includePath = normalize(includePath);
    if (isAbsolute(includePath))
        return includePath;
    if (!alreadyNormalized)
        originPath = normalize(originPath);
    return (originPath = originPath.replace(/(?:\/|^)[^/]+$/, "")).length ? normalize(originPath + "/" + includePath) : includePath;
};

},{}],8:[function(require,module,exports){
"use strict";
module.exports = pool;

/**
 * An allocator as used by {@link util.pool}.
 * @typedef PoolAllocator
 * @type {function}
 * @param {number} size Buffer size
 * @returns {Uint8Array} Buffer
 */

/**
 * A slicer as used by {@link util.pool}.
 * @typedef PoolSlicer
 * @type {function}
 * @param {number} start Start offset
 * @param {number} end End offset
 * @returns {Uint8Array} Buffer slice
 * @this {Uint8Array}
 */

/**
 * A general purpose buffer pool.
 * @memberof util
 * @function
 * @param {PoolAllocator} alloc Allocator
 * @param {PoolSlicer} slice Slicer
 * @param {number} [size=8192] Slab size
 * @returns {PoolAllocator} Pooled allocator
 */
function pool(alloc, slice, size) {
    var SIZE   = size || 8192;
    var MAX    = SIZE >>> 1;
    var slab   = null;
    var offset = SIZE;
    return function pool_alloc(size) {
        if (size < 1 || size > MAX)
            return alloc(size);
        if (offset + size > SIZE) {
            slab = alloc(SIZE);
            offset = 0;
        }
        var buf = slice.call(slab, offset, offset += size);
        if (offset & 7) // align to 32 bit
            offset = (offset | 7) + 1;
        return buf;
    };
}

},{}],9:[function(require,module,exports){
"use strict";

/**
 * A minimal UTF8 implementation for number arrays.
 * @memberof util
 * @namespace
 */
var utf8 = exports;

/**
 * Calculates the UTF8 byte length of a string.
 * @param {string} string String
 * @returns {number} Byte length
 */
utf8.length = function utf8_length(string) {
    var len = 0,
        c = 0;
    for (var i = 0; i < string.length; ++i) {
        c = string.charCodeAt(i);
        if (c < 128)
            len += 1;
        else if (c < 2048)
            len += 2;
        else if ((c & 0xFC00) === 0xD800 && (string.charCodeAt(i + 1) & 0xFC00) === 0xDC00) {
            ++i;
            len += 4;
        } else
            len += 3;
    }
    return len;
};

/**
 * Reads UTF8 bytes as a string.
 * @param {Uint8Array} buffer Source buffer
 * @param {number} start Source start
 * @param {number} end Source end
 * @returns {string} String read
 */
utf8.read = function utf8_read(buffer, start, end) {
    var len = end - start;
    if (len < 1)
        return "";
    var parts = null,
        chunk = [],
        i = 0, // char offset
        t;     // temporary
    while (start < end) {
        t = buffer[start++];
        if (t < 128)
            chunk[i++] = t;
        else if (t > 191 && t < 224)
            chunk[i++] = (t & 31) << 6 | buffer[start++] & 63;
        else if (t > 239 && t < 365) {
            t = ((t & 7) << 18 | (buffer[start++] & 63) << 12 | (buffer[start++] & 63) << 6 | buffer[start++] & 63) - 0x10000;
            chunk[i++] = 0xD800 + (t >> 10);
            chunk[i++] = 0xDC00 + (t & 1023);
        } else
            chunk[i++] = (t & 15) << 12 | (buffer[start++] & 63) << 6 | buffer[start++] & 63;
        if (i > 8191) {
            (parts || (parts = [])).push(String.fromCharCode.apply(String, chunk));
            i = 0;
        }
    }
    if (parts) {
        if (i)
            parts.push(String.fromCharCode.apply(String, chunk.slice(0, i)));
        return parts.join("");
    }
    return String.fromCharCode.apply(String, chunk.slice(0, i));
};

/**
 * Writes a string as UTF8 bytes.
 * @param {string} string Source string
 * @param {Uint8Array} buffer Destination buffer
 * @param {number} offset Destination offset
 * @returns {number} Bytes written
 */
utf8.write = function utf8_write(string, buffer, offset) {
    var start = offset,
        c1, // character 1
        c2; // character 2
    for (var i = 0; i < string.length; ++i) {
        c1 = string.charCodeAt(i);
        if (c1 < 128) {
            buffer[offset++] = c1;
        } else if (c1 < 2048) {
            buffer[offset++] = c1 >> 6       | 192;
            buffer[offset++] = c1       & 63 | 128;
        } else if ((c1 & 0xFC00) === 0xD800 && ((c2 = string.charCodeAt(i + 1)) & 0xFC00) === 0xDC00) {
            c1 = 0x10000 + ((c1 & 0x03FF) << 10) + (c2 & 0x03FF);
            ++i;
            buffer[offset++] = c1 >> 18      | 240;
            buffer[offset++] = c1 >> 12 & 63 | 128;
            buffer[offset++] = c1 >> 6  & 63 | 128;
            buffer[offset++] = c1       & 63 | 128;
        } else {
            buffer[offset++] = c1 >> 12      | 224;
            buffer[offset++] = c1 >> 6  & 63 | 128;
            buffer[offset++] = c1       & 63 | 128;
        }
    }
    return offset - start;
};

},{}],10:[function(require,module,exports){
"use strict";
module.exports = require("./src/index");

},{"./src/index":20}],11:[function(require,module,exports){
"use strict";
module.exports = Class;

var Message = require("./message"),
    util    = require("./util");

var Type; // cyclic

/**
 * Constructs a new message prototype for the specified reflected type and sets up its constructor.
 * @classdesc Runtime class providing the tools to create your own custom classes.
 * @constructor
 * @param {Type} type Reflected message type
 * @param {*} [ctor] Custom constructor to set up, defaults to create a generic one if omitted
 * @returns {Message} Message prototype
 */
function Class(type, ctor) {
    if (!Type)
        Type = require("./type");

    if (!(type instanceof Type))
        throw TypeError("type must be a Type");

    if (ctor) {
        if (typeof ctor !== "function")
            throw TypeError("ctor must be a function");
    } else
        // create named constructor functions (codegen is required anyway)
        ctor = util.codegen("p")("return c.call(this,p)").eof(type.name, {
            c: Message
        });

    // Let's pretend...
    ctor.constructor = Class;

    // new Class() -> Message.prototype
    (ctor.prototype = new Message()).constructor = ctor;

    // Static methods on Message are instance methods on Class and vice versa
    util.merge(ctor, Message, true);

    // Classes and messages reference their reflected type
    ctor.$type = type;
    ctor.prototype.$type = type;

    // Messages have non-enumerable default values on their prototype
    var i = 0;
    for (; i < /* initializes */ type.fieldsArray.length; ++i) {
        // objects on the prototype must be immmutable. users must assign a new object instance and
        // cannot use Array#push on empty arrays on the prototype for example, as this would modify
        // the value on the prototype for ALL messages of this type. Hence, these objects are frozen.
        ctor.prototype[type._fieldsArray[i].name] = Array.isArray(type._fieldsArray[i].resolve().defaultValue)
            ? util.emptyArray
            : util.isObject(type._fieldsArray[i].defaultValue) && !type._fieldsArray[i].long
              ? util.emptyObject
              : type._fieldsArray[i].defaultValue; // if a long, it is frozen when initialized
    }

    // Messages have non-enumerable getters and setters for each virtual oneof field
    var ctorProperties = {};
    for (i = 0; i < /* initializes */ type.oneofsArray.length; ++i)
        ctorProperties[type._oneofsArray[i].resolve().name] = {
            get: util.oneOfGetter(type._oneofsArray[i].oneof),
            set: util.oneOfSetter(type._oneofsArray[i].oneof)
        };
    if (i)
        Object.defineProperties(ctor.prototype, ctorProperties);

    // Register
    type.ctor = ctor;

    return ctor.prototype;
}

/**
 * Constructs a new message prototype for the specified reflected type and sets up its constructor.
 * @function
 * @param {Type} type Reflected message type
 * @param {*} [ctor] Custom constructor to set up, defaults to create a generic one if omitted
 * @returns {Message} Message prototype
 */
Class.create = Class;

// Static methods on Message are instance methods on Class and vice versa
Class.prototype = Message;

/**
 * Creates a new message of this type from a plain object. Also converts values to their respective internal types.
 * @name Class#fromObject
 * @function
 * @param {Object.<string,*>} object Plain object
 * @returns {Message} Message instance
 */

/**
 * Creates a new message of this type from a plain object. Also converts values to their respective internal types.
 * This is an alias of {@link Class#fromObject}.
 * @name Class#from
 * @function
 * @param {Object.<string,*>} object Plain object
 * @returns {Message} Message instance
 */

/**
 * Creates a plain object from a message of this type. Also converts values to other types if specified.
 * @name Class#toObject
 * @function
 * @param {Message} message Message instance
 * @param {ConversionOptions} [options] Conversion options
 * @returns {Object.<string,*>} Plain object
 */

/**
 * Encodes a message of this type.
 * @name Class#encode
 * @function
 * @param {Message|Object} message Message to encode
 * @param {Writer} [writer] Writer to use
 * @returns {Writer} Writer
 */

/**
 * Encodes a message of this type preceeded by its length as a varint.
 * @name Class#encodeDelimited
 * @function
 * @param {Message|Object} message Message to encode
 * @param {Writer} [writer] Writer to use
 * @returns {Writer} Writer
 */

/**
 * Decodes a message of this type.
 * @name Class#decode
 * @function
 * @param {Reader|Uint8Array} reader Reader or buffer to decode
 * @returns {Message} Decoded message
 */

/**
 * Decodes a message of this type preceeded by its length as a varint.
 * @name Class#decodeDelimited
 * @function
 * @param {Reader|Uint8Array} reader Reader or buffer to decode
 * @returns {Message} Decoded message
 */

/**
 * Verifies a message of this type.
 * @name Class#verify
 * @function
 * @param {Message|Object} message Message or plain object to verify
 * @returns {?string} `null` if valid, otherwise the reason why it is not
 */

},{"./message":22,"./type":35,"./util":37}],12:[function(require,module,exports){
"use strict";
module.exports = common;

/**
 * Provides common type definitions.
 * Can also be used to provide additional google types or your own custom types.
 * @param {string} name Short name as in `google/protobuf/[name].proto` or full file name
 * @param {Object.<string,*>} json JSON definition within `google.protobuf` if a short name, otherwise the file's root definition
 * @returns {undefined}
 * @property {Object.<string,*>} google/protobuf/any.proto Any
 * @property {Object.<string,*>} google/protobuf/duration.proto Duration
 * @property {Object.<string,*>} google/protobuf/empty.proto Empty
 * @property {Object.<string,*>} google/protobuf/struct.proto Struct, Value, NullValue and ListValue
 * @property {Object.<string,*>} google/protobuf/timestamp.proto Timestamp
 * @property {Object.<string,*>} google/protobuf/wrappers.proto Wrappers
 * @example
 * // manually provides descriptor.proto (assumes google/protobuf/ namespace and .proto extension)
 * protobuf.common("descriptor", descriptorJson);
 * 
 * // manually provides a custom definition (uses my.foo namespace)
 * protobuf.common("my/foo/bar.proto", myFooBarJson);
 */
function common(name, json) {
    if (!/\/|\./.test(name)) {
        name = "google/protobuf/" + name + ".proto";
        json = { nested: { google: { nested: { protobuf: { nested: json } } } } };
    }
    common[name] = json;
}

// Not provided because of limited use (feel free to discuss or to provide yourself):
//
// google/protobuf/descriptor.proto
// google/protobuf/field_mask.proto
// google/protobuf/source_context.proto
// google/protobuf/type.proto
//
// Stripped and pre-parsed versions of these non-bundled files are instead available as part of
// the repository or package within the google/protobuf directory.

common("any", {
    Any: {
        fields: {
            type_url: {
                type: "string",
                id: 1
            },
            value: {
                type: "bytes",
                id: 2
            }
        }
    }
});

var timeType;

common("duration", {
    Duration: timeType = {
        fields: {
            seconds: {
                type: "int64",
                id: 1
            },
            nanos: {
                type: "int32",
                id: 2
            }
        }
    }
});

common("timestamp", {
    Timestamp: timeType
});

common("empty", {
    Empty: {
        fields: {}
    }
});

common("struct", {
    Struct: {
        fields: {
            fields: {
                keyType: "string",
                type: "Value",
                id: 1
            }
        }
    },
    Value: {
        oneofs: {
            kind: {
                oneof: [
                    "nullValue",
                    "numberValue",
                    "stringValue",
                    "boolValue",
                    "structValue",
                    "listValue"
                ]
            }
        },
        fields: {
            nullValue: {
                type: "NullValue",
                id: 1
            },
            numberValue: {
                type: "double",
                id: 2
            },
            stringValue: {
                type: "string",
                id: 3
            },
            boolValue: {
                type: "bool",
                id: 4
            },
            structValue: {
                type: "Struct",
                id: 5
            },
            listValue: {
                type: "ListValue",
                id: 6
            }
        }
    },
    NullValue: {
        values: {
            NULL_VALUE: 0
        }
    },
    ListValue: {
        fields: {
            values: {
                rule: "repeated",
                type: "Value",
                id: 1
            }
        }
    }
});

common("wrappers", {
    DoubleValue: {
        fields: {
            value: {
                type: "double",
                id: 1
            }
        }
    },
    FloatValue: {
        fields: {
            value: {
                type: "float",
                id: 1
            }
        }
    },
    Int64Value: {
        fields: {
            value: {
                type: "int64",
                id: 1
            }
        }
    },
    UInt64Value: {
        fields: {
            value: {
                type: "uint64",
                id: 1
            }
        }
    },
    Int32Value: {
        fields: {
            value: {
                type: "int32",
                id: 1
            }
        }
    },
    UInt32Value: {
        fields: {
            value: {
                type: "uint32",
                id: 1
            }
        }
    },
    BoolValue: {
        fields: {
            value: {
                type: "bool",
                id: 1
            }
        }
    },
    StringValue: {
        fields: {
            value: {
                type: "string",
                id: 1
            }
        }
    },
    BytesValue: {
        fields: {
            value: {
                type: "bytes",
                id: 1
            }
        }
    }
});

},{}],13:[function(require,module,exports){
"use strict";
/**
 * Runtime message from/to plain object converters.
 * @namespace
 */
var converter = exports;

var Enum = require("./enum"),
    util = require("./util");

/**
 * Generates a partial value fromObject conveter.
 * @param {Codegen} gen Codegen instance
 * @param {Field} field Reflected field
 * @param {number} fieldIndex Field index
 * @param {string} prop Property reference
 * @returns {Codegen} Codegen instance
 * @ignore
 */
function genValuePartial_fromObject(gen, field, fieldIndex, prop) {
    /* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */
    if (field.resolvedType) {
        if (field.resolvedType instanceof Enum) { gen
            ("switch(d%s){", prop);
            for (var values = field.resolvedType.values, keys = Object.keys(values), i = 0; i < keys.length; ++i) {
                if (field.repeated && values[keys[i]] === field.typeDefault) gen
                ("default:");
                gen
                ("case%j:", keys[i])
                ("case %j:", values[keys[i]])
                    ("m%s=%j", prop, values[keys[i]])
                    ("break");
            } gen
            ("}");
        } else gen
            ("if(typeof d%s!==\"object\")", prop)
                ("throw TypeError(%j)", field.fullName + ": object expected")
            ("m%s=types[%d].fromObject(d%s)", prop, fieldIndex, prop);
    } else {
        var isUnsigned = false;
        switch (field.type) {
            case "double":
            case "float":gen
                ("m%s=Number(d%s)", prop, prop);
                break;
            case "uint32":
            case "fixed32": gen
                ("m%s=d%s>>>0", prop, prop);
                break;
            case "int32":
            case "sint32":
            case "sfixed32": gen
                ("m%s=d%s|0", prop, prop);
                break;
            case "uint64":
                isUnsigned = true;
                // eslint-disable-line no-fallthrough
            case "int64":
            case "sint64":
            case "fixed64":
            case "sfixed64": gen
                ("if(util.Long)")
                    ("(m%s=util.Long.fromValue(d%s)).unsigned=%j", prop, prop, isUnsigned)
                ("else if(typeof d%s===\"string\")", prop)
                    ("m%s=parseInt(d%s,10)", prop, prop)
                ("else if(typeof d%s===\"number\")", prop)
                    ("m%s=d%s", prop, prop)
                ("else if(typeof d%s===\"object\")", prop)
                    ("m%s=new util.LongBits(d%s.low>>>0,d%s.high>>>0).toNumber(%s)", prop, prop, prop, isUnsigned ? "true" : "");
                break;
            case "bytes": gen
                ("if(typeof d%s===\"string\")", prop)
                    ("util.base64.decode(d%s,m%s=util.newBuffer(util.base64.length(d%s)),0)", prop, prop, prop)
                ("else if(d%s.length)", prop)
                    ("m%s=d%s", prop, prop);
                break;
            case "string": gen
                ("m%s=String(d%s)", prop, prop);
                break;
            case "bool": gen
                ("m%s=Boolean(d%s)", prop, prop);
                break;
            /* default: gen
                ("m%s=d%s", prop, prop);
                break; */
        }
    }
    return gen;
    /* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */
}

/**
 * Generates a plain object to runtime message converter specific to the specified message type.
 * @param {Type} mtype Message type
 * @returns {Codegen} Codegen instance
 */
converter.fromObject = function fromObject(mtype) {
    /* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */
    var fields = mtype.fieldsArray;
    var gen = util.codegen("d")
    ("if(d instanceof this.ctor)")
        ("return d");
    if (!fields.length) return gen
    ("return new this.ctor");
    gen
    ("var m=new this.ctor");
    for (var i = 0; i < fields.length; ++i) {
        var field  = fields[i].resolve(),
            prop   = util.safeProp(field.name);

        // Map fields
        if (field.map) { gen
    ("if(d%s){", prop)
        ("if(typeof d%s!==\"object\")", prop)
            ("throw TypeError(%j)", field.fullName + ": object expected")
        ("m%s={}", prop)
        ("for(var ks=Object.keys(d%s),i=0;i<ks.length;++i){", prop);
            genValuePartial_fromObject(gen, field, i, prop + "[ks[i]]")
        ("}")
    ("}");

        // Repeated fields
        } else if (field.repeated) { gen
    ("if(d%s){", prop)
        ("if(!Array.isArray(d%s))", prop)
            ("throw TypeError(%j)", field.fullName + ": array expected")
        ("m%s=[]", prop)
        ("for(var i=0;i<d%s.length;++i){", prop);
            genValuePartial_fromObject(gen, field, i, prop + "[i]")
        ("}")
    ("}");

        // Non-repeated fields
        } else {
            if (!(field.resolvedType instanceof Enum)) gen // no need to test for null/undefined if an enum (uses switch)
    ("if(d%s!==undefined&&d%s!==null){", prop, prop);
        genValuePartial_fromObject(gen, field, i, prop);
            if (!(field.resolvedType instanceof Enum)) gen
    ("}");
        }
    } return gen
    ("return m");
    /* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */
};

/**
 * Generates a partial value toObject converter.
 * @param {Codegen} gen Codegen instance
 * @param {Field} field Reflected field
 * @param {number} fieldIndex Field index
 * @param {string} prop Property reference
 * @returns {Codegen} Codegen instance
 * @ignore
 */
function genValuePartial_toObject(gen, field, fieldIndex, prop) {
    /* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */
    if (field.resolvedType) {
        if (field.resolvedType instanceof Enum) gen
            ("d%s=o.enums===String?types[%d].values[m%s]:m%s", prop, fieldIndex, prop, prop);
        else gen
            ("d%s=types[%d].toObject(m%s,o)", prop, fieldIndex, prop);
    } else {
        var isUnsigned = false;
        switch (field.type) {
            case "uint64":
                isUnsigned = true;
                // eslint-disable-line no-fallthrough
            case "int64":
            case "sint64":
            case "fixed64":
            case "sfixed64": gen
            ("if(typeof m%s===\"number\")", prop)
                ("d%s=o.longs===String?String(m%s):m%s", prop, prop, prop)
            ("else") // Long-like
                ("d%s=o.longs===String?util.Long.prototype.toString.call(m%s):o.longs===Number?new util.LongBits(m%s.low>>>0,m%s.high>>>0).toNumber(%s):m%s", prop, prop, prop, prop, isUnsigned ? "true": "", prop);
                break;
            case "bytes": gen
            ("d%s=o.bytes===String?util.base64.encode(m%s,0,m%s.length):o.bytes===Array?Array.prototype.slice.call(m%s):m%s", prop, prop, prop, prop, prop);
                break;
            default: gen
            ("d%s=m%s", prop, prop);
                break;
        }
    }
    return gen;
    /* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */
}

/**
 * Generates a runtime message to plain object converter specific to the specified message type.
 * @param {Type} mtype Message type
 * @returns {Codegen} Codegen instance
 */
converter.toObject = function toObject(mtype) {
    /* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */
    var fields = mtype.fieldsArray;
    if (!fields.length)
        return util.codegen()("return {}");
    var gen = util.codegen("m", "o")
    ("if(!o)")
        ("o={}")
    ("var d={}");

    var repeatedFields = [],
        mapFields = [],
        otherFields = [],
        i = 0;
    for (; i < fields.length; ++i)
        if (fields[i].resolve().repeated)
            repeatedFields.push(fields[i]);
        else if (fields[i].map)
            mapFields.push(fields[i]);
        else
            otherFields.push(fields[i]);

    if (repeatedFields.length) { gen
    ("if(o.arrays||o.defaults){");
        for (i = 0; i < repeatedFields.length; ++i) gen
        ("d%s=[]", util.safeProp(repeatedFields[i].name));
        gen
    ("}");
    }

    if (mapFields.length) { gen
    ("if(o.objects||o.defaults){");
        for (i = 0; i < mapFields.length; ++i) gen
        ("d%s={}", util.safeProp(mapFields[i].name));
        gen
    ("}");
    }

    if (otherFields.length) { gen
    ("if(o.defaults){");
        for (i = 0, field; i < otherFields.length; ++i) {
            var field = otherFields[i],
                prop  = util.safeProp(field.name);
            if (field.resolvedType instanceof Enum) gen
        ("d%s=o.enums===String?%j:%j", prop, field.resolvedType.valuesById[field.typeDefault], field.typeDefault);
            else if (field.long) gen
        ("if(util.Long){")
            ("var n=new util.Long(%d,%d,%j)", field.typeDefault.low, field.typeDefault.high, field.typeDefault.unsigned)
            ("d%s=o.longs===String?n.toString():o.longs===Number?n.toNumber():n", prop)
        ("}else")
            ("d%s=o.longs===String?%j:%d", prop, field.typeDefault.toString(), field.typeDefault.toNumber());
            else if (field.bytes) gen
        ("d%s=o.bytes===String?%j:%s", prop, String.fromCharCode.apply(String, field.typeDefault), "[" + Array.prototype.slice.call(field.typeDefault).join(",") + "]");
            else gen
        ("d%s=%j", prop, field.typeDefault); // also messages (=null)
        } gen
    ("}");
    }
    for (i = 0, field; i < fields.length; ++i) {
        var field = fields[i],
            prop  = util.safeProp(field.name); gen
    ("if(m%s!==undefined&&m%s!==null&&m.hasOwnProperty(%j)){", prop, prop, field.name);
        if (field.map) { gen
        ("d%s={}", prop)
        ("for(var ks2=Object.keys(m%s),j=0;j<ks2.length;++j){", prop);
            genValuePartial_toObject(gen, field, i, prop + "[ks2[j]]")
        ("}");
        } else if (field.repeated) { gen
        ("d%s=[]", prop)
        ("for(var j=0;j<m%s.length;++j){", prop);
            genValuePartial_toObject(gen, field, i, prop + "[j]")
        ("}");
        } else
        genValuePartial_toObject(gen, field, i, prop);
        gen
    ("}");
    }
    return gen
    ("return d");
    /* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */
};

},{"./enum":16,"./util":37}],14:[function(require,module,exports){
"use strict";
module.exports = decoder;

decoder.compat = true;

var Enum    = require("./enum"),
    types   = require("./types"),
    util    = require("./util");

/**
 * Generates a decoder specific to the specified message type.
 * @param {Type} mtype Message type
 * @returns {Codegen} Codegen instance
 * @property {boolean} compat=true Generates backward/forward compatible decoders (packed fields)
 */
function decoder(mtype) {
    /* eslint-disable no-unexpected-multiline */
    var gen = util.codegen("r", "l")
    ("if(!(r instanceof Reader))")
        ("r=Reader.create(r)")
    ("var c=l===undefined?r.len:r.pos+l,m=new this.ctor")
    ("while(r.pos<c){")
        ("var t=r.uint32()");
    if (mtype.group) gen
        ("if((t&7)===4)")
            ("break");
    gen
        ("switch(t>>>3){");

    for (var i = 0; i < /* initializes */ mtype.fieldsArray.length; ++i) {
        var field = mtype._fieldsArray[i].resolve(),
            type  = field.resolvedType instanceof Enum ? "uint32" : field.type,
            ref   = "m" + util.safeProp(field.name); gen
            ("case %d:", field.id);

        // Map fields
        if (field.map) { gen

                ("r.skip().pos++") // assumes id 1 + key wireType
                ("if(%s===util.emptyObject)", ref)
                    ("%s={}", ref)
                ("var k=r.%s()", field.keyType)
                ("r.pos++"); // assumes id 2 + value wireType
            if (types.basic[type] === undefined) gen
                ("%s[typeof k===\"object\"?util.longToHash(k):k]=types[%d].decode(r,r.uint32())", ref, i); // can't be groups
            else gen
                ("%s[typeof k===\"object\"?util.longToHash(k):k]=r.%s()", ref, type);

        // Repeated fields
        } else if (field.repeated) { gen

                ("if(!(%s&&%s.length))", ref, ref)
                    ("%s=[]", ref);

            // Packable (always check for forward and backward compatiblity)
            if ((decoder.compat || field.packed) && types.packed[type] !== undefined) gen
                ("if((t&7)===2){")
                    ("var c2=r.uint32()+r.pos")
                    ("while(r.pos<c2)")
                        ("%s.push(r.%s())", ref, type)
                ("}else");

            // Non-packed
            if (types.basic[type] === undefined) gen(field.resolvedType.group
                    ? "%s.push(types[%d].decode(r))"
                    : "%s.push(types[%d].decode(r,r.uint32()))", ref, i);
            else gen
                    ("%s.push(r.%s())", ref, type);

        // Non-repeated
        } else if (types.basic[type] === undefined) gen(field.resolvedType.group
                ? "%s=types[%d].decode(r)"
                : "%s=types[%d].decode(r,r.uint32())", ref, i);
        else gen
                ("%s=r.%s()", ref, type);
        gen
                ("break");

    // Unknown fields
    } return gen
            ("default:")
                ("r.skipType(t&7)")
                ("break")

        ("}")
    ("}")
    ("return m");
    /* eslint-enable no-unexpected-multiline */
}

},{"./enum":16,"./types":36,"./util":37}],15:[function(require,module,exports){
"use strict";
module.exports = encoder;

var Enum     = require("./enum"),
    types    = require("./types"),
    util     = require("./util");

/**
 * Generates a partial message type encoder.
 * @param {Codegen} gen Codegen instance
 * @param {Field} field Reflected field
 * @param {number} fieldIndex Field index
 * @param {string} ref Variable reference
 * @returns {Codegen} Codegen instance
 * @ignore
 */
function genTypePartial(gen, field, fieldIndex, ref) {
    return field.resolvedType.group
        ? gen("types[%d].encode(%s,w.uint32(%d)).uint32(%d)", fieldIndex, ref, (field.id << 3 | 3) >>> 0, (field.id << 3 | 4) >>> 0)
        : gen("types[%d].encode(%s,w.uint32(%d).fork()).ldelim()", fieldIndex, ref, (field.id << 3 | 2) >>> 0);
}

/**
 * Generates an encoder specific to the specified message type.
 * @param {Type} mtype Message type
 * @returns {Codegen} Codegen instance
 */
function encoder(mtype) {
    /* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */
    var gen = util.codegen("m", "w")
    ("if(!w)")
        ("w=Writer.create()");

    var i, ref;
    for (var i = 0; i < /* initializes */ mtype.fieldsArray.length; ++i) {
        var field    = mtype._fieldsArray[i].resolve();
        if (field.partOf) // see below for oneofs
            continue;
        var type     = field.resolvedType instanceof Enum ? "uint32" : field.type,
            wireType = types.basic[type];
            ref      = "m" + util.safeProp(field.name);

        // Map fields
        if (field.map) {
            gen
    ("if(%s&&m.hasOwnProperty(%j)){", ref, field.name)
        ("for(var ks=Object.keys(%s),i=0;i<ks.length;++i){", ref)
            ("w.uint32(%d).fork().uint32(%d).%s(ks[i])", (field.id << 3 | 2) >>> 0, 8 | types.mapKey[field.keyType], field.keyType);
            if (wireType === undefined) gen
            ("types[%d].encode(%s[ks[i]],w.uint32(18).fork()).ldelim().ldelim()", i, ref); // can't be groups
            else gen
            (".uint32(%d).%s(%s[ks[i]]).ldelim()", 16 | wireType, type, ref);
            gen
        ("}")
    ("}");

        // Repeated fields
        } else if (field.repeated) {

            // Packed repeated
            if (field.packed && types.packed[type] !== undefined) { gen

    ("if(%s&&%s.length&&m.hasOwnProperty(%j)){", ref, ref, field.name)
        ("w.uint32(%d).fork()", (field.id << 3 | 2) >>> 0)
        ("for(var i=0;i<%s.length;++i)", ref)
            ("w.%s(%s[i])", type, ref)
        ("w.ldelim()")
    ("}");

            // Non-packed
            } else { gen

    ("if(%s!==undefined&&m.hasOwnProperty(%j)){", ref, field.name)
        ("for(var i=0;i<%s.length;++i)", ref);
                if (wireType === undefined)
            genTypePartial(gen, field, i, ref + "[i]");
                else gen
            ("w.uint32(%d).%s(%s[i])", (field.id << 3 | wireType) >>> 0, type, ref);
                gen
    ("}");

            }

        // Non-repeated
        } else {
            if (!field.required) {

                if (field.long) gen
    ("if(%s!==undefined&&%s!==null&&m.hasOwnProperty(%j))", ref, ref, field.name);
                else if (field.bytes || field.resolvedType && !(field.resolvedType instanceof Enum)) gen
    ("if(%s&&m.hasOwnProperty(%j))", ref, field.name);
                else gen
    ("if(%s!==undefined&&m.hasOwnProperty(%j))", ref, field.name);

            }

            if (wireType === undefined)
        genTypePartial(gen, field, i, ref);
            else gen
        ("w.uint32(%d).%s(%s)", (field.id << 3 | wireType) >>> 0, type, ref);

        }
    }

    // oneofs
    for (var i = 0; i < /* initializes */ mtype.oneofsArray.length; ++i) {
        var oneof = mtype._oneofsArray[i]; gen
        ("switch(%s){", "m" + util.safeProp(oneof.name));
        for (var j = 0; j < /* direct */ oneof.fieldsArray.length; ++j) {
            var field    = oneof.fieldsArray[j],
                type     = field.resolvedType instanceof Enum ? "uint32" : field.type,
                wireType = types.basic[type];
                ref      = "m" + util.safeProp(field.name); gen
            ("case%j:", field.name);
            if (wireType === undefined)
                genTypePartial(gen, field, mtype._fieldsArray.indexOf(field), ref);
            else gen
                ("w.uint32(%d).%s(%s)", (field.id << 3 | wireType) >>> 0, type, ref);
            gen
                ("break");
        } gen
        ("}");
    }
    
    return gen
    ("return w");
    /* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */
}
},{"./enum":16,"./types":36,"./util":37}],16:[function(require,module,exports){
"use strict";
module.exports = Enum;

// extends ReflectionObject
var ReflectionObject = require("./object");
((Enum.prototype = Object.create(ReflectionObject.prototype)).constructor = Enum).className = "Enum";

var util = require("./util");

/**
 * Constructs a new enum instance.
 * @classdesc Reflected enum.
 * @extends ReflectionObject
 * @constructor
 * @param {string} name Unique name within its namespace
 * @param {Object.<string,number>} [values] Enum values as an object, by name
 * @param {Object.<string,*>} [options] Declared options
 */
function Enum(name, values, options) {
    ReflectionObject.call(this, name, options);

    if (values && typeof values !== "object")
        throw TypeError("values must be an object");

    /**
     * Enum values by id.
     * @type {Object.<number,string>}
     */
    this.valuesById = {};

    /**
     * Enum values by name.
     * @type {Object.<string,number>}
     */
    this.values = Object.create(this.valuesById); // toJSON, marker

    /**
     * Value comment texts, if any.
     * @type {Object.<string,string>}
     */
    this.comments = {};

    // Note that values inherit valuesById on their prototype which makes them a TypeScript-
    // compatible enum. This is used by pbts to write actual enum definitions that work for
    // static and reflection code alike instead of emitting generic object definitions.

    if (values)
        for (var keys = Object.keys(values), i = 0; i < keys.length; ++i)
            this.valuesById[ this.values[keys[i]] = values[keys[i]] ] = keys[i];
}

/**
 * Creates an enum from JSON.
 * @param {string} name Enum name
 * @param {Object.<string,*>} json JSON object
 * @returns {Enum} Created enum
 * @throws {TypeError} If arguments are invalid
 */
Enum.fromJSON = function fromJSON(name, json) {
    return new Enum(name, json.values, json.options);
};

/**
 * @override
 */
Enum.prototype.toJSON = function toJSON() {
    return {
        options : this.options,
        values  : this.values
    };
};

/**
 * Adds a value to this enum.
 * @param {string} name Value name
 * @param {number} id Value id
 * @param {?string} comment Comment, if any
 * @returns {Enum} `this`
 * @throws {TypeError} If arguments are invalid
 * @throws {Error} If there is already a value with this name or id
 */
Enum.prototype.add = function(name, id, comment) {
    // utilized by the parser but not by .fromJSON

    if (!util.isString(name))
        throw TypeError("name must be a string");

    if (!util.isInteger(id))
        throw TypeError("id must be an integer");

    if (this.values[name] !== undefined)
        throw Error("duplicate name");

    if (this.valuesById[id] !== undefined) {
        if (!(this.options && this.options.allow_alias))
            throw Error("duplicate id");
        this.values[name] = id;
    } else
        this.valuesById[this.values[name] = id] = name;

    this.comments[name] = comment || null;
    return this;
};

/**
 * Removes a value from this enum
 * @param {string} name Value name
 * @returns {Enum} `this`
 * @throws {TypeError} If arguments are invalid
 * @throws {Error} If `name` is not a name of this enum
 */
Enum.prototype.remove = function(name) {

    if (!util.isString(name))
        throw TypeError("name must be a string");

    var val = this.values[name];
    if (val === undefined)
        throw Error("name does not exist");

    delete this.valuesById[val];
    delete this.values[name];
    delete this.comments[name];

    return this;
};

},{"./object":25,"./util":37}],17:[function(require,module,exports){
"use strict";
module.exports = Field;

// extends ReflectionObject
var ReflectionObject = require("./object");
((Field.prototype = Object.create(ReflectionObject.prototype)).constructor = Field).className = "Field";

var Enum  = require("./enum"),
    types = require("./types"),
    util  = require("./util");

var Type; // cyclic

/**
 * Constructs a new message field instance. Note that {@link MapField|map fields} have their own class.
 * @classdesc Reflected message field.
 * @extends ReflectionObject
 * @constructor
 * @param {string} name Unique name within its namespace
 * @param {number} id Unique id within its namespace
 * @param {string} type Value type
 * @param {string|Object.<string,*>} [rule="optional"] Field rule
 * @param {string|Object.<string,*>} [extend] Extended type if different from parent
 * @param {Object.<string,*>} [options] Declared options
 */
function Field(name, id, type, rule, extend, options) {

    if (util.isObject(rule)) {
        options = rule;
        rule = extend = undefined;
    } else if (util.isObject(extend)) {
        options = extend;
        extend = undefined;
    }

    ReflectionObject.call(this, name, options);

    if (!util.isInteger(id) || id < 0)
        throw TypeError("id must be a non-negative integer");

    if (!util.isString(type))
        throw TypeError("type must be a string");

    if (rule !== undefined && !/^required|optional|repeated$/.test(rule = rule.toString().toLowerCase()))
        throw TypeError("rule must be a string rule");

    if (extend !== undefined && !util.isString(extend))
        throw TypeError("extend must be a string");

    /**
     * Field rule, if any.
     * @type {string|undefined}
     */
    this.rule = rule && rule !== "optional" ? rule : undefined; // toJSON

    /**
     * Field type.
     * @type {string}
     */
    this.type = type; // toJSON

    /**
     * Unique field id.
     * @type {number}
     */
    this.id = id; // toJSON, marker

    /**
     * Extended type if different from parent.
     * @type {string|undefined}
     */
    this.extend = extend || undefined; // toJSON

    /**
     * Whether this field is required.
     * @type {boolean}
     */
    this.required = rule === "required";

    /**
     * Whether this field is optional.
     * @type {boolean}
     */
    this.optional = !this.required;

    /**
     * Whether this field is repeated.
     * @type {boolean}
     */
    this.repeated = rule === "repeated";

    /**
     * Whether this field is a map or not.
     * @type {boolean}
     */
    this.map = false;

    /**
     * Message this field belongs to.
     * @type {?Type}
     */
    this.message = null;

    /**
     * OneOf this field belongs to, if any,
     * @type {?OneOf}
     */
    this.partOf = null;

    /**
     * The field type's default value.
     * @type {*}
     */
    this.typeDefault = null;

    /**
     * The field's default value on prototypes.
     * @type {*}
     */
    this.defaultValue = null;

    /**
     * Whether this field's value should be treated as a long.
     * @type {boolean}
     */
    this.long = util.Long ? types.long[type] !== undefined : /* istanbul ignore next */ false;

    /**
     * Whether this field's value is a buffer.
     * @type {boolean}
     */
    this.bytes = type === "bytes";

    /**
     * Resolved type if not a basic type.
     * @type {?(Type|Enum)}
     */
    this.resolvedType = null;

    /**
     * Sister-field within the extended type if a declaring extension field.
     * @type {?Field}
     */
    this.extensionField = null;

    /**
     * Sister-field within the declaring namespace if an extended field.
     * @type {?Field}
     */
    this.declaringField = null;

    /**
     * Internally remembers whether this field is packed.
     * @type {?boolean}
     * @private
     */
    this._packed = null;
}

/**
 * Determines whether this field is packed. Only relevant when repeated and working with proto2.
 * @name Field#packed
 * @type {boolean}
 * @readonly
 */
Object.defineProperty(Field.prototype, "packed", {
    get: function() {
        // defaults to packed=true if not explicity set to false
        if (this._packed === null)
            this._packed = this.getOption("packed") !== false;
        return this._packed;
    }
});

/**
 * @override
 */
Field.prototype.setOption = function setOption(name, value, ifNotSet) {
    if (name === "packed") // clear cached before setting
        this._packed = null;
    return ReflectionObject.prototype.setOption.call(this, name, value, ifNotSet);
};

/**
 * Constructs a field from JSON.
 * @param {string} name Field name
 * @param {Object.<string,*>} json JSON object
 * @returns {Field} Created field
 * @throws {TypeError} If arguments are invalid
 */
Field.fromJSON = function fromJSON(name, json) {
    return new Field(name, json.id, json.type, json.rule, json.extend, json.options);
};

/**
 * @override
 */
Field.prototype.toJSON = function toJSON() {
    return {
        rule    : this.rule !== "optional" && this.rule || undefined,
        type    : this.type,
        id      : this.id,
        extend  : this.extend,
        options : this.options
    };
};

/**
 * Resolves this field's type references.
 * @returns {Field} `this`
 * @throws {Error} If any reference cannot be resolved
 */
Field.prototype.resolve = function resolve() {

    if (this.resolved)
        return this;

    if ((this.typeDefault = types.defaults[this.type]) === undefined) { // if not a basic type, resolve it

        /* istanbul ignore if */
        if (!Type)
            Type = require("./type");

        var scope = this.declaringField ? this.declaringField.parent : this.parent;
        if (this.resolvedType = scope.lookup(this.type, Type))
            this.typeDefault = null;
        else if (this.resolvedType = scope.lookup(this.type, Enum))
            this.typeDefault = this.resolvedType.values[Object.keys(this.resolvedType.values)[0]]; // first defined
        else
            throw Error("unresolvable field type: " + this.type + " in " + scope);
    }

    // use explicitly set default value if present
    if (this.options && this.options["default"] !== undefined) {
        this.typeDefault = this.options["default"];
        if (this.resolvedType instanceof Enum && typeof this.typeDefault === "string")
            this.typeDefault = this.resolvedType.values[this.typeDefault];
    }

    // remove unnecessary packed option (parser adds this) if not referencing an enum
    if (this.options && this.options.packed !== undefined && this.resolvedType && !(this.resolvedType instanceof Enum))
        delete this.options.packed;

    // convert to internal data type if necesssary
    if (this.long) {
        this.typeDefault = util.Long.fromNumber(this.typeDefault, this.type.charAt(0) === "u");

        /* istanbul ignore else */
        if (Object.freeze)
            Object.freeze(this.typeDefault); // long instances are meant to be immutable anyway (i.e. use small int cache that even requires it)

    } else if (this.bytes && typeof this.typeDefault === "string") {
        var buf;
        if (util.base64.test(this.typeDefault))
            util.base64.decode(this.typeDefault, buf = util.newBuffer(util.base64.length(this.typeDefault)), 0);
        else
            util.utf8.write(this.typeDefault, buf = util.newBuffer(util.utf8.length(this.typeDefault)), 0);
        this.typeDefault = buf;
    }

    // take special care of maps and repeated fields
    if (this.map)
        this.defaultValue = util.emptyObject;
    else if (this.repeated)
        this.defaultValue = util.emptyArray;
    else
        this.defaultValue = this.typeDefault;

    return ReflectionObject.prototype.resolve.call(this);
};

},{"./enum":16,"./object":25,"./type":35,"./types":36,"./util":37}],18:[function(require,module,exports){
"use strict";
var protobuf = module.exports = require("./index-minimal");

protobuf.build = "light";

/**
 * A node-style callback as used by {@link load} and {@link Root#load}.
 * @typedef LoadCallback
 * @type {function}
 * @param {?Error} error Error, if any, otherwise `null`
 * @param {Root} [root] Root, if there hasn't been an error
 * @returns {undefined}
 */

/**
 * Loads one or multiple .proto or preprocessed .json files into a common root namespace and calls the callback.
 * @param {string|string[]} filename One or multiple files to load
 * @param {Root} root Root namespace, defaults to create a new one if omitted.
 * @param {LoadCallback} callback Callback function
 * @returns {undefined}
 * @see {@link Root#load}
 */
function load(filename, root, callback) {
    if (typeof root === "function") {
        callback = root;
        root = new protobuf.Root();
    } else if (!root)
        root = new protobuf.Root();
    return root.load(filename, callback);
}

/**
 * Loads one or multiple .proto or preprocessed .json files into a common root namespace and calls the callback.
 * @name load
 * @function
 * @param {string|string[]} filename One or multiple files to load
 * @param {LoadCallback} callback Callback function
 * @returns {undefined}
 * @see {@link Root#load}
 * @variation 2
 */
// function load(filename:string, callback:LoadCallback):undefined

/**
 * Loads one or multiple .proto or preprocessed .json files into a common root namespace and returns a promise.
 * @name load
 * @function
 * @param {string|string[]} filename One or multiple files to load
 * @param {Root} [root] Root namespace, defaults to create a new one if omitted.
 * @returns {Promise<Root>} Promise
 * @see {@link Root#load}
 * @variation 3
 */
// function load(filename:string, [root:Root]):Promise<Root>

protobuf.load = load;

/**
 * Synchronously loads one or multiple .proto or preprocessed .json files into a common root namespace (node only).
 * @param {string|string[]} filename One or multiple files to load
 * @param {Root} [root] Root namespace, defaults to create a new one if omitted.
 * @returns {Root} Root namespace
 * @throws {Error} If synchronous fetching is not supported (i.e. in browsers) or if a file's syntax is invalid
 * @see {@link Root#loadSync}
 */
function loadSync(filename, root) {
    if (!root)
        root = new protobuf.Root();
    return root.loadSync(filename);
}

protobuf.loadSync = loadSync;

// Serialization
protobuf.encoder          = require("./encoder");
protobuf.decoder          = require("./decoder");
protobuf.verifier         = require("./verifier");
protobuf.converter        = require("./converter");

// Reflection
protobuf.ReflectionObject = require("./object");
protobuf.Namespace        = require("./namespace");
protobuf.Root             = require("./root");
protobuf.Enum             = require("./enum");
protobuf.Type             = require("./type");
protobuf.Field            = require("./field");
protobuf.OneOf            = require("./oneof");
protobuf.MapField         = require("./mapfield");
protobuf.Service          = require("./service");
protobuf.Method           = require("./method");

// Runtime
protobuf.Class            = require("./class");
protobuf.Message          = require("./message");

// Utility
protobuf.types            = require("./types");
protobuf.util             = require("./util");

// Configure reflection
protobuf.ReflectionObject._configure(protobuf.Root);
protobuf.Namespace._configure(protobuf.Type, protobuf.Service);
protobuf.Root._configure(protobuf.Type);

},{"./class":11,"./converter":13,"./decoder":14,"./encoder":15,"./enum":16,"./field":17,"./index-minimal":19,"./mapfield":21,"./message":22,"./method":23,"./namespace":24,"./object":25,"./oneof":26,"./root":30,"./service":33,"./type":35,"./types":36,"./util":37,"./verifier":40}],19:[function(require,module,exports){
"use strict";
var protobuf = exports;

/**
 * Build type, one of `"full"`, `"light"` or `"minimal"`.
 * @name build
 * @type {string}
 */
protobuf.build = "minimal";

/**
 * Named roots.
 * This is where pbjs stores generated structures (the option `-r, --root` specifies a name).
 * Can also be used manually to make roots available accross modules.
 * @name roots
 * @type {Object.<string,Root>}
 * @example
 * // pbjs -r myroot -o compiled.js ...
 * 
 * // in another module:
 * require("./compiled.js");
 * 
 * // in any subsequent module:
 * var root = protobuf.roots["myroot"];
 */
protobuf.roots = {};

// Serialization
protobuf.Writer       = require("./writer");
protobuf.BufferWriter = require("./writer_buffer");
protobuf.Reader       = require("./reader");
protobuf.BufferReader = require("./reader_buffer");

// Utility
protobuf.util         = require("./util/minimal");
protobuf.rpc          = require("./rpc");
protobuf.configure    = configure;

/* istanbul ignore next */
/**
 * Reconfigures the library according to the environment.
 * @returns {undefined}
 */
function configure() {
    protobuf.Reader._configure(protobuf.BufferReader);
    protobuf.util._configure();
}

// Configure serialization
protobuf.Writer._configure(protobuf.BufferWriter);
configure();

},{"./reader":28,"./reader_buffer":29,"./rpc":31,"./util/minimal":39,"./writer":41,"./writer_buffer":42}],20:[function(require,module,exports){
"use strict";
var protobuf = module.exports = require("./index-light");

protobuf.build = "full";

// Parser
protobuf.tokenize         = require("./tokenize");
protobuf.parse            = require("./parse");
protobuf.common           = require("./common");

// Configure parser
protobuf.Root._configure(protobuf.Type, protobuf.parse, protobuf.common);

},{"./common":12,"./index-light":18,"./parse":27,"./tokenize":34}],21:[function(require,module,exports){
"use strict";
module.exports = MapField;

// extends Field
var Field = require("./field");
((MapField.prototype = Object.create(Field.prototype)).constructor = MapField).className = "MapField";

var types   = require("./types"),
    util    = require("./util");

/**
 * Constructs a new map field instance.
 * @classdesc Reflected map field.
 * @extends Field
 * @constructor
 * @param {string} name Unique name within its namespace
 * @param {number} id Unique id within its namespace
 * @param {string} keyType Key type
 * @param {string} type Value type
 * @param {Object.<string,*>} [options] Declared options
 */
function MapField(name, id, keyType, type, options) {
    Field.call(this, name, id, type, options);

    /* istanbul ignore next */
    if (!util.isString(keyType))
        throw TypeError("keyType must be a string");

    /**
     * Key type.
     * @type {string}
     */
    this.keyType = keyType; // toJSON, marker

    /**
     * Resolved key type if not a basic type.
     * @type {?ReflectionObject}
     */
    this.resolvedKeyType = null;

    // Overrides Field#map
    this.map = true;
}

/**
 * Constructs a map field from JSON.
 * @param {string} name Field name
 * @param {Object.<string,*>} json JSON object
 * @returns {MapField} Created map field
 * @throws {TypeError} If arguments are invalid
 */
MapField.fromJSON = function fromJSON(name, json) {
    return new MapField(name, json.id, json.keyType, json.type, json.options);
};

/**
 * @override
 */
MapField.prototype.toJSON = function toJSON() {
    return {
        keyType : this.keyType,
        type    : this.type,
        id      : this.id,
        extend  : this.extend,
        options : this.options
    };
};

/**
 * @override
 */
MapField.prototype.resolve = function resolve() {
    if (this.resolved)
        return this;

    // Besides a value type, map fields have a key type that may be "any scalar type except for floating point types and bytes"
    if (types.mapKey[this.keyType] === undefined)
        throw Error("invalid key type: " + this.keyType);

    return Field.prototype.resolve.call(this);
};

},{"./field":17,"./types":36,"./util":37}],22:[function(require,module,exports){
"use strict";
module.exports = Message;

var util = require("./util");

/**
 * Constructs a new message instance.
 *
 * This function should also be called from your custom constructors, i.e. `Message.call(this, properties)`.
 * @classdesc Abstract runtime message.
 * @constructor
 * @param {Object.<string,*>} [properties] Properties to set
 * @see {@link Class.create}
 */
function Message(properties) {
    if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
            this[keys[i]] = properties[keys[i]];
}

/**
 * Reference to the reflected type.
 * @name Message.$type
 * @type {Type}
 * @readonly
 */

/**
 * Reference to the reflected type.
 * @name Message#$type
 * @type {Type}
 * @readonly
 */

/**
 * Encodes a message of this type.
 * @param {Message|Object} message Message to encode
 * @param {Writer} [writer] Writer to use
 * @returns {Writer} Writer
 */
Message.encode = function encode(message, writer) {
    return this.$type.encode(message, writer);
};

/**
 * Encodes a message of this type preceeded by its length as a varint.
 * @param {Message|Object} message Message to encode
 * @param {Writer} [writer] Writer to use
 * @returns {Writer} Writer
 */
Message.encodeDelimited = function encodeDelimited(message, writer) {
    return this.$type.encodeDelimited(message, writer);
};

/**
 * Decodes a message of this type.
 * @name Message.decode
 * @function
 * @param {Reader|Uint8Array} reader Reader or buffer to decode
 * @returns {Message} Decoded message
 */
Message.decode = function decode(reader) {
    return this.$type.decode(reader);
};

/**
 * Decodes a message of this type preceeded by its length as a varint.
 * @name Message.decodeDelimited
 * @function
 * @param {Reader|Uint8Array} reader Reader or buffer to decode
 * @returns {Message} Decoded message
 */
Message.decodeDelimited = function decodeDelimited(reader) {
    return this.$type.decodeDelimited(reader);
};

/**
 * Verifies a message of this type.
 * @name Message.verify
 * @function
 * @param {Message|Object} message Message or plain object to verify
 * @returns {?string} `null` if valid, otherwise the reason why it is not
 */
Message.verify = function verify(message) {
    return this.$type.verify(message);
};

/**
 * Creates a new message of this type from a plain object. Also converts values to their respective internal types.
 * @param {Object.<string,*>} object Plain object
 * @returns {Message} Message instance
 */
Message.fromObject = function fromObject(object) {
    return this.$type.fromObject(object);
};

/**
 * Creates a new message of this type from a plain object. Also converts values to their respective internal types.
 * This is an alias of {@link Message.fromObject}.
 * @function
 * @param {Object.<string,*>} object Plain object
 * @returns {Message} Message instance
 */
Message.from = Message.fromObject;

/**
 * Creates a plain object from a message of this type. Also converts values to other types if specified.
 * @param {Message} message Message instance
 * @param {ConversionOptions} [options] Conversion options
 * @returns {Object.<string,*>} Plain object
 */
Message.toObject = function toObject(message, options) {
    return this.$type.toObject(message, options);
};

/**
 * Creates a plain object from this message. Also converts values to other types if specified.
 * @param {ConversionOptions} [options] Conversion options
 * @returns {Object.<string,*>} Plain object
 */
Message.prototype.toObject = function toObject(options) {
    return this.$type.toObject(this, options);
};

/**
 * Converts this message to JSON.
 * @returns {Object.<string,*>} JSON object
 */
Message.prototype.toJSON = function toJSON() {
    return this.$type.toObject(this, util.toJSONOptions);
};

},{"./util":37}],23:[function(require,module,exports){
"use strict";
module.exports = Method;

// extends ReflectionObject
var ReflectionObject = require("./object");
((Method.prototype = Object.create(ReflectionObject.prototype)).constructor = Method).className = "Method";

var util = require("./util");

/**
 * Constructs a new service method instance.
 * @classdesc Reflected service method.
 * @extends ReflectionObject
 * @constructor
 * @param {string} name Method name
 * @param {string|undefined} type Method type, usually `"rpc"`
 * @param {string} requestType Request message type
 * @param {string} responseType Response message type
 * @param {boolean|Object.<string,*>} [requestStream] Whether the request is streamed
 * @param {boolean|Object.<string,*>} [responseStream] Whether the response is streamed
 * @param {Object.<string,*>} [options] Declared options
 */
function Method(name, type, requestType, responseType, requestStream, responseStream, options) {

    /* istanbul ignore next */
    if (util.isObject(requestStream)) {
        options = requestStream;
        requestStream = responseStream = undefined;
    /* istanbul ignore next */
    } else if (util.isObject(responseStream)) {
        options = responseStream;
        responseStream = undefined;
    }

    /* istanbul ignore next */
    if (!(type === undefined || util.isString(type)))
        throw TypeError("type must be a string");
    /* istanbul ignore next */
    if (!util.isString(requestType))
        throw TypeError("requestType must be a string");
    /* istanbul ignore next */
    if (!util.isString(responseType))
        throw TypeError("responseType must be a string");

    ReflectionObject.call(this, name, options);

    /**
     * Method type.
     * @type {string}
     */
    this.type = type || "rpc"; // toJSON

    /**
     * Request type.
     * @type {string}
     */
    this.requestType = requestType; // toJSON, marker

    /**
     * Whether requests are streamed or not.
     * @type {boolean|undefined}
     */
    this.requestStream = requestStream ? true : undefined; // toJSON

    /**
     * Response type.
     * @type {string}
     */
    this.responseType = responseType; // toJSON

    /**
     * Whether responses are streamed or not.
     * @type {boolean|undefined}
     */
    this.responseStream = responseStream ? true : undefined; // toJSON

    /**
     * Resolved request type.
     * @type {?Type}
     */
    this.resolvedRequestType = null;

    /**
     * Resolved response type.
     * @type {?Type}
     */
    this.resolvedResponseType = null;
}

/**
 * Constructs a service method from JSON.
 * @param {string} name Method name
 * @param {Object.<string,*>} json JSON object
 * @returns {Method} Created method
 * @throws {TypeError} If arguments are invalid
 */
Method.fromJSON = function fromJSON(name, json) {
    return new Method(name, json.type, json.requestType, json.responseType, json.requestStream, json.responseStream, json.options);
};

/**
 * @override
 */
Method.prototype.toJSON = function toJSON() {
    return {
        type           : this.type !== "rpc" && /* istanbul ignore next */ this.type || undefined,
        requestType    : this.requestType,
        requestStream  : this.requestStream,
        responseType   : this.responseType,
        responseStream : this.responseStream,
        options        : this.options
    };
};

/**
 * @override
 */
Method.prototype.resolve = function resolve() {

    /* istanbul ignore if */
    if (this.resolved)
        return this;

    this.resolvedRequestType = this.parent.lookupType(this.requestType);
    this.resolvedResponseType = this.parent.lookupType(this.responseType);

    return ReflectionObject.prototype.resolve.call(this);
};

},{"./object":25,"./util":37}],24:[function(require,module,exports){
"use strict";
module.exports = Namespace;

// extends ReflectionObject
var ReflectionObject = require("./object");
((Namespace.prototype = Object.create(ReflectionObject.prototype)).constructor = Namespace).className = "Namespace";

var Enum     = require("./enum"),
    Field    = require("./field"),
    util     = require("./util");

var Type,    // cyclic
    Service; // "

/**
 * Constructs a new namespace instance.
 * @name Namespace
 * @classdesc Reflected namespace.
 * @extends NamespaceBase
 * @constructor
 * @param {string} name Namespace name
 * @param {Object.<string,*>} [options] Declared options
 */

/**
 * Constructs a namespace from JSON.
 * @memberof Namespace
 * @function
 * @param {string} name Namespace name
 * @param {Object.<string,*>} json JSON object
 * @returns {Namespace} Created namespace
 * @throws {TypeError} If arguments are invalid
 */
Namespace.fromJSON = function fromJSON(name, json) {
    return new Namespace(name, json.options).addJSON(json.nested);
};

/**
 * Converts an array of reflection objects to JSON.
 * @memberof Namespace
 * @param {ReflectionObject[]} array Object array
 * @returns {Object.<string,*>|undefined} JSON object or `undefined` when array is empty
 */
function arrayToJSON(array) {
    if (!(array && array.length))
        return undefined;
    var obj = {};
    for (var i = 0; i < array.length; ++i)
        obj[array[i].name] = array[i].toJSON();
    return obj;
}

Namespace.arrayToJSON = arrayToJSON;

/**
 * Not an actual constructor. Use {@link Namespace} instead.
 * @classdesc Base class of all reflection objects containing nested objects. This is not an actual class but here for the sake of having consistent type definitions.
 * @exports NamespaceBase
 * @extends ReflectionObject
 * @abstract
 * @constructor
 * @param {string} name Namespace name
 * @param {Object.<string,*>} [options] Declared options
 * @see {@link Namespace}
 */
function Namespace(name, options) {
    ReflectionObject.call(this, name, options);

    /**
     * Nested objects by name.
     * @type {Object.<string,ReflectionObject>|undefined}
     */
    this.nested = undefined; // toJSON

    /**
     * Cached nested objects as an array.
     * @type {?ReflectionObject[]}
     * @private
     */
    this._nestedArray = null;
}

function clearCache(namespace) {
    namespace._nestedArray = null;
    return namespace;
}

/**
 * Nested objects of this namespace as an array for iteration.
 * @name NamespaceBase#nestedArray
 * @type {ReflectionObject[]}
 * @readonly
 */
Object.defineProperty(Namespace.prototype, "nestedArray", {
    get: function() {
        return this._nestedArray || (this._nestedArray = util.toArray(this.nested));
    }
});

/**
 * @override
 */
Namespace.prototype.toJSON = function toJSON() {
    return {
        options : this.options,
        nested  : arrayToJSON(this.nestedArray)
    };
};

/**
 * Adds nested elements to this namespace from JSON.
 * @param {Object.<string,*>} nestedJson Nested JSON
 * @returns {Namespace} `this`
 */
Namespace.prototype.addJSON = function addJSON(nestedJson) {
    var ns = this;
    /* istanbul ignore else */
    if (nestedJson) {
        for (var names = Object.keys(nestedJson), i = 0, nested; i < names.length; ++i) {
            nested = nestedJson[names[i]];
            ns.add( // most to least likely
                ( nested.fields !== undefined
                ? Type.fromJSON
                : nested.values !== undefined
                ? Enum.fromJSON
                : nested.methods !== undefined
                ? Service.fromJSON
                : nested.id !== undefined
                ? Field.fromJSON
                : Namespace.fromJSON )(names[i], nested)
            );
        }
    }
    return this;
};

/**
 * Gets the nested object of the specified name.
 * @param {string} name Nested object name
 * @returns {?ReflectionObject} The reflection object or `null` if it doesn't exist
 */
Namespace.prototype.get = function get(name) {
    return this.nested && this.nested[name]
        || null;
};

/**
 * Gets the values of the nested {@link Enum|enum} of the specified name.
 * This methods differs from {@link Namespace#get|get} in that it returns an enum's values directly and throws instead of returning `null`.
 * @param {string} name Nested enum name
 * @returns {Object.<string,number>} Enum values
 * @throws {Error} If there is no such enum
 */
Namespace.prototype.getEnum = function getEnum(name) {
    if (this.nested && this.nested[name] instanceof Enum)
        return this.nested[name].values;
    throw Error("no such enum");
};

/**
 * Adds a nested object to this namespace.
 * @param {ReflectionObject} object Nested object to add
 * @returns {Namespace} `this`
 * @throws {TypeError} If arguments are invalid
 * @throws {Error} If there is already a nested object with this name
 */
Namespace.prototype.add = function add(object) {

    if (!(object instanceof Field && object.extend !== undefined || object instanceof Type || object instanceof Enum || object instanceof Service || object instanceof Namespace))
        throw TypeError("object must be a valid nested object");

    if (!this.nested)
        this.nested = {};
    else {
        var prev = this.get(object.name);
        if (prev) {
            if (prev instanceof Namespace && object instanceof Namespace && !(prev instanceof Type || prev instanceof Service)) {
                // replace plain namespace but keep existing nested elements and options
                var nested = prev.nestedArray;
                for (var i = 0; i < nested.length; ++i)
                    object.add(nested[i]);
                this.remove(prev);
                if (!this.nested)
                    this.nested = {};
                object.setOptions(prev.options, true);

            } else
                throw Error("duplicate name '" + object.name + "' in " + this);
        }
    }
    this.nested[object.name] = object;
    object.onAdd(this);
    return clearCache(this);
};

/**
 * Removes a nested object from this namespace.
 * @param {ReflectionObject} object Nested object to remove
 * @returns {Namespace} `this`
 * @throws {TypeError} If arguments are invalid
 * @throws {Error} If `object` is not a member of this namespace
 */
Namespace.prototype.remove = function remove(object) {

    if (!(object instanceof ReflectionObject))
        throw TypeError("object must be a ReflectionObject");
    if (object.parent !== this)
        throw Error(object + " is not a member of " + this);

    delete this.nested[object.name];
    if (!Object.keys(this.nested).length)
        this.nested = undefined;

    object.onRemove(this);
    return clearCache(this);
};

/**
 * Defines additial namespaces within this one if not yet existing.
 * @param {string|string[]} path Path to create
 * @param {*} [json] Nested types to create from JSON
 * @returns {Namespace} Pointer to the last namespace created or `this` if path is empty
 */
Namespace.prototype.define = function define(path, json) {

    if (util.isString(path))
        path = path.split(".");
    else if (!Array.isArray(path))
        throw TypeError("illegal path");
    if (path && path.length && path[0] === "")
        throw Error("path must be relative");

    var ptr = this;
    while (path.length > 0) {
        var part = path.shift();
        if (ptr.nested && ptr.nested[part]) {
            ptr = ptr.nested[part];
            if (!(ptr instanceof Namespace))
                throw Error("path conflicts with non-namespace objects");
        } else
            ptr.add(ptr = new Namespace(part));
    }
    if (json)
        ptr.addJSON(json);
    return ptr;
};

/**
 * Resolves this namespace's and all its nested objects' type references. Useful to validate a reflection tree, but comes at a cost.
 * @returns {Namespace} `this`
 */
Namespace.prototype.resolveAll = function resolveAll() {
    var nested = this.nestedArray, i = 0;
    while (i < nested.length)
        if (nested[i] instanceof Namespace)
            nested[i++].resolveAll();
        else
            nested[i++].resolve();
    return this.resolve();
};

/**
 * Looks up the reflection object at the specified path, relative to this namespace.
 * @param {string|string[]} path Path to look up
 * @param {function(new: ReflectionObject)} filterType Filter type, one of `protobuf.Type`, `protobuf.Enum`, `protobuf.Service` etc.
 * @param {boolean} [parentAlreadyChecked=false] If known, whether the parent has already been checked
 * @returns {?ReflectionObject} Looked up object or `null` if none could be found
 */
Namespace.prototype.lookup = function lookup(path, filterType, parentAlreadyChecked) {

    /* istanbul ignore next */
    if (typeof filterType === "boolean") {
        parentAlreadyChecked = filterType;
        filterType = undefined;
    }

    if (util.isString(path) && path.length) {
        if (path === ".")
            return this.root;
        path = path.split(".");
    } else if (!path.length)
        return this;

    // Start at root if path is absolute
    if (path[0] === "")
        return this.root.lookup(path.slice(1), filterType);
    // Test if the first part matches any nested object, and if so, traverse if path contains more
    var found = this.get(path[0]);
    if (found) {
        if (path.length === 1) {
            if (!filterType || found instanceof filterType)
                return found;
        } else if (found instanceof Namespace && (found = found.lookup(path.slice(1), filterType, true)))
            return found;
    }
    // If there hasn't been a match, try again at the parent
    if (this.parent === null || parentAlreadyChecked)
        return null;
    return this.parent.lookup(path, filterType);
};

/**
 * Looks up the reflection object at the specified path, relative to this namespace.
 * @name NamespaceBase#lookup
 * @function
 * @param {string|string[]} path Path to look up
 * @param {boolean} [parentAlreadyChecked=false] Whether the parent has already been checked
 * @returns {?ReflectionObject} Looked up object or `null` if none could be found
 * @variation 2
 */
// lookup(path: string, [parentAlreadyChecked: boolean])

/**
 * Looks up the {@link Type|type} at the specified path, relative to this namespace.
 * Besides its signature, this methods differs from {@link Namespace#lookup|lookup} in that it throws instead of returning `null`.
 * @param {string|string[]} path Path to look up
 * @returns {Type} Looked up type
 * @throws {Error} If `path` does not point to a type
 */
Namespace.prototype.lookupType = function lookupType(path) {
    var found = this.lookup(path, Type);
    if (!found)
        throw Error("no such type");
    return found;
};

/**
 * Looks up the {@link Service|service} at the specified path, relative to this namespace.
 * Besides its signature, this methods differs from {@link Namespace#lookup|lookup} in that it throws instead of returning `null`.
 * @param {string|string[]} path Path to look up
 * @returns {Service} Looked up service
 * @throws {Error} If `path` does not point to a service
 */
Namespace.prototype.lookupService = function lookupService(path) {
    var found = this.lookup(path, Service);
    if (!found)
        throw Error("no such service");
    return found;
};

/**
 * Looks up the values of the {@link Enum|enum} at the specified path, relative to this namespace.
 * Besides its signature, this methods differs from {@link Namespace#lookup|lookup} in that it returns the enum's values directly and throws instead of returning `null`.
 * @param {string|string[]} path Path to look up
 * @returns {Object.<string,number>} Enum values
 * @throws {Error} If `path` does not point to an enum
 */
Namespace.prototype.lookupEnum = function lookupEnum(path) {
    var found = this.lookup(path, Enum);
    if (!found)
        throw Error("no such enum");
    return found.values;
};

Namespace._configure = function(Type_, Service_) {
    Type    = Type_;
    Service = Service_;
};

},{"./enum":16,"./field":17,"./object":25,"./util":37}],25:[function(require,module,exports){
"use strict";
module.exports = ReflectionObject;

ReflectionObject.className = "ReflectionObject";

var util = require("./util");

var Root; // cyclic

/**
 * Constructs a new reflection object instance.
 * @classdesc Base class of all reflection objects.
 * @constructor
 * @param {string} name Object name
 * @param {Object.<string,*>} [options] Declared options
 * @abstract
 */
function ReflectionObject(name, options) {

    if (!util.isString(name))
        throw TypeError("name must be a string");

    if (options && !util.isObject(options))
        throw TypeError("options must be an object");

    /**
     * Options.
     * @type {Object.<string,*>|undefined}
     */
    this.options = options; // toJSON

    /**
     * Unique name within its namespace.
     * @type {string}
     */
    this.name = name;

    /**
     * Parent namespace.
     * @type {?Namespace}
     */
    this.parent = null;

    /**
     * Whether already resolved or not.
     * @type {boolean}
     */
    this.resolved = false;

    /**
     * Comment text, if any.
     * @type {?string}
     */
    this.comment = null;

    /**
     * Defining file name.
     * @type {?string}
     */
    this.filename = null;
}

Object.defineProperties(ReflectionObject.prototype, {

    /**
     * Reference to the root namespace.
     * @name ReflectionObject#root
     * @type {Root}
     * @readonly
     */
    root: {
        get: function() {
            var ptr = this;
            while (ptr.parent !== null)
                ptr = ptr.parent;
            return ptr;
        }
    },

    /**
     * Full name including leading dot.
     * @name ReflectionObject#fullName
     * @type {string}
     * @readonly
     */
    fullName: {
        get: function() {
            var path = [ this.name ],
                ptr = this.parent;
            while (ptr) {
                path.unshift(ptr.name);
                ptr = ptr.parent;
            }
            return path.join(".");
        }
    }
});

/**
 * Converts this reflection object to its JSON representation.
 * @returns {Object.<string,*>} JSON object
 * @abstract
 */
ReflectionObject.prototype.toJSON = /* istanbul ignore next */ function toJSON() {
    throw Error(); // not implemented, shouldn't happen
};

/**
 * Called when this object is added to a parent.
 * @param {ReflectionObject} parent Parent added to
 * @returns {undefined}
 */
ReflectionObject.prototype.onAdd = function onAdd(parent) {
    if (this.parent && this.parent !== parent)
        this.parent.remove(this);
    this.parent = parent;
    this.resolved = false;
    var root = parent.root;
    if (root instanceof Root)
        root._handleAdd(this);
};

/**
 * Called when this object is removed from a parent.
 * @param {ReflectionObject} parent Parent removed from
 * @returns {undefined}
 */
ReflectionObject.prototype.onRemove = function onRemove(parent) {
    var root = parent.root;
    if (root instanceof Root)
        root._handleRemove(this);
    this.parent = null;
    this.resolved = false;
};

/**
 * Resolves this objects type references.
 * @returns {ReflectionObject} `this`
 */
ReflectionObject.prototype.resolve = function resolve() {
    if (this.resolved)
        return this;
    if (this.root instanceof Root)
        this.resolved = true; // only if part of a root
    return this;
};

/**
 * Gets an option value.
 * @param {string} name Option name
 * @returns {*} Option value or `undefined` if not set
 */
ReflectionObject.prototype.getOption = function getOption(name) {
    if (this.options)
        return this.options[name];
    return undefined;
};

/**
 * Sets an option.
 * @param {string} name Option name
 * @param {*} value Option value
 * @param {boolean} [ifNotSet] Sets the option only if it isn't currently set
 * @returns {ReflectionObject} `this`
 */
ReflectionObject.prototype.setOption = function setOption(name, value, ifNotSet) {
    if (!ifNotSet || !this.options || this.options[name] === undefined)
        (this.options || (this.options = {}))[name] = value;
    return this;
};

/**
 * Sets multiple options.
 * @param {Object.<string,*>} options Options to set
 * @param {boolean} [ifNotSet] Sets an option only if it isn't currently set
 * @returns {ReflectionObject} `this`
 */
ReflectionObject.prototype.setOptions = function setOptions(options, ifNotSet) {
    if (options)
        for (var keys = Object.keys(options), i = 0; i < keys.length; ++i)
            this.setOption(keys[i], options[keys[i]], ifNotSet);
    return this;
};

/**
 * Converts this instance to its string representation.
 * @returns {string} Class name[, space, full name]
 */
ReflectionObject.prototype.toString = function toString() {
    var className = this.constructor.className,
        fullName  = this.fullName;
    if (fullName.length)
        return className + " " + fullName;
    return className;
};

ReflectionObject._configure = function(Root_) {
    Root = Root_;
};

},{"./util":37}],26:[function(require,module,exports){
"use strict";
module.exports = OneOf;

// extends ReflectionObject
var ReflectionObject = require("./object");
((OneOf.prototype = Object.create(ReflectionObject.prototype)).constructor = OneOf).className = "OneOf";

var Field = require("./field");

/**
 * Constructs a new oneof instance.
 * @classdesc Reflected oneof.
 * @extends ReflectionObject
 * @constructor
 * @param {string} name Oneof name
 * @param {string[]|Object} [fieldNames] Field names
 * @param {Object.<string,*>} [options] Declared options
 */
function OneOf(name, fieldNames, options) {
    if (!Array.isArray(fieldNames)) {
        options = fieldNames;
        fieldNames = undefined;
    }
    ReflectionObject.call(this, name, options);

    /* istanbul ignore next */
    if (!(fieldNames === undefined || Array.isArray(fieldNames)))
        throw TypeError("fieldNames must be an Array");

    /**
     * Field names that belong to this oneof.
     * @type {string[]}
     */
    this.oneof = fieldNames || []; // toJSON, marker

    /**
     * Fields that belong to this oneof as an array for iteration.
     * @type {Field[]}
     * @readonly
     */
    this.fieldsArray = []; // declared readonly for conformance, possibly not yet added to parent
}

/**
 * Constructs a oneof from JSON.
 * @param {string} name Oneof name
 * @param {Object.<string,*>} json JSON object
 * @returns {MapField} Created oneof
 * @throws {TypeError} If arguments are invalid
 */
OneOf.fromJSON = function fromJSON(name, json) {
    return new OneOf(name, json.oneof, json.options);
};

/**
 * @override
 */
OneOf.prototype.toJSON = function toJSON() {
    return {
        oneof   : this.oneof,
        options : this.options
    };
};

/**
 * Adds the fields of the specified oneof to the parent if not already done so.
 * @param {OneOf} oneof The oneof
 * @returns {undefined}
 * @inner
 * @ignore
 */
function addFieldsToParent(oneof) {
    if (oneof.parent)
        for (var i = 0; i < oneof.fieldsArray.length; ++i)
            if (!oneof.fieldsArray[i].parent)
                oneof.parent.add(oneof.fieldsArray[i]);
}

/**
 * Adds a field to this oneof and removes it from its current parent, if any.
 * @param {Field} field Field to add
 * @returns {OneOf} `this`
 */
OneOf.prototype.add = function add(field) {

    /* istanbul ignore next */
    if (!(field instanceof Field))
        throw TypeError("field must be a Field");
    if (field.parent && field.parent !== this.parent)
        field.parent.remove(field);
    this.oneof.push(field.name);
    this.fieldsArray.push(field);
    field.partOf = this; // field.parent remains null
    addFieldsToParent(this);
    return this;
};

/**
 * Removes a field from this oneof and puts it back to the oneof's parent.
 * @param {Field} field Field to remove
 * @returns {OneOf} `this`
 */
OneOf.prototype.remove = function remove(field) {

    /* istanbul ignore next */
    if (!(field instanceof Field))
        throw TypeError("field must be a Field");

    var index = this.fieldsArray.indexOf(field);
    /* istanbul ignore next */
    if (index < 0)
        throw Error(field + " is not a member of " + this);

    this.fieldsArray.splice(index, 1);
    index = this.oneof.indexOf(field.name);
    /* istanbul ignore else */
    if (index > -1) // theoretical
        this.oneof.splice(index, 1);
    field.partOf = null;
    return this;
};

/**
 * @override
 */
OneOf.prototype.onAdd = function onAdd(parent) {
    ReflectionObject.prototype.onAdd.call(this, parent);
    var self = this;
    // Collect present fields
    for (var i = 0; i < this.oneof.length; ++i) {
        var field = parent.get(this.oneof[i]);
        if (field && !field.partOf) {
            field.partOf = self;
            self.fieldsArray.push(field);
        }
    }
    // Add not yet present fields
    addFieldsToParent(this);
};

/**
 * @override
 */
OneOf.prototype.onRemove = function onRemove(parent) {
    for (var i = 0, field; i < this.fieldsArray.length; ++i)
        if ((field = this.fieldsArray[i]).parent)
            field.parent.remove(field);
    ReflectionObject.prototype.onRemove.call(this, parent);
};

},{"./field":17,"./object":25}],27:[function(require,module,exports){
"use strict";
module.exports = parse;

parse.filename = null;
parse.defaults = { keepCase: false };

var tokenize  = require("./tokenize"),
    Root      = require("./root"),
    Type      = require("./type"),
    Field     = require("./field"),
    MapField  = require("./mapfield"),
    OneOf     = require("./oneof"),
    Enum      = require("./enum"),
    Service   = require("./service"),
    Method    = require("./method"),
    types     = require("./types"),
    util      = require("./util");

function isName(token) {
    return /^[a-zA-Z_][a-zA-Z_0-9]*$/.test(token);
}

function isTypeRef(token) {
    return /^(?:\.?[a-zA-Z_][a-zA-Z_0-9]*)+$/.test(token);
}

function isFqTypeRef(token) {
    return /^(?:\.[a-zA-Z][a-zA-Z_0-9]*)+$/.test(token);
}

function lower(token) {
    return token === null ? null : token.toLowerCase();
}

function camelCase(str) {
    return str.substring(0,1)
         + str.substring(1)
               .replace(/_([a-z])(?=[a-z]|$)/g, function($0, $1) { return $1.toUpperCase(); });
}

/**
 * Result object returned from {@link parse}.
 * @typedef ParserResult
 * @type {Object.<string,*>}
 * @property {string|undefined} package Package name, if declared
 * @property {string[]|undefined} imports Imports, if any
 * @property {string[]|undefined} weakImports Weak imports, if any
 * @property {string|undefined} syntax Syntax, if specified (either `"proto2"` or `"proto3"`)
 * @property {Root} root Populated root instance
 */

/**
 * Options modifying the behavior of {@link parse}.
 * @typedef ParseOptions
 * @type {Object.<string,*>}
 * @property {boolean} [keepCase=false] Keeps field casing instead of converting to camel case
 */

/**
 * Parses the given .proto source and returns an object with the parsed contents.
 * @function
 * @param {string} source Source contents
 * @param {Root} root Root to populate
 * @param {ParseOptions} [options] Parse options. Defaults to {@link parse.defaults} when omitted.
 * @returns {ParserResult} Parser result
 * @property {string} filename=null Currently processing file name for error reporting, if known
 * @property {ParseOptions} defaults Default {@link ParseOptions}
 */
function parse(source, root, options) {
    /* eslint-disable callback-return */
    if (!(root instanceof Root)) {
        options = root;
        root = new Root();
    }
    if (!options)
        options = parse.defaults;

    var tn = tokenize(source),
        next = tn.next,
        push = tn.push,
        peek = tn.peek,
        skip = tn.skip,
        cmnt = tn.cmnt;

    var head = true,
        pkg,
        imports,
        weakImports,
        syntax,
        isProto3 = false;

    var ptr = root;

    var applyCase = options.keepCase ? function(name) { return name; } : camelCase;

    /* istanbul ignore next */
    function illegal(token, name, insideTryCatch) {
        var filename = parse.filename;
        if (!insideTryCatch)
            parse.filename = null;
        return Error("illegal " + (name || "token") + " '" + token + "' (" + (filename ? filename + ", " : "") + "line " + tn.line() + ")");
    }

    function readString() {
        var values = [],
            token;
        /* istanbul ignore next */
        do {
            if ((token = next()) !== "\"" && token !== "'")
                throw illegal(token);
            values.push(next());
            skip(token);
            token = peek();
        } while (token === "\"" || token === "'");
        return values.join("");
    }

    function readValue(acceptTypeRef) {
        var token = next();
        switch (lower(token)) {
            case "'":
            case "\"":
                push(token);
                return readString();
            case "true":
                return true;
            case "false":
                return false;
        }
        try {
            return parseNumber(token, /* insideTryCatch */ true);
        } catch (e) {
            /* istanbul ignore else */
            if (acceptTypeRef && isTypeRef(token))
                return token;
            /* istanbul ignore next */
            throw illegal(token, "value");
        }
    }

    function readRanges(target, acceptStrings) {
        var token, start;
        do {
            if (acceptStrings && ((token = peek()) === "\"" || token === "'"))
                target.push(readString());
            else
                target.push([ start = parseId(next()), skip("to", true) ? parseId(next()) : start ]);
        } while (skip(",", true));
        skip(";");
    }

    function parseNumber(token, insideTryCatch) {
        var sign = 1;
        if (token.charAt(0) === "-") {
            sign = -1;
            token = token.substring(1);
        }
        var tokenLower = lower(token);
        switch (tokenLower) {
            case "inf": return sign * Infinity;
            case "nan": return NaN;
            case "0": return 0;
        }
        if (/^[1-9][0-9]*$/.test(token))
            return sign * parseInt(token, 10);
        if (/^0[x][0-9a-f]+$/.test(tokenLower))
            return sign * parseInt(token, 16);
        if (/^0[0-7]+$/.test(token))
            return sign * parseInt(token, 8);
        if (/^(?!e)[0-9]*(?:\.[0-9]*)?(?:[e][+-]?[0-9]+)?$/.test(tokenLower))
            return sign * parseFloat(token);
        /* istanbul ignore next */
        throw illegal(token, "number", insideTryCatch);
    }

    function parseId(token, acceptNegative) {
        var tokenLower = lower(token);
        switch (tokenLower) {
            case "max": return 536870911;
            case "0": return 0;
        }
        /* istanbul ignore next */
        if (token.charAt(0) === "-" && !acceptNegative)
            throw illegal(token, "id");
        if (/^-?[1-9][0-9]*$/.test(token))
            return parseInt(token, 10);
        if (/^-?0[x][0-9a-f]+$/.test(tokenLower))
            return parseInt(token, 16);
        /* istanbul ignore else */
        if (/^-?0[0-7]+$/.test(token))
            return parseInt(token, 8);
        /* istanbul ignore next */
        throw illegal(token, "id");
    }

    function parsePackage() {
        /* istanbul ignore next */
        if (pkg !== undefined)
            throw illegal("package");
        pkg = next();
        /* istanbul ignore next */
        if (!isTypeRef(pkg))
            throw illegal(pkg, "name");
        ptr = ptr.define(pkg);
        skip(";");
    }

    function parseImport() {
        var token = peek();
        var whichImports;
        switch (token) {
            case "weak":
                whichImports = weakImports || (weakImports = []);
                next();
                break;
            case "public":
                next();
                // eslint-disable-line no-fallthrough
            default:
                whichImports = imports || (imports = []);
                break;
        }
        token = readString();
        skip(";");
        whichImports.push(token);
    }

    function parseSyntax() {
        skip("=");
        syntax = lower(readString());
        isProto3 = syntax === "proto3";
        /* istanbul ignore next */
        if (!isProto3 && syntax !== "proto2")
            throw illegal(syntax, "syntax");
        skip(";");
    }

    function parseCommon(parent, token) {
        switch (token) {

            case "option":
                parseOption(parent, token);
                skip(";");
                return true;

            case "message":
                parseType(parent, token);
                return true;

            case "enum":
                parseEnum(parent, token);
                return true;

            case "service":
                parseService(parent, token);
                return true;

            case "extend":
                parseExtension(parent, token);
                return true;
        }
        return false;
    }

    function parseType(parent, token) {
        var name = next();
        /* istanbul ignore next */
        if (!isName(name))
            throw illegal(name, "type name");
        var type = new Type(name);
        type.comment = cmnt();
        type.filename = parse.filename;
        if (skip("{", true)) {
            while ((token = next()) !== "}") {
                var tokenLower = lower(token);
                if (parseCommon(type, token))
                    continue;
                switch (tokenLower) {

                    case "map":
                        parseMapField(type, tokenLower);
                        break;

                    case "required":
                    case "optional":
                    case "repeated":
                        parseField(type, tokenLower);
                        break;

                    case "oneof":
                        parseOneOf(type, tokenLower);
                        break;

                    case "extensions":
                        readRanges(type.extensions || (type.extensions = []));
                        break;

                    case "reserved":
                        readRanges(type.reserved || (type.reserved = []), true);
                        break;

                    default:
                        /* istanbul ignore next */
                        if (!isProto3 || !isTypeRef(token))
                            throw illegal(token);
                        push(token);
                        parseField(type, "optional");
                        break;
                }
            }
            skip(";", true);
        } else
            skip(";");
        parent.add(type);
    }

    function parseField(parent, rule, extend) {
        var type = next();
        if (type === "group") {
            parseGroup(parent, rule);
            return;
        }
        /* istanbul ignore next */
        if (!isTypeRef(type))
            throw illegal(type, "type");
        var name = next();
        /* istanbul ignore next */
        if (!isName(name))
            throw illegal(name, "name");
        name = applyCase(name);
        skip("=");
        var field = new Field(name, parseId(next()), type, rule, extend),
            trailingLine = tn.line();
        field.comment = cmnt();
        field.filename = parse.filename;
        parseInlineOptions(field);
        if (!field.comment)
            field.comment = cmnt(trailingLine);
        // JSON defaults to packed=true if not set so we have to set packed=false explicity when
        // parsing proto2 descriptors without the option, where applicable. This must be done for
        // any type (not just packable types) because enums also use varint encoding and it is not
        // yet known whether a type is an enum or not.
        if (!isProto3 && field.repeated)
            field.setOption("packed", false, /* ifNotSet */ true);
        parent.add(field);
    }

    function parseGroup(parent, rule) {
        var name = next();
        /* istanbul ignore next */
        if (!isName(name))
            throw illegal(name, "name");
        var fieldName = util.lcFirst(name);
        if (name === fieldName)
            name = util.ucFirst(name);
        skip("=");
        var id = parseId(next());
        var type = new Type(name);
        type.group = true;
        type.comment = cmnt();
        var field = new Field(fieldName, id, name, rule);
        type.filename = field.filename = parse.filename;
        skip("{");
        while ((token = next()) !== "}") {
            switch (token = lower(token)) {
                case "option":
                    parseOption(type, token);
                    skip(";");
                    break;
                case "required":
                case "optional":
                case "repeated":
                    parseField(type, token);
                    break;

                /* istanbul ignore next */
                default:
                    throw illegal(token); // there are no groups with proto3 semantics
            }
        }
        skip(";", true);
        parent.add(type).add(field);
    }

    function parseMapField(parent) {
        skip("<");
        var keyType = next();

        /* istanbul ignore next */
        if (types.mapKey[keyType] === undefined)
            throw illegal(keyType, "type");
        skip(",");
        var valueType = next();
        /* istanbul ignore next */
        if (!isTypeRef(valueType))
            throw illegal(valueType, "type");
        skip(">");
        var name = next();
        /* istanbul ignore next */
        if (!isName(name))
            throw illegal(name, "name");

        name = applyCase(name);
        skip("=");
        var field = new MapField(name, parseId(next()), keyType, valueType),
            trailingLine = tn.line();
        field.comment = cmnt();
        field.filename = parse.filename;
        parseInlineOptions(field);
        if (!field.comment)
            field.comment = cmnt(trailingLine);
        parent.add(field);
    }

    function parseOneOf(parent, token) {
        var name = next();

        /* istanbul ignore next */
        if (!isName(name))
            throw illegal(name, "name");

        name = applyCase(name);
        var oneof = new OneOf(name),
            trailingLine = tn.line();
        oneof.comment = cmnt();
        oneof.filename = parse.filename;
        if (skip("{", true)) {
            while ((token = next()) !== "}") {
                if (token === "option") {
                    parseOption(oneof, token);
                    skip(";");
                } else {
                    push(token);
                    parseField(oneof, "optional");
                }
            }
            skip(";", true);
        } else {
            skip(";");
            if (!oneof.comment)
                oneof.comment = cmnt(trailingLine);
        }
        parent.add(oneof);
    }

    function parseEnum(parent, token) {
        var name = next();

        /* istanbul ignore next */
        if (!isName(name))
            throw illegal(name, "name");

        var enm = new Enum(name);
        enm.comment = cmnt();
        enm.filename = parse.filename;
        if (skip("{", true)) {
            while ((token = next()) !== "}") {
                if (lower(token) === "option") {
                    parseOption(enm, token);
                    skip(";");
                } else
                    parseEnumValue(enm, token);
            }
            skip(";", true);
        } else
            skip(";");
        parent.add(enm);
    }

    function parseEnumValue(parent, token) {

        /* istanbul ignore next */
        if (!isName(token))
            throw illegal(token, "name");

        var name = token;
        skip("=");
        var value = parseId(next(), true),
            trailingLine = tn.line();
        parent.add(name, value, cmnt());
        parseInlineOptions({}); // skips enum value options
        if (!parent.comments[name])
            parent.comments[name] = cmnt(trailingLine);
    }

    function parseOption(parent, token) {
        var custom = skip("(", true);
        var name = next();

        /* istanbul ignore next */
        if (!isTypeRef(name))
            throw illegal(name, "name");

        if (custom) {
            skip(")");
            name = "(" + name + ")";
            token = peek();
            if (isFqTypeRef(token)) {
                name += token;
                next();
            }
        }
        skip("=");
        parseOptionValue(parent, name);
    }

    function parseOptionValue(parent, name) {
        if (skip("{", true)) { // { a: "foo" b { c: "bar" } }
            /* istanbul ignore next */
            do {
                if (!isName(token = next()))
                    throw illegal(token, "name");
                if (peek() === "{")
                    parseOptionValue(parent, name + "." + token);
                else {
                    skip(":");
                    setOption(parent, name + "." + token, readValue(true));
                }
            } while (!skip("}", true));
        } else
            setOption(parent, name, readValue(true));
        // Does not enforce a delimiter to be universal
    }

    function setOption(parent, name, value) {
        if (parent.setOption)
            parent.setOption(name, value);
    }

    function parseInlineOptions(parent) {
        if (skip("[", true)) {
            do {
                parseOption(parent, "option");
            } while (skip(",", true));
            skip("]");
        }
        skip(";");
        return parent;
    }

    function parseService(parent, token) {
        token = next();

        /* istanbul ignore next */
        if (!isName(token))
            throw illegal(token, "service name");

        var name = token;
        var service = new Service(name);
        service.comment = cmnt();
        service.filename = parse.filename;
        if (skip("{", true)) {
            while ((token = next()) !== "}") {
                var tokenLower = lower(token);
                switch (tokenLower) {
                    case "option":
                        parseOption(service, tokenLower);
                        skip(";");
                        break;
                    case "rpc":
                        parseMethod(service, tokenLower);
                        break;

                    /* istanbul ignore next */
                    default:
                        throw illegal(token);
                }
            }
            skip(";", true);
        } else
            skip(";");
        parent.add(service);
    }

    function parseMethod(parent, token) {
        var type = token;
        var name = next();

        /* istanbul ignore next */
        if (!isName(name))
            throw illegal(name, "name");
        var requestType, requestStream,
            responseType, responseStream;
        skip("(");
        if (skip("stream", true))
            requestStream = true;
        /* istanbul ignore next */
        if (!isTypeRef(token = next()))
            throw illegal(token);
        requestType = token;
        skip(")"); skip("returns"); skip("(");
        if (skip("stream", true))
            responseStream = true;
        /* istanbul ignore next */
        if (!isTypeRef(token = next()))
            throw illegal(token);

        responseType = token;
        skip(")");
        var method = new Method(name, type, requestType, responseType, requestStream, responseStream),
            trailingLine = tn.line();
        method.comment = cmnt();
        method.filename = parse.filename;
        if (skip("{", true)) {
            while ((token = next()) !== "}") {
                var tokenLower = lower(token);
                switch (tokenLower) {
                    case "option":
                        parseOption(method, tokenLower);
                        skip(";");
                        break;

                    /* istanbul ignore next */
                    default:
                        throw illegal(token);
                }
            }
            skip(";", true);
        } else {
            skip(";");
            if (!method.comment)
                method.comment = cmnt(trailingLine);
        }
        parent.add(method);
    }

    function parseExtension(parent, token) {
        var reference = next();

        /* istanbul ignore next */
        if (!isTypeRef(reference))
            throw illegal(reference, "reference");

        if (skip("{", true)) {
            while ((token = next()) !== "}") {
                var tokenLower = lower(token);
                switch (tokenLower) {
                    case "required":
                    case "repeated":
                    case "optional":
                        parseField(parent, tokenLower, reference);
                        break;
                    default:
                        /* istanbul ignore next */
                        if (!isProto3 || !isTypeRef(token))
                            throw illegal(token);
                        push(token);
                        parseField(parent, "optional", reference);
                        break;
                }
            }
            skip(";", true);
        } else
            skip(";");
    }

    var token;
    while ((token = next()) !== null) {
        var tokenLower = lower(token);
        switch (tokenLower) {

            case "package":
                /* istanbul ignore next */
                if (!head)
                    throw illegal(token);
                parsePackage();
                break;

            case "import":
                /* istanbul ignore next */
                if (!head)
                    throw illegal(token);
                parseImport();
                break;

            case "syntax":
                /* istanbul ignore next */
                if (!head)
                    throw illegal(token);
                parseSyntax();
                break;

            case "option":
                /* istanbul ignore next */
                if (!head)
                    throw illegal(token);
                parseOption(ptr, token);
                skip(";");
                break;

            default:
                /* istanbul ignore else */
                if (parseCommon(ptr, token)) {
                    head = false;
                    continue;
                }
                /* istanbul ignore next */
                throw illegal(token);
        }
    }

    parse.filename = null;
    return {
        "package"     : pkg,
        "imports"     : imports,
         weakImports  : weakImports,
         syntax       : syntax,
         root         : root
    };
}

/**
 * Parses the given .proto source and returns an object with the parsed contents.
 * @name parse
 * @function
 * @param {string} source Source contents
 * @param {ParseOptions} [options] Parse options. Defaults to {@link parse.defaults} when omitted.
 * @returns {ParserResult} Parser result
 * @property {string} filename=null Currently processing file name for error reporting, if known
 * @property {ParseOptions} defaults Default {@link ParseOptions}
 * @variation 2
 */

},{"./enum":16,"./field":17,"./mapfield":21,"./method":23,"./oneof":26,"./root":30,"./service":33,"./tokenize":34,"./type":35,"./types":36,"./util":37}],28:[function(require,module,exports){
"use strict";
module.exports = Reader;

var util      = require("./util/minimal");

var BufferReader; // cyclic

var LongBits  = util.LongBits,
    utf8      = util.utf8;

/* istanbul ignore next */
function indexOutOfRange(reader, writeLength) {
    return RangeError("index out of range: " + reader.pos + " + " + (writeLength || 1) + " > " + reader.len);
}

/**
 * Constructs a new reader instance using the specified buffer.
 * @classdesc Wire format reader using `Uint8Array` if available, otherwise `Array`.
 * @constructor
 * @param {Uint8Array} buffer Buffer to read from
 */
function Reader(buffer) {

    /**
     * Read buffer.
     * @type {Uint8Array}
     */
    this.buf = buffer;

    /**
     * Read buffer position.
     * @type {number}
     */
    this.pos = 0;

    /**
     * Read buffer length.
     * @type {number}
     */
    this.len = buffer.length;
}

/**
 * Creates a new reader using the specified buffer.
 * @function
 * @param {Uint8Array|Buffer} buffer Buffer to read from
 * @returns {Reader|BufferReader} A {@link BufferReader} if `buffer` is a Buffer, otherwise a {@link Reader}
 */
Reader.create = util.Buffer
    ? function create_buffer_setup(buffer) {
        return (Reader.create = function create_buffer(buffer) {
            return util.Buffer.isBuffer(buffer)
                ? new BufferReader(buffer)
                : new Reader(buffer);
        })(buffer);
    }
    /* istanbul ignore next */
    : function create_array(buffer) {
        return new Reader(buffer);
    };

Reader.prototype._slice = util.Array.prototype.subarray || /* istanbul ignore next */ util.Array.prototype.slice;

/**
 * Reads a varint as an unsigned 32 bit value.
 * @function
 * @returns {number} Value read
 */
Reader.prototype.uint32 = (function read_uint32_setup() {
    var value = 4294967295; // optimizer type-hint, tends to deopt otherwise (?!)
    return function read_uint32() {
        value = (         this.buf[this.pos] & 127       ) >>> 0; if (this.buf[this.pos++] < 128) return value;
        value = (value | (this.buf[this.pos] & 127) <<  7) >>> 0; if (this.buf[this.pos++] < 128) return value;
        value = (value | (this.buf[this.pos] & 127) << 14) >>> 0; if (this.buf[this.pos++] < 128) return value;
        value = (value | (this.buf[this.pos] & 127) << 21) >>> 0; if (this.buf[this.pos++] < 128) return value;
        value = (value | (this.buf[this.pos] &  15) << 28) >>> 0; if (this.buf[this.pos++] < 128) return value;

        /* istanbul ignore next */
        if ((this.pos += 5) > this.len) {
            this.pos = this.len;
            throw indexOutOfRange(this, 10);
        }
        return value;
    };
})();

/**
 * Reads a varint as a signed 32 bit value.
 * @returns {number} Value read
 */
Reader.prototype.int32 = function read_int32() {
    return this.uint32() | 0;
};

/**
 * Reads a zig-zag encoded varint as a signed 32 bit value.
 * @returns {number} Value read
 */
Reader.prototype.sint32 = function read_sint32() {
    var value = this.uint32();
    return value >>> 1 ^ -(value & 1) | 0;
};

/* eslint-disable no-invalid-this */

function readLongVarint() {
    // tends to deopt with local vars for octet etc.
    var bits = new LongBits(0, 0);
    var i = 0;
    if (this.len - this.pos > 4) { // fast route (lo)
        for (; i < 4; ++i) {
            // 1st..4th
            bits.lo = (bits.lo | (this.buf[this.pos] & 127) << i * 7) >>> 0;
            if (this.buf[this.pos++] < 128)
                return bits;
        }
        // 5th
        bits.lo = (bits.lo | (this.buf[this.pos] & 127) << 28) >>> 0;
        bits.hi = (bits.hi | (this.buf[this.pos] & 127) >>  4) >>> 0;
        if (this.buf[this.pos++] < 128)
            return bits;
        i = 0;
    } else {
        for (; i < 3; ++i) {
            /* istanbul ignore next */
            if (this.pos >= this.len)
                throw indexOutOfRange(this);
            // 1st..3th
            bits.lo = (bits.lo | (this.buf[this.pos] & 127) << i * 7) >>> 0;
            if (this.buf[this.pos++] < 128)
                return bits;
        }
        // 4th
        bits.lo = (bits.lo | (this.buf[this.pos++] & 127) << i * 7) >>> 0;
        return bits;
    }
    if (this.len - this.pos > 4) { // fast route (hi)
        for (; i < 5; ++i) {
            // 6th..10th
            bits.hi = (bits.hi | (this.buf[this.pos] & 127) << i * 7 + 3) >>> 0;
            if (this.buf[this.pos++] < 128)
                return bits;
        }
    } else {
        for (; i < 5; ++i) {
            /* istanbul ignore next */
            if (this.pos >= this.len)
                throw indexOutOfRange(this);
            // 6th..10th
            bits.hi = (bits.hi | (this.buf[this.pos] & 127) << i * 7 + 3) >>> 0;
            if (this.buf[this.pos++] < 128)
                return bits;
        }
    }
    /* istanbul ignore next */
    throw Error("invalid varint encoding");
}

function read_int64_long() {
    return readLongVarint.call(this).toLong();
}

/* istanbul ignore next */
function read_int64_number() {
    return readLongVarint.call(this).toNumber();
}

function read_uint64_long() {
    return readLongVarint.call(this).toLong(true);
}

/* istanbul ignore next */
function read_uint64_number() {
    return readLongVarint.call(this).toNumber(true);
}

function read_sint64_long() {
    return readLongVarint.call(this).zzDecode().toLong();
}

/* istanbul ignore next */
function read_sint64_number() {
    return readLongVarint.call(this).zzDecode().toNumber();
}

/* eslint-enable no-invalid-this */

/**
 * Reads a varint as a signed 64 bit value.
 * @name Reader#int64
 * @function
 * @returns {Long|number} Value read
 */

/**
 * Reads a varint as an unsigned 64 bit value.
 * @name Reader#uint64
 * @function
 * @returns {Long|number} Value read
 */

/**
 * Reads a zig-zag encoded varint as a signed 64 bit value.
 * @name Reader#sint64
 * @function
 * @returns {Long|number} Value read
 */

/**
 * Reads a varint as a boolean.
 * @returns {boolean} Value read
 */
Reader.prototype.bool = function read_bool() {
    return this.uint32() !== 0;
};

function readFixed32(buf, end) {
    return (buf[end - 4]
          | buf[end - 3] << 8
          | buf[end - 2] << 16
          | buf[end - 1] << 24) >>> 0;
}

/**
 * Reads fixed 32 bits as an unsigned 32 bit integer.
 * @returns {number} Value read
 */
Reader.prototype.fixed32 = function read_fixed32() {

    /* istanbul ignore next */
    if (this.pos + 4 > this.len)
        throw indexOutOfRange(this, 4);

    return readFixed32(this.buf, this.pos += 4);
};

/**
 * Reads fixed 32 bits as a signed 32 bit integer.
 * @returns {number} Value read
 */
Reader.prototype.sfixed32 = function read_sfixed32() {

    /* istanbul ignore next */
    if (this.pos + 4 > this.len)
        throw indexOutOfRange(this, 4);

    return readFixed32(this.buf, this.pos += 4) | 0;
};

/* eslint-disable no-invalid-this */

function readFixed64(/* this: Reader */) {

    /* istanbul ignore next */
    if (this.pos + 8 > this.len)
        throw indexOutOfRange(this, 8);

    return new LongBits(readFixed32(this.buf, this.pos += 4), readFixed32(this.buf, this.pos += 4));
}

function read_fixed64_long() {
    return readFixed64.call(this).toLong(true);
}

/* istanbul ignore next */
function read_fixed64_number() {
    return readFixed64.call(this).toNumber(true);
}

function read_sfixed64_long() {
    return readFixed64.call(this).toLong(false);
}

/* istanbul ignore next */
function read_sfixed64_number() {
    return readFixed64.call(this).toNumber(false);
}

/* eslint-enable no-invalid-this */

/**
 * Reads fixed 64 bits.
 * @name Reader#fixed64
 * @function
 * @returns {Long|number} Value read
 */

/**
 * Reads zig-zag encoded fixed 64 bits.
 * @name Reader#sfixed64
 * @function
 * @returns {Long|number} Value read
 */

var readFloat = typeof Float32Array !== "undefined"
    ? (function() {
        var f32 = new Float32Array(1),
            f8b = new Uint8Array(f32.buffer);
        f32[0] = -0;
        return f8b[3] // already le?
            ? function readFloat_f32(buf, pos) {
                f8b[0] = buf[pos    ];
                f8b[1] = buf[pos + 1];
                f8b[2] = buf[pos + 2];
                f8b[3] = buf[pos + 3];
                return f32[0];
            }
            /* istanbul ignore next */
            : function readFloat_f32_le(buf, pos) {
                f8b[3] = buf[pos    ];
                f8b[2] = buf[pos + 1];
                f8b[1] = buf[pos + 2];
                f8b[0] = buf[pos + 3];
                return f32[0];
            };
    })()
    /* istanbul ignore next */
    : function readFloat_ieee754(buf, pos) {
        var uint = readFixed32(buf, pos + 4),
            sign = (uint >> 31) * 2 + 1,
            exponent = uint >>> 23 & 255,
            mantissa = uint & 8388607;
        return exponent === 255
            ? mantissa
              ? NaN
              : sign * Infinity
            : exponent === 0 // denormal
              ? sign * 1.401298464324817e-45 * mantissa
              : sign * Math.pow(2, exponent - 150) * (mantissa + 8388608);
    };

/**
 * Reads a float (32 bit) as a number.
 * @function
 * @returns {number} Value read
 */
Reader.prototype.float = function read_float() {

    /* istanbul ignore next */
    if (this.pos + 4 > this.len)
        throw indexOutOfRange(this, 4);

    var value = readFloat(this.buf, this.pos);
    this.pos += 4;
    return value;
};

var readDouble = typeof Float64Array !== "undefined"
    ? (function() {
        var f64 = new Float64Array(1),
            f8b = new Uint8Array(f64.buffer);
        f64[0] = -0;
        return f8b[7] // already le?
            ? function readDouble_f64(buf, pos) {
                f8b[0] = buf[pos    ];
                f8b[1] = buf[pos + 1];
                f8b[2] = buf[pos + 2];
                f8b[3] = buf[pos + 3];
                f8b[4] = buf[pos + 4];
                f8b[5] = buf[pos + 5];
                f8b[6] = buf[pos + 6];
                f8b[7] = buf[pos + 7];
                return f64[0];
            }
            /* istanbul ignore next */
            : function readDouble_f64_le(buf, pos) {
                f8b[7] = buf[pos    ];
                f8b[6] = buf[pos + 1];
                f8b[5] = buf[pos + 2];
                f8b[4] = buf[pos + 3];
                f8b[3] = buf[pos + 4];
                f8b[2] = buf[pos + 5];
                f8b[1] = buf[pos + 6];
                f8b[0] = buf[pos + 7];
                return f64[0];
            };
    })()
    /* istanbul ignore next */
    : function readDouble_ieee754(buf, pos) {
        var lo = readFixed32(buf, pos + 4),
            hi = readFixed32(buf, pos + 8);
        var sign = (hi >> 31) * 2 + 1,
            exponent = hi >>> 20 & 2047,
            mantissa = 4294967296 * (hi & 1048575) + lo;
        return exponent === 2047
            ? mantissa
              ? NaN
              : sign * Infinity
            : exponent === 0 // denormal
              ? sign * 5e-324 * mantissa
              : sign * Math.pow(2, exponent - 1075) * (mantissa + 4503599627370496);
    };

/**
 * Reads a double (64 bit float) as a number.
 * @function
 * @returns {number} Value read
 */
Reader.prototype.double = function read_double() {

    /* istanbul ignore next */
    if (this.pos + 8 > this.len)
        throw indexOutOfRange(this, 4);

    var value = readDouble(this.buf, this.pos);
    this.pos += 8;
    return value;
};

/**
 * Reads a sequence of bytes preceeded by its length as a varint.
 * @returns {Uint8Array} Value read
 */
Reader.prototype.bytes = function read_bytes() {
    var length = this.uint32(),
        start  = this.pos,
        end    = this.pos + length;

    /* istanbul ignore next */
    if (end > this.len)
        throw indexOutOfRange(this, length);

    this.pos += length;
    return start === end // fix for IE 10/Win8 and others' subarray returning array of size 1
        ? new this.buf.constructor(0)
        : this._slice.call(this.buf, start, end);
};

/**
 * Reads a string preceeded by its byte length as a varint.
 * @returns {string} Value read
 */
Reader.prototype.string = function read_string() {
    var bytes = this.bytes();
    return utf8.read(bytes, 0, bytes.length);
};

/**
 * Skips the specified number of bytes if specified, otherwise skips a varint.
 * @param {number} [length] Length if known, otherwise a varint is assumed
 * @returns {Reader} `this`
 */
Reader.prototype.skip = function skip(length) {
    if (typeof length === "number") {
        /* istanbul ignore next */
        if (this.pos + length > this.len)
            throw indexOutOfRange(this, length);
        this.pos += length;
    } else {
        /* istanbul ignore next */
        do {
            if (this.pos >= this.len)
                throw indexOutOfRange(this);
        } while (this.buf[this.pos++] & 128);
    }
    return this;
};

/**
 * Skips the next element of the specified wire type.
 * @param {number} wireType Wire type received
 * @returns {Reader} `this`
 */
Reader.prototype.skipType = function(wireType) {
    switch (wireType) {
        case 0:
            this.skip();
            break;
        case 1:
            this.skip(8);
            break;
        case 2:
            this.skip(this.uint32());
            break;
        case 3:
            do { // eslint-disable-line no-constant-condition
                if ((wireType = this.uint32() & 7) === 4)
                    break;
                this.skipType(wireType);
            } while (true);
            break;
        case 5:
            this.skip(4);
            break;

        /* istanbul ignore next */
        default:
            throw Error("invalid wire type " + wireType + " at offset " + this.pos);
    }
    return this;
};

Reader._configure = function(BufferReader_) {
    BufferReader = BufferReader_;

    /* istanbul ignore else */
    if (util.Long) {
        Reader.prototype.int64 = read_int64_long;
        Reader.prototype.uint64 = read_uint64_long;
        Reader.prototype.sint64 = read_sint64_long;
        Reader.prototype.fixed64 = read_fixed64_long;
        Reader.prototype.sfixed64 = read_sfixed64_long;
    } else {
        Reader.prototype.int64 = read_int64_number;
        Reader.prototype.uint64 = read_uint64_number;
        Reader.prototype.sint64 = read_sint64_number;
        Reader.prototype.fixed64 = read_fixed64_number;
        Reader.prototype.sfixed64 = read_sfixed64_number;
    }
};

},{"./util/minimal":39}],29:[function(require,module,exports){
"use strict";
module.exports = BufferReader;

// extends Reader
var Reader = require("./reader");
(BufferReader.prototype = Object.create(Reader.prototype)).constructor = BufferReader;

var util = require("./util/minimal");

/**
 * Constructs a new buffer reader instance.
 * @classdesc Wire format reader using node buffers.
 * @extends Reader
 * @constructor
 * @param {Buffer} buffer Buffer to read from
 */
function BufferReader(buffer) {
    Reader.call(this, buffer);

    /**
     * Read buffer.
     * @name BufferReader#buf
     * @type {Buffer}
     */
}

/* istanbul ignore else */
if (util.Buffer)
    BufferReader.prototype._slice = util.Buffer.prototype.slice;

/**
 * @override
 */
BufferReader.prototype.string = function read_string_buffer() {
    var len = this.uint32(); // modifies pos
    return this.buf.utf8Slice(this.pos, this.pos = Math.min(this.pos + len, this.len));
};

/**
 * Reads a sequence of bytes preceeded by its length as a varint.
 * @name BufferReader#bytes
 * @function
 * @returns {Buffer} Value read
 */

},{"./reader":28,"./util/minimal":39}],30:[function(require,module,exports){
"use strict";
module.exports = Root;

// extends Namespace
var Namespace = require("./namespace");
((Root.prototype = Object.create(Namespace.prototype)).constructor = Root).className = "Root";

var Field   = require("./field"),
    Enum    = require("./enum"),
    util    = require("./util");

var Type,   // cyclic
    parse,  // might be excluded
    common; // "

/**
 * Constructs a new root namespace instance.
 * @classdesc Root namespace wrapping all types, enums, services, sub-namespaces etc. that belong together.
 * @extends NamespaceBase
 * @constructor
 * @param {Object.<string,*>} [options] Top level options
 */
function Root(options) {
    Namespace.call(this, "", options);

    /**
     * Deferred extension fields.
     * @type {Field[]}
     */
    this.deferred = [];

    /**
     * Resolved file names of loaded files.
     * @type {string[]}
     */
    this.files = [];
}

/**
 * Loads a JSON definition into a root namespace.
 * @param {Object.<string,*>} json JSON definition
 * @param {Root} [root] Root namespace, defaults to create a new one if omitted
 * @returns {Root} Root namespace
 */
Root.fromJSON = function fromJSON(json, root) {
    if (!root)
        root = new Root();
    if (json.options)
        root.setOptions(json.options);
    return root.addJSON(json.nested);
};

/**
 * Resolves the path of an imported file, relative to the importing origin.
 * This method exists so you can override it with your own logic in case your imports are scattered over multiple directories.
 * @function
 * @param {string} origin The file name of the importing file
 * @param {string} target The file name being imported
 * @returns {?string} Resolved path to `target` or `null` to skip the file
 */
Root.prototype.resolvePath = util.path.resolve;

// A symbol-like function to safely signal synchronous loading
/* istanbul ignore next */
function SYNC() {} // eslint-disable-line no-empty-function

/**
 * Loads one or multiple .proto or preprocessed .json files into this root namespace and calls the callback.
 * @param {string|string[]} filename Names of one or multiple files to load
 * @param {ParseOptions} options Parse options
 * @param {LoadCallback} callback Callback function
 * @returns {undefined}
 */
Root.prototype.load = function load(filename, options, callback) {
    if (typeof options === "function") {
        callback = options;
        options = undefined;
    }
    var self = this;
    if (!callback)
        return util.asPromise(load, self, filename);
    
    var sync = callback === SYNC; // undocumented

    // Finishes loading by calling the callback (exactly once)
    function finish(err, root) {
        /* istanbul ignore next */
        if (!callback)
            return;
        var cb = callback;
        callback = null;
        if (sync)
            throw err;
        cb(err, root);
    }

    // Processes a single file
    function process(filename, source) {
        try {
            if (util.isString(source) && source.charAt(0) === "{")
                source = JSON.parse(source);
            if (!util.isString(source))
                self.setOptions(source.options).addJSON(source.nested);
            else {
                parse.filename = filename;
                var parsed = parse(source, self, options),
                    resolved,
                    i = 0;
                if (parsed.imports)
                    for (; i < parsed.imports.length; ++i)
                        if (resolved = self.resolvePath(filename, parsed.imports[i]))
                            fetch(resolved);
                if (parsed.weakImports)
                    for (i = 0; i < parsed.weakImports.length; ++i)
                        if (resolved = self.resolvePath(filename, parsed.weakImports[i]))
                            fetch(resolved, true);
            }
        } catch (err) {
            finish(err);
        }
        if (!sync && !queued)
            finish(null, self); // only once anyway
    }

    // Fetches a single file
    function fetch(filename, weak) {

        // Strip path if this file references a bundled definition
        var idx = filename.lastIndexOf("google/protobuf/");
        if (idx > -1) {
            var altname = filename.substring(idx);
            if (altname in common)
                filename = altname;
        }

        // Skip if already loaded / attempted
        if (self.files.indexOf(filename) > -1)
            return;
        self.files.push(filename);

        // Shortcut bundled definitions
        if (filename in common) {
            if (sync)
                process(filename, common[filename]);
            else {
                ++queued;
                setTimeout(function() {
                    --queued;
                    process(filename, common[filename]);
                });
            }
            return;
        }

        // Otherwise fetch from disk or network
        if (sync) {
            var source;
            try {
                source = util.fs.readFileSync(filename).toString("utf8");
            } catch (err) {
                if (!weak)
                    finish(err);
                return;
            }
            process(filename, source);
        } else {
            ++queued;
            util.fetch(filename, function(err, source) {
                --queued;
                /* istanbul ignore next */
                if (!callback)
                    return; // terminated meanwhile
                if (err) {
                    if (!weak)
                        finish(err);
                    else /* istanbul ignore next */ if (!queued) // can't be covered reliably
                        finish(null, self);
                    return;
                }
                process(filename, source);
            });
        }
    }
    var queued = 0;

    // Assembling the root namespace doesn't require working type
    // references anymore, so we can load everything in parallel
    if (util.isString(filename))
        filename = [ filename ];
    for (var i = 0, resolved; i < filename.length; ++i)
        if (resolved = self.resolvePath("", filename[i]))
            fetch(resolved);

    if (sync)
        return self;
    if (!queued)
        finish(null, self);
    return undefined;
};
// function load(filename:string, options:ParseOptions, callback:LoadCallback):undefined

/**
 * Loads one or multiple .proto or preprocessed .json files into this root namespace and calls the callback.
 * @param {string|string[]} filename Names of one or multiple files to load
 * @param {LoadCallback} callback Callback function
 * @returns {undefined}
 * @variation 2
 */
// function load(filename:string, callback:LoadCallback):undefined

/**
 * Loads one or multiple .proto or preprocessed .json files into this root namespace and returns a promise.
 * @name Root#load
 * @function
 * @param {string|string[]} filename Names of one or multiple files to load
 * @param {ParseOptions} [options] Parse options. Defaults to {@link parse.defaults} when omitted.
 * @returns {Promise<Root>} Promise
 * @variation 3
 */
// function load(filename:string, [options:ParseOptions]):Promise<Root>

/**
 * Synchronously loads one or multiple .proto or preprocessed .json files into this root namespace (node only).
 * @name Root#loadSync
 * @function
 * @param {string|string[]} filename Names of one or multiple files to load
 * @param {ParseOptions} [options] Parse options. Defaults to {@link parse.defaults} when omitted.
 * @returns {Root} Root namespace
 * @throws {Error} If synchronous fetching is not supported (i.e. in browsers) or if a file's syntax is invalid
 */
Root.prototype.loadSync = function loadSync(filename, options) {
    if (!util.isNode)
        throw Error("not supported");
    return this.load(filename, options, SYNC);
};

/**
 * @override
 */
Root.prototype.resolveAll = function resolveAll() {
    if (this.deferred.length)
        throw Error("unresolvable extensions: " + this.deferred.map(function(field) {
            return "'extend " + field.extend + "' in " + field.parent.fullName;
        }).join(", "));
    return Namespace.prototype.resolveAll.call(this);
};

// only uppercased (and thus conflict-free) children are exposed, see below
var exposeRe = /^[A-Z]/;

/**
 * Handles a deferred declaring extension field by creating a sister field to represent it within its extended type.
 * @param {Root} root Root instance
 * @param {Field} field Declaring extension field witin the declaring type
 * @returns {boolean} `true` if successfully added to the extended type, `false` otherwise
 * @inner
 * @ignore
 */
function tryHandleExtension(root, field) {   
    var extendedType = field.parent.lookup(field.extend);
    if (extendedType) {
        var sisterField = new Field(field.fullName, field.id, field.type, field.rule, undefined, field.options);
        sisterField.declaringField = field;
        field.extensionField = sisterField;
        extendedType.add(sisterField);
        return true;
    }
    return false;
}

/**
 * Called when any object is added to this root or its sub-namespaces.
 * @param {ReflectionObject} object Object added
 * @returns {undefined}
 * @private
 */
Root.prototype._handleAdd = function _handleAdd(object) {
    if (object instanceof Field) {

        if (/* an extension field (implies not part of a oneof) */ object.extend !== undefined && /* not already handled */ !object.extensionField)
            if (!tryHandleExtension(this, object))
                this.deferred.push(object);

    } else if (object instanceof Enum) {

        if (exposeRe.test(object.name))
            object.parent[object.name] = object.values; // expose enum values as property of its parent

    } else /* everything else is a namespace */ {

        if (object instanceof Type) // Try to handle any deferred extensions
            for (var i = 0; i < this.deferred.length;)
                if (tryHandleExtension(this, this.deferred[i]))
                    this.deferred.splice(i, 1);
                else
                    ++i;
        for (var j = 0; j < /* initializes */ object.nestedArray.length; ++j) // recurse into the namespace
            this._handleAdd(object._nestedArray[j]);
        if (exposeRe.test(object.name))
            object.parent[object.name] = object; // expose namespace as property of its parent
    }

    // The above also adds uppercased (and thus conflict-free) nested types, services and enums as
    // properties of namespaces just like static code does. This allows using a .d.ts generated for
    // a static module with reflection-based solutions where the condition is met.
};

/**
 * Called when any object is removed from this root or its sub-namespaces.
 * @param {ReflectionObject} object Object removed
 * @returns {undefined}
 * @private
 */
Root.prototype._handleRemove = function _handleRemove(object) {
    if (object instanceof Field) {

        if (/* an extension field */ object.extend !== undefined) {
            if (/* already handled */ object.extensionField) { // remove its sister field
                object.extensionField.parent.remove(object.extensionField);
                object.extensionField = null;
            } else { // cancel the extension
                var index = this.deferred.indexOf(object);
                /* istanbul ignore else */
                if (index > -1)
                    this.deferred.splice(index, 1);
            }
        }

    } else if (object instanceof Enum) {

        if (exposeRe.test(object.name))
            delete object.parent[object.name]; // unexpose enum values

    } else if (object instanceof Namespace) {

        for (var i = 0; i < /* initializes */ object.nestedArray.length; ++i) // recurse into the namespace
            this._handleRemove(object._nestedArray[i]);

        if (exposeRe.test(object.name))
            delete object.parent[object.name]; // unexpose namespaces

    }
};

Root._configure = function(Type_, parse_, common_) {
    Type = Type_;
    parse = parse_;
    common = common_;
};

},{"./enum":16,"./field":17,"./namespace":24,"./util":37}],31:[function(require,module,exports){
"use strict";

/**
 * Streaming RPC helpers.
 * @namespace
 */
var rpc = exports;

/**
 * RPC implementation passed to {@link Service#create} performing a service request on network level, i.e. by utilizing http requests or websockets.
 * @typedef RPCImpl
 * @type {function}
 * @param {Method|rpc.ServiceMethod} method Reflected or static method being called
 * @param {Uint8Array} requestData Request data
 * @param {RPCImplCallback} callback Callback function
 * @returns {undefined}
 * @example
 * function rpcImpl(method, requestData, callback) {
 *     if (protobuf.util.lcFirst(method.name) !== "myMethod") // compatible with static code
 *         throw Error("no such method");
 *     asynchronouslyObtainAResponse(requestData, function(err, responseData) {
 *         callback(err, responseData);
 *     });
 * }
 */

/**
 * Node-style callback as used by {@link RPCImpl}.
 * @typedef RPCImplCallback
 * @type {function}
 * @param {?Error} error Error, if any, otherwise `null`
 * @param {?Uint8Array} [response] Response data or `null` to signal end of stream, if there hasn't been an error
 * @returns {undefined}
 */

rpc.Service = require("./rpc/service");

},{"./rpc/service":32}],32:[function(require,module,exports){
"use strict";
module.exports = Service;

var util = require("../util/minimal");

// Extends EventEmitter
(Service.prototype = Object.create(util.EventEmitter.prototype)).constructor = Service;

/**
 * A service method callback as used by {@link rpc.ServiceMethod|ServiceMethod}.
 * 
 * Differs from {@link RPCImplCallback} in that it is an actual callback of a service method which may not return `response = null`.
 * @typedef rpc.ServiceMethodCallback
 * @type {function}
 * @param {?Error} error Error, if any
 * @param {?Message} [response] Response message
 * @returns {undefined}
 */

/**
 * A service method part of a {@link rpc.ServiceMethodMixin|ServiceMethodMixin} and thus {@link rpc.Service} as created by {@link Service.create}.
 * @typedef rpc.ServiceMethod
 * @type {function}
 * @param {Message|Object} request Request message or plain object
 * @param {rpc.ServiceMethodCallback} [callback] Node-style callback called with the error, if any, and the response message
 * @returns {Promise<Message>} Promise if `callback` has been omitted, otherwise `undefined`
 */

/**
 * A service method mixin.
 * 
 * When using TypeScript, mixed in service methods are only supported directly with a type definition of a static module (used with reflection). Otherwise, explicit casting is required.
 * @typedef rpc.ServiceMethodMixin
 * @type {Object.<string,rpc.ServiceMethod>}
 * @example
 * // Explicit casting with TypeScript
 * (myRpcService["myMethod"] as protobuf.rpc.ServiceMethod)(...)
 */

/**
 * Constructs a new RPC service instance.
 * @classdesc An RPC service as returned by {@link Service#create}.
 * @exports rpc.Service
 * @extends util.EventEmitter
 * @augments rpc.ServiceMethodMixin
 * @constructor
 * @param {RPCImpl} rpcImpl RPC implementation
 * @param {boolean} [requestDelimited=false] Whether requests are length-delimited
 * @param {boolean} [responseDelimited=false] Whether responses are length-delimited
 */
function Service(rpcImpl, requestDelimited, responseDelimited) {

    if (typeof rpcImpl !== "function")
        throw TypeError("rpcImpl must be a function");

    util.EventEmitter.call(this);

    /**
     * RPC implementation. Becomes `null` once the service is ended.
     * @type {?RPCImpl}
     */
    this.rpcImpl = rpcImpl;

    /**
     * Whether requests are length-delimited.
     * @type {boolean}
     */
    this.requestDelimited = Boolean(requestDelimited);

    /**
     * Whether responses are length-delimited.
     * @type {boolean}
     */
    this.responseDelimited = Boolean(responseDelimited);
}

/**
 * Calls a service method through {@link rpc.Service#rpcImpl|rpcImpl}.
 * @param {Method|rpc.ServiceMethod} method Reflected or static method
 * @param {function} requestCtor Request constructor
 * @param {function} responseCtor Response constructor
 * @param {Message|Object} request Request message or plain object
 * @param {rpc.ServiceMethodCallback} callback Service callback
 * @returns {undefined}
 */
Service.prototype.rpcCall = function rpcCall(method, requestCtor, responseCtor, request, callback) {

    if (!request)
        throw TypeError("request must be specified");

    var self = this;
    if (!callback)
        return util.asPromise(rpcCall, self, method, requestCtor, responseCtor, request);

    if (!self.rpcImpl) {
        setTimeout(function() { callback(Error("already ended")); }, 0);
        return undefined;
    }

    try {
        return self.rpcImpl(
            method,
            requestCtor[self.requestDelimited ? "encodeDelimited" : "encode"](request).finish(),
            function rpcCallback(err, response) {

                if (err) {
                    self.emit("error", err, method);
                    return callback(err);
                }

                if (response === null) {
                    self.end(/* endedByRPC */ true);
                    return undefined;
                }

                if (!(response instanceof responseCtor)) {
                    try {
                        response = responseCtor[self.responseDelimited ? "decodeDelimited" : "decode"](response);
                    } catch (err) {
                        self.emit("error", err, method);
                        return callback(err);
                    }
                }

                self.emit("data", response, method);
                return callback(null, response);
            }
        );
    } catch (err) {
        self.emit("error", err, method);
        setTimeout(function() { callback(err); }, 0);
        return undefined;
    }
};

/**
 * Ends this service and emits the `end` event.
 * @param {boolean} [endedByRPC=false] Whether the service has been ended by the RPC implementation.
 * @returns {rpc.Service} `this`
 */
Service.prototype.end = function end(endedByRPC) {
    if (this.rpcImpl) {
        if (!endedByRPC) // signal end to rpcImpl
            this.rpcImpl(null, null, null);
        this.rpcImpl = null;
        this.emit("end").off();
    }
    return this;
};

},{"../util/minimal":39}],33:[function(require,module,exports){
"use strict";
module.exports = Service;

// extends Namespace
var Namespace = require("./namespace");
((Service.prototype = Object.create(Namespace.prototype)).constructor = Service).className = "Service";

var Method = require("./method"),
    util   = require("./util"),
    rpc    = require("./rpc");

/**
 * Constructs a new service instance.
 * @classdesc Reflected service.
 * @extends NamespaceBase
 * @constructor
 * @param {string} name Service name
 * @param {Object.<string,*>} [options] Service options
 * @throws {TypeError} If arguments are invalid
 */
function Service(name, options) {
    Namespace.call(this, name, options);

    /**
     * Service methods.
     * @type {Object.<string,Method>}
     */
    this.methods = {}; // toJSON, marker

    /**
     * Cached methods as an array.
     * @type {?Method[]}
     * @private
     */
    this._methodsArray = null;
}

/**
 * Constructs a service from JSON.
 * @param {string} name Service name
 * @param {Object.<string,*>} json JSON object
 * @returns {Service} Created service
 * @throws {TypeError} If arguments are invalid
 */
Service.fromJSON = function fromJSON(name, json) {
    var service = new Service(name, json.options);
    /* istanbul ignore else */
    if (json.methods)
        for (var names = Object.keys(json.methods), i = 0; i < names.length; ++i)
            service.add(Method.fromJSON(names[i], json.methods[names[i]]));
    return service;
};

/**
 * Methods of this service as an array for iteration.
 * @name Service#methodsArray
 * @type {Method[]}
 * @readonly
 */
Object.defineProperty(Service.prototype, "methodsArray", {
    get: function() {
        return this._methodsArray || (this._methodsArray = util.toArray(this.methods));
    }
});

function clearCache(service) {
    service._methodsArray = null;
    return service;
}

/**
 * @override
 */
Service.prototype.toJSON = function toJSON() {
    var inherited = Namespace.prototype.toJSON.call(this);
    return {
        options : inherited && inherited.options || undefined,
        methods : Namespace.arrayToJSON(this.methodsArray) || /* istanbul ignore next */ {},
        nested  : inherited && inherited.nested || undefined
    };
};

/**
 * @override
 */
Service.prototype.get = function get(name) {
    return this.methods[name]
        || Namespace.prototype.get.call(this, name);
};

/**
 * @override
 */
Service.prototype.resolveAll = function resolveAll() {
    var methods = this.methodsArray;
    for (var i = 0; i < methods.length; ++i)
        methods[i].resolve();
    return Namespace.prototype.resolve.call(this);
};

/**
 * @override
 */
Service.prototype.add = function add(object) {
    /* istanbul ignore next */
    if (this.get(object.name))
        throw Error("duplicate name '" + object.name + "' in " + this);
    if (object instanceof Method) {
        this.methods[object.name] = object;
        object.parent = this;
        return clearCache(this);
    }
    return Namespace.prototype.add.call(this, object);
};

/**
 * @override
 */
Service.prototype.remove = function remove(object) {
    if (object instanceof Method) {

        /* istanbul ignore next */
        if (this.methods[object.name] !== object)
            throw Error(object + " is not a member of " + this);

        delete this.methods[object.name];
        object.parent = null;
        return clearCache(this);
    }
    return Namespace.prototype.remove.call(this, object);
};

/**
 * Creates a runtime service using the specified rpc implementation.
 * @param {RPCImpl} rpcImpl RPC implementation
 * @param {boolean} [requestDelimited=false] Whether requests are length-delimited
 * @param {boolean} [responseDelimited=false] Whether responses are length-delimited
 * @returns {rpc.Service} RPC service. Useful where requests and/or responses are streamed.
 */
Service.prototype.create = function create(rpcImpl, requestDelimited, responseDelimited) {
    var rpcService = new rpc.Service(rpcImpl, requestDelimited, responseDelimited);
    for (var i = 0; i < /* initializes */ this.methodsArray.length; ++i) {
        rpcService[util.lcFirst(this._methodsArray[i].resolve().name)] = util.codegen("r","c")("return this.rpcCall(m,q,s,r,c)").eof(util.lcFirst(this._methodsArray[i].name), {
            m: this._methodsArray[i],
            q: this._methodsArray[i].resolvedRequestType.ctor,
            s: this._methodsArray[i].resolvedResponseType.ctor
        });
    }
    return rpcService;
};

},{"./method":23,"./namespace":24,"./rpc":31,"./util":37}],34:[function(require,module,exports){
"use strict";
module.exports = tokenize;

var delimRe        = /[\s{}=;:[\],'"()<>]/g,
    stringDoubleRe = /(?:"([^"\\]*(?:\\.[^"\\]*)*)")/g,
    stringSingleRe = /(?:'([^'\\]*(?:\\.[^'\\]*)*)')/g;

/**
 * Unescapes a string.
 * @param {string} str String to unescape
 * @returns {string} Unescaped string
 * @property {Object.<string,string>} map Special characters map
 * @ignore
 */
function unescape(str) {
    return str.replace(/\\(.?)/g, function($0, $1) {
        switch ($1) {
            case "\\":
            case "":
                return $1;
            default:
                return unescape.map[$1] || "";
        }
    });
}

unescape.map = {
    "0": "\0",
    "r": "\r",
    "n": "\n",
    "t": "\t"
};

tokenize.unescape = unescape;

/**
 * Handle object returned from {@link tokenize}.
 * @typedef {Object.<string,*>} TokenizerHandle
 * @property {function():number} line Gets the current line number
 * @property {function():?string} next Gets the next token and advances (`null` on eof)
 * @property {function():?string} peek Peeks for the next token (`null` on eof)
 * @property {function(string)} push Pushes a token back to the stack
 * @property {function(string, boolean=):boolean} skip Skips a token, returns its presence and advances or, if non-optional and not present, throws
 * @property {function(number=):?string} cmnt Gets the comment on the previous line or the line comment on the specified line, if any
 */

/**
 * Tokenizes the given .proto source and returns an object with useful utility functions.
 * @param {string} source Source contents
 * @returns {TokenizerHandle} Tokenizer handle
 * @property {function(string):string} unescape Unescapes a string
 */
function tokenize(source) {
    /* eslint-disable callback-return */
    source = source.toString();

    var offset = 0,
        length = source.length,
        line = 1,
        commentType = null,
        commentText = null,
        commentLine = 0;

    var stack = [];

    var stringDelim = null;

    /* istanbul ignore next */
    /**
     * Creates an error for illegal syntax.
     * @param {string} subject Subject
     * @returns {Error} Error created
     * @inner
     */
    function illegal(subject) {
        return Error("illegal " + subject + " (line " + line + ")");
    }

    /**
     * Reads a string till its end.
     * @returns {string} String read
     * @inner
     */
    function readString() {
        var re = stringDelim === "'" ? stringSingleRe : stringDoubleRe;
        re.lastIndex = offset - 1;
        var match = re.exec(source);
        if (!match)
            throw illegal("string");
        offset = re.lastIndex;
        push(stringDelim);
        stringDelim = null;
        return unescape(match[1]);
    }

    /**
     * Gets the character at `pos` within the source.
     * @param {number} pos Position
     * @returns {string} Character
     * @inner
     */
    function charAt(pos) {
        return source.charAt(pos);
    }

    /**
     * Sets the current comment text.
     * @param {number} start Start offset
     * @param {number} end End offset
     * @returns {undefined}
     * @inner
     */
    function setComment(start, end) {
        commentType = source.charAt(start++);
        commentLine = line;
        var lines = source
            .substring(start, end)
            .split(/\n/g);
        for (var i = 0; i < lines.length; ++i)
            lines[i] = lines[i].replace(/^ *[*/]+ */, "").trim();
        commentText = lines
            .join("\n")
            .trim();
    }

    /**
     * Obtains the next token.
     * @returns {?string} Next token or `null` on eof
     * @inner
     */
    function next() {
        if (stack.length > 0)
            return stack.shift();
        if (stringDelim)
            return readString();
        var repeat,
            prev,
            curr,
            start,
            isComment;
        do {
            if (offset === length)
                return null;
            repeat = false;
            while (/\s/.test(curr = charAt(offset))) {
                if (curr === "\n")
                    ++line;
                if (++offset === length)
                    return null;
            }
            if (charAt(offset) === "/") {
                if (++offset === length)
                    throw illegal("comment");
                if (charAt(offset) === "/") { // Line
                    isComment = charAt(start = offset + 1) === "/";
                    while (charAt(++offset) !== "\n")
                        if (offset === length)
                            return null;
                    ++offset;
                    if (isComment)
                        setComment(start, offset - 1);
                    ++line;
                    repeat = true;
                } else if ((curr = charAt(offset)) === "*") { /* Block */
                    isComment = charAt(start = offset + 1) === "*";
                    do {
                        if (curr === "\n")
                            ++line;
                        if (++offset === length)
                            throw illegal("comment");
                        prev = curr;
                        curr = charAt(offset);
                    } while (prev !== "*" || curr !== "/");
                    ++offset;
                    if (isComment)
                        setComment(start, offset - 2);
                    repeat = true;
                } else
                    return "/";
            }
        } while (repeat);

        // offset !== length if we got here

        var end = offset;
        delimRe.lastIndex = 0;
        var delim = delimRe.test(charAt(end++));
        if (!delim)
            while (end < length && !delimRe.test(charAt(end)))
                ++end;
        var token = source.substring(offset, offset = end);
        if (token === "\"" || token === "'")
            stringDelim = token;
        return token;
    }

    /**
     * Pushes a token back to the stack.
     * @param {string} token Token
     * @returns {undefined}
     * @inner
     */
    function push(token) {
        stack.push(token);
    }

    /**
     * Peeks for the next token.
     * @returns {?string} Token or `null` on eof
     * @inner
     */
    function peek() {
        if (!stack.length) {
            var token = next();
            if (token === null)
                return null;
            push(token);
        }
        return stack[0];
    }

    /**
     * Skips a token.
     * @param {string} expected Expected token
     * @param {boolean} [optional=false] Whether the token is optional
     * @returns {boolean} `true` when skipped, `false` if not
     * @throws {Error} When a required token is not present
     * @inner
     */
    function skip(expected, optional) {
        var actual = peek(),
            equals = actual === expected;
        if (equals) {
            next();
            return true;
        }
        if (!optional)
            throw illegal("token '" + actual + "', '" + expected + "' expected");
        return false;
    }

    return {
        next: next,
        peek: peek,
        push: push,
        skip: skip,
        line: function() {
            return line;
        },
        cmnt: function(trailingLine) {
            var ret;
            if (trailingLine === undefined)
                ret = commentLine === line - 1 && commentText || null;
            else {
                if (!commentText)
                    peek();
                ret = commentLine === trailingLine && commentType === "/" && commentText || null;
            }
            if (ret) {
                commentType = commentText = null;
                commentLine = 0;
            }
            return ret;
        }
    };
    /* eslint-enable callback-return */
}

},{}],35:[function(require,module,exports){
"use strict";
module.exports = Type;

// extends Namespace
var Namespace = require("./namespace");
((Type.prototype = Object.create(Namespace.prototype)).constructor = Type).className = "Type";

var Enum      = require("./enum"),
    OneOf     = require("./oneof"),
    Field     = require("./field"),
    MapField  = require("./mapfield"),
    Service   = require("./service"),
    Class     = require("./class"),
    Message   = require("./message"),
    Reader    = require("./reader"),
    Writer    = require("./writer"),
    util      = require("./util"),
    encoder   = require("./encoder"),
    decoder   = require("./decoder"),
    verifier  = require("./verifier"),
    converter = require("./converter");

/**
 * Creates a type from JSON.
 * @param {string} name Message name
 * @param {Object.<string,*>} json JSON object
 * @returns {Type} Created message type
 */
Type.fromJSON = function fromJSON(name, json) {
    var type = new Type(name, json.options);
    type.extensions = json.extensions;
    type.reserved = json.reserved;
    var names = Object.keys(json.fields),
        i = 0;
    for (; i < names.length; ++i)
        type.add(
            ( typeof json.fields[names[i]].keyType !== "undefined"
            ? MapField.fromJSON
            : Field.fromJSON )(names[i], json.fields[names[i]])
        );
    if (json.oneofs)
        for (names = Object.keys(json.oneofs), i = 0; i < names.length; ++i)
            type.add(OneOf.fromJSON(names[i], json.oneofs[names[i]]));
    if (json.nested)
        for (names = Object.keys(json.nested), i = 0; i < names.length; ++i) {
            var nested = json.nested[names[i]];
            type.add( // most to least likely
                ( nested.id !== undefined
                ? Field.fromJSON
                : nested.fields !== undefined
                ? Type.fromJSON
                : nested.values !== undefined
                ? Enum.fromJSON
                : nested.methods !== undefined
                ? Service.fromJSON
                : Namespace.fromJSON )(names[i], nested)
            );
        }
    if (json.extensions && json.extensions.length)
        type.extensions = json.extensions;
    if (json.reserved && json.reserved.length)
        type.reserved = json.reserved;
    if (json.group)
        type.group = true;
    return type;
};

/**
 * Constructs a new reflected message type instance.
 * @classdesc Reflected message type.
 * @extends NamespaceBase
 * @constructor
 * @param {string} name Message name
 * @param {Object.<string,*>} [options] Declared options
 */
function Type(name, options) {
    Namespace.call(this, name, options);

    /**
     * Message fields.
     * @type {Object.<string,Field>}
     */
    this.fields = {};  // toJSON, marker

    /**
     * Oneofs declared within this namespace, if any.
     * @type {Object.<string,OneOf>}
     */
    this.oneofs = undefined; // toJSON

    /**
     * Extension ranges, if any.
     * @type {number[][]}
     */
    this.extensions = undefined; // toJSON

    /**
     * Reserved ranges, if any.
     * @type {Array.<number[]|string>}
     */
    this.reserved = undefined; // toJSON

    /*?
     * Whether this type is a legacy group.
     * @type {boolean|undefined}
     */
    this.group = undefined; // toJSON

    /**
     * Cached fields by id.
     * @type {?Object.<number,Field>}
     * @private
     */
    this._fieldsById = null;

    /**
     * Cached fields as an array.
     * @type {?Field[]}
     * @private
     */
    this._fieldsArray = null;

    /**
     * Cached oneofs as an array.
     * @type {?OneOf[]}
     * @private
     */
    this._oneofsArray = null;

    /**
     * Cached constructor.
     * @type {*}
     * @private
     */
    this._ctor = null;
}

Object.defineProperties(Type.prototype, {

    /**
     * Message fields by id.
     * @name Type#fieldsById
     * @type {Object.<number,Field>}
     * @readonly
     */
    fieldsById: {
        get: function() {
            /* istanbul ignore next */
            if (this._fieldsById)
                return this._fieldsById;
            this._fieldsById = {};
            for (var names = Object.keys(this.fields), i = 0; i < names.length; ++i) {
                var field = this.fields[names[i]],
                    id = field.id;

                /* istanbul ignore next */
                if (this._fieldsById[id])
                    throw Error("duplicate id " + id + " in " + this);

                this._fieldsById[id] = field;
            }
            return this._fieldsById;
        }
    },

    /**
     * Fields of this message as an array for iteration.
     * @name Type#fieldsArray
     * @type {Field[]}
     * @readonly
     */
    fieldsArray: {
        get: function() {
            return this._fieldsArray || (this._fieldsArray = util.toArray(this.fields));
        }
    },

    /**
     * Oneofs of this message as an array for iteration.
     * @name Type#oneofsArray
     * @type {OneOf[]}
     * @readonly
     */
    oneofsArray: {
        get: function() {
            return this._oneofsArray || (this._oneofsArray = util.toArray(this.oneofs));
        }
    },

    /**
     * The registered constructor, if any registered, otherwise a generic constructor.
     * @name Type#ctor
     * @type {Class}
     */
    ctor: {
        get: function() {
            return this._ctor || (this._ctor = Class(this).constructor);
        },
        set: function(ctor) {
            if (ctor && !(ctor.prototype instanceof Message))
                throw TypeError("ctor must be a Message constructor");
            if (!ctor.from)
                ctor.from = Message.from;
            this._ctor = ctor;
        }
    }
});

function clearCache(type) {
    type._fieldsById = type._fieldsArray = type._oneofsArray = type._ctor = null;
    delete type.encode;
    delete type.decode;
    delete type.verify;
    return type;
}

/**
 * @override
 */
Type.prototype.toJSON = function toJSON() {
    var inherited = Namespace.prototype.toJSON.call(this);
    return {
        options    : inherited && inherited.options || undefined,
        oneofs     : Namespace.arrayToJSON(this.oneofsArray),
        fields     : Namespace.arrayToJSON(this.fieldsArray.filter(function(obj) { return !obj.declaringField; })) || {},
        extensions : this.extensions && this.extensions.length ? this.extensions : undefined,
        reserved   : this.reserved && this.reserved.length ? this.reserved : undefined,
        group      : this.group || undefined,
        nested     : inherited && inherited.nested || undefined
    };
};

/**
 * @override
 */
Type.prototype.resolveAll = function resolveAll() {
    var fields = this.fieldsArray, i = 0;
    while (i < fields.length)
        fields[i++].resolve();
    var oneofs = this.oneofsArray; i = 0;
    while (i < oneofs.length)
        oneofs[i++].resolve();
    return Namespace.prototype.resolve.call(this);
};

/**
 * @override
 */
Type.prototype.get = function get(name) {
    return this.fields[name]
        || this.oneofs && this.oneofs[name]
        || this.nested && this.nested[name]
        || null;
};

/**
 * Adds a nested object to this type.
 * @param {ReflectionObject} object Nested object to add
 * @returns {Type} `this`
 * @throws {TypeError} If arguments are invalid
 * @throws {Error} If there is already a nested object with this name or, if a field, when there is already a field with this id
 */
Type.prototype.add = function add(object) {

    if (this.get(object.name))
        throw Error("duplicate name '" + object.name + "' in " + this);

    if (object instanceof Field && object.extend === undefined) {
        // NOTE: Extension fields aren't actual fields on the declaring type, but nested objects.
        // The root object takes care of adding distinct sister-fields to the respective extended
        // type instead.

        // avoids calling the getter if not absolutely necessary because it's called quite frequently
        if (this._fieldsById ? /* istanbul ignore next */ this._fieldsById[object.id] : this.fieldsById[object.id])
            throw Error("duplicate id " + object.id + " in " + this);
        if (this.isReservedId(object.id))
            throw Error("id " + object.id + " is reserved in " + this);
        if (this.isReservedName(object.name))
            throw Error("name '" + object.name + "' is reserved in " + this);
        
        if (object.parent)
            object.parent.remove(object);
        this.fields[object.name] = object;
        object.message = this;
        object.onAdd(this);
        return clearCache(this);
    }
    if (object instanceof OneOf) {
        if (!this.oneofs)
            this.oneofs = {};
        this.oneofs[object.name] = object;
        object.onAdd(this);
        return clearCache(this);
    }
    return Namespace.prototype.add.call(this, object);
};

/**
 * Removes a nested object from this type.
 * @param {ReflectionObject} object Nested object to remove
 * @returns {Type} `this`
 * @throws {TypeError} If arguments are invalid
 * @throws {Error} If `object` is not a member of this type
 */
Type.prototype.remove = function remove(object) {
    if (object instanceof Field && object.extend === undefined) {
        // See Type#add for the reason why extension fields are excluded here.
        /* istanbul ignore next */
        if (!this.fields || this.fields[object.name] !== object)
            throw Error(object + " is not a member of " + this);
        delete this.fields[object.name];
        object.parent = null;
        object.onRemove(this);
        return clearCache(this);
    }
    if (object instanceof OneOf) {
        /* istanbul ignore next */
        if (!this.oneofs || this.oneofs[object.name] !== object)
            throw Error(object + " is not a member of " + this);
        delete this.oneofs[object.name];
        object.parent = null;
        object.onRemove(this);
        return clearCache(this);
    }
    return Namespace.prototype.remove.call(this, object);
};

/**
 * Tests if the specified id is reserved.
 * @param {number} id Id to test
 * @returns {boolean} `true` if reserved, otherwise `false`
 */
Type.prototype.isReservedId = function isReservedId(id) {
    if (this.reserved)
        for (var i = 0; i < this.reserved.length; ++i)
            if (typeof this.reserved[i] !== "string" && this.reserved[i][0] <= id && this.reserved[i][1] >= id)
                return true;
    return false;
};

/**
 * Tests if the specified name is reserved.
 * @param {string} name Name to test
 * @returns {boolean} `true` if reserved, otherwise `false`
 */
Type.prototype.isReservedName = function isReservedName(name) {
    if (this.reserved)
        for (var i = 0; i < this.reserved.length; ++i)
            if (this.reserved[i] === name)
                return true;
    return false;
};

/**
 * Creates a new message of this type using the specified properties.
 * @param {Object.<string,*>} [properties] Properties to set
 * @returns {Message} Runtime message
 */
Type.prototype.create = function create(properties) {
    return new this.ctor(properties);
};

/**
 * Sets up {@link Type#encode|encode}, {@link Type#decode|decode} and {@link Type#verify|verify}.
 * @returns {Type} `this`
 */
Type.prototype.setup = function setup() {
    // Sets up everything at once so that the prototype chain does not have to be re-evaluated
    // multiple times (V8, soft-deopt prototype-check).
    var fullName = this.fullName,
        types    = [];
    for (var i = 0; i < /* initializes */ this.fieldsArray.length; ++i)
        types.push(this._fieldsArray[i].resolve().resolvedType);
    this.encode = encoder(this).eof(fullName + "$encode", {
        Writer : Writer,
        types  : types,
        util   : util
    });
    this.decode = decoder(this).eof(fullName + "$decode", {
        Reader : Reader,
        types  : types,
        util   : util
    });
    this.verify = verifier(this).eof(fullName + "$verify", {
        types : types,
        util  : util
    });
    this.fromObject = this.from = converter.fromObject(this).eof(fullName + "$fromObject", {
        types : types,
        util  : util
    });
    this.toObject = converter.toObject(this).eof(fullName + "$toObject", {
        types : types,
        util  : util
    });
    return this;
};

/**
 * Encodes a message of this type.
 * @param {Message|Object} message Message instance or plain object
 * @param {Writer} [writer] Writer to encode to
 * @returns {Writer} writer
 */
Type.prototype.encode = function encode_setup(message, writer) {
    return this.setup().encode(message, writer); // overrides this method
};

/**
 * Encodes a message of this type preceeded by its byte length as a varint.
 * @param {Message|Object} message Message instance or plain object
 * @param {Writer} [writer] Writer to encode to
 * @returns {Writer} writer
 */
Type.prototype.encodeDelimited = function encodeDelimited(message, writer) {
    return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
};

/**
 * Decodes a message of this type.
 * @param {Reader|Uint8Array} reader Reader or buffer to decode from
 * @param {number} [length] Length of the message, if known beforehand
 * @returns {Message} Decoded message
 */
Type.prototype.decode = function decode_setup(reader, length) {
    return this.setup().decode(reader, length); // overrides this method
};

/**
 * Decodes a message of this type preceeded by its byte length as a varint.
 * @param {Reader|Uint8Array} reader Reader or buffer to decode from
 * @returns {Message} Decoded message
 */
Type.prototype.decodeDelimited = function decodeDelimited(reader) {
    if (!(reader instanceof Reader))
        reader = Reader.create(reader);
    return this.decode(reader, reader.uint32());
};

/**
 * Verifies that field values are valid and that required fields are present.
 * @param {Message|Object} message Message to verify
 * @returns {?string} `null` if valid, otherwise the reason why it is not
 */
Type.prototype.verify = function verify_setup(message) {
    return this.setup().verify(message); // overrides this method
};

/**
 * Creates a new message of this type from a plain object. Also converts values to their respective internal types.
 * @param {Object.<string,*>} object Plain object
 * @returns {Message} Message instance
 */
Type.prototype.fromObject = function fromObject(object) {
    return this.setup().fromObject(object);
};

/**
 * Creates a new message of this type from a plain object. Also converts values to their respective internal types.
 * This is an alias of {@link Type#fromObject}.
 * @function
 * @param {Object.<string,*>} object Plain object
 * @returns {Message} Message instance
 */
Type.prototype.from = Type.prototype.fromObject;

/**
 * Conversion options as used by {@link Type#toObject} and {@link Message.toObject}.
 * @typedef ConversionOptions
 * @type {Object}
 * @property {*} [longs] Long conversion type.
 * Valid values are `String` and `Number` (the global types).
 * Defaults to copy the present value, which is a possibly unsafe number without and a {@link Long} with a long library.
 * @property {*} [enums] Enum value conversion type.
 * Only valid value is `String` (the global type).
 * Defaults to copy the present value, which is the numeric id.
 * @property {*} [bytes] Bytes value conversion type.
 * Valid values are `Array` and (a base64 encoded) `String` (the global types).
 * Defaults to copy the present value, which usually is a Buffer under node and an Uint8Array in the browser.
 * @property {boolean} [defaults=false] Also sets default values on the resulting object
 * @property {boolean} [arrays=false] Sets empty arrays for missing repeated fields even if `defaults=false`
 * @property {boolean} [objects=false] Sets empty objects for missing map fields even if `defaults=false`
 */

/**
 * Creates a plain object from a message of this type. Also converts values to other types if specified.
 * @param {Message} message Message instance
 * @param {ConversionOptions} [options] Conversion options
 * @returns {Object.<string,*>} Plain object
 */
Type.prototype.toObject = function toObject(message, options) {
    return this.setup().toObject(message, options);
};

},{"./class":11,"./converter":13,"./decoder":14,"./encoder":15,"./enum":16,"./field":17,"./mapfield":21,"./message":22,"./namespace":24,"./oneof":26,"./reader":28,"./service":33,"./util":37,"./verifier":40,"./writer":41}],36:[function(require,module,exports){
"use strict";

/**
 * Common type constants.
 * @namespace
 */
var types = exports;

var util = require("./util");

var s = [
    "double",   // 0
    "float",    // 1
    "int32",    // 2
    "uint32",   // 3
    "sint32",   // 4
    "fixed32",  // 5
    "sfixed32", // 6
    "int64",    // 7
    "uint64",   // 8
    "sint64",   // 9
    "fixed64",  // 10
    "sfixed64", // 11
    "bool",     // 12
    "string",   // 13
    "bytes"     // 14
];

function bake(values, offset) {
    var i = 0, o = {};
    offset |= 0;
    while (i < values.length) o[s[i + offset]] = values[i++];
    return o;
}

/**
 * Basic type wire types.
 * @type {Object.<string,number>}
 * @property {number} double=1 Fixed64 wire type
 * @property {number} float=5 Fixed32 wire type
 * @property {number} int32=0 Varint wire type
 * @property {number} uint32=0 Varint wire type
 * @property {number} sint32=0 Varint wire type
 * @property {number} fixed32=5 Fixed32 wire type
 * @property {number} sfixed32=5 Fixed32 wire type
 * @property {number} int64=0 Varint wire type
 * @property {number} uint64=0 Varint wire type
 * @property {number} sint64=0 Varint wire type
 * @property {number} fixed64=1 Fixed64 wire type
 * @property {number} sfixed64=1 Fixed64 wire type
 * @property {number} bool=0 Varint wire type
 * @property {number} string=2 Ldelim wire type
 * @property {number} bytes=2 Ldelim wire type
 */
types.basic = bake([
    /* double   */ 1,
    /* float    */ 5,
    /* int32    */ 0,
    /* uint32   */ 0,
    /* sint32   */ 0,
    /* fixed32  */ 5,
    /* sfixed32 */ 5,
    /* int64    */ 0,
    /* uint64   */ 0,
    /* sint64   */ 0,
    /* fixed64  */ 1,
    /* sfixed64 */ 1,
    /* bool     */ 0,
    /* string   */ 2,
    /* bytes    */ 2
]);

/**
 * Basic type defaults.
 * @type {Object.<string,*>}
 * @property {number} double=0 Double default
 * @property {number} float=0 Float default
 * @property {number} int32=0 Int32 default
 * @property {number} uint32=0 Uint32 default
 * @property {number} sint32=0 Sint32 default
 * @property {number} fixed32=0 Fixed32 default
 * @property {number} sfixed32=0 Sfixed32 default
 * @property {number} int64=0 Int64 default
 * @property {number} uint64=0 Uint64 default
 * @property {number} sint64=0 Sint32 default
 * @property {number} fixed64=0 Fixed64 default
 * @property {number} sfixed64=0 Sfixed64 default
 * @property {boolean} bool=false Bool default
 * @property {string} string="" String default
 * @property {Array.<number>} bytes=Array(0) Bytes default
 * @property {Message} message=null Message default
 */
types.defaults = bake([
    /* double   */ 0,
    /* float    */ 0,
    /* int32    */ 0,
    /* uint32   */ 0,
    /* sint32   */ 0,
    /* fixed32  */ 0,
    /* sfixed32 */ 0,
    /* int64    */ 0,
    /* uint64   */ 0,
    /* sint64   */ 0,
    /* fixed64  */ 0,
    /* sfixed64 */ 0,
    /* bool     */ false,
    /* string   */ "",
    /* bytes    */ util.emptyArray,
    /* message  */ null
]);

/**
 * Basic long type wire types.
 * @type {Object.<string,number>}
 * @property {number} int64=0 Varint wire type
 * @property {number} uint64=0 Varint wire type
 * @property {number} sint64=0 Varint wire type
 * @property {number} fixed64=1 Fixed64 wire type
 * @property {number} sfixed64=1 Fixed64 wire type
 */
types.long = bake([
    /* int64    */ 0,
    /* uint64   */ 0,
    /* sint64   */ 0,
    /* fixed64  */ 1,
    /* sfixed64 */ 1
], 7);

/**
 * Allowed types for map keys with their associated wire type.
 * @type {Object.<string,number>}
 * @property {number} int32=0 Varint wire type
 * @property {number} uint32=0 Varint wire type
 * @property {number} sint32=0 Varint wire type
 * @property {number} fixed32=5 Fixed32 wire type
 * @property {number} sfixed32=5 Fixed32 wire type
 * @property {number} int64=0 Varint wire type
 * @property {number} uint64=0 Varint wire type
 * @property {number} sint64=0 Varint wire type
 * @property {number} fixed64=1 Fixed64 wire type
 * @property {number} sfixed64=1 Fixed64 wire type
 * @property {number} bool=0 Varint wire type
 * @property {number} string=2 Ldelim wire type
 */
types.mapKey = bake([
    /* int32    */ 0,
    /* uint32   */ 0,
    /* sint32   */ 0,
    /* fixed32  */ 5,
    /* sfixed32 */ 5,
    /* int64    */ 0,
    /* uint64   */ 0,
    /* sint64   */ 0,
    /* fixed64  */ 1,
    /* sfixed64 */ 1,
    /* bool     */ 0,
    /* string   */ 2
], 2);

/**
 * Allowed types for packed repeated fields with their associated wire type.
 * @type {Object.<string,number>}
 * @property {number} double=1 Fixed64 wire type
 * @property {number} float=5 Fixed32 wire type
 * @property {number} int32=0 Varint wire type
 * @property {number} uint32=0 Varint wire type
 * @property {number} sint32=0 Varint wire type
 * @property {number} fixed32=5 Fixed32 wire type
 * @property {number} sfixed32=5 Fixed32 wire type
 * @property {number} int64=0 Varint wire type
 * @property {number} uint64=0 Varint wire type
 * @property {number} sint64=0 Varint wire type
 * @property {number} fixed64=1 Fixed64 wire type
 * @property {number} sfixed64=1 Fixed64 wire type
 * @property {number} bool=0 Varint wire type
 */
types.packed = bake([
    /* double   */ 1,
    /* float    */ 5,
    /* int32    */ 0,
    /* uint32   */ 0,
    /* sint32   */ 0,
    /* fixed32  */ 5,
    /* sfixed32 */ 5,
    /* int64    */ 0,
    /* uint64   */ 0,
    /* sint64   */ 0,
    /* fixed64  */ 1,
    /* sfixed64 */ 1,
    /* bool     */ 0
]);

},{"./util":37}],37:[function(require,module,exports){
"use strict";

/**
 * Various utility functions.
 * @namespace
 */
var util = module.exports = require("./util/minimal");

util.codegen = require("@protobufjs/codegen");
util.fetch   = require("@protobufjs/fetch");
util.path    = require("@protobufjs/path");

/**
 * Node's fs module if available.
 * @type {Object.<string,*>}
 */
util.fs = util.inquire("fs");

/**
 * Converts an object's values to an array.
 * @param {Object.<string,*>} object Object to convert
 * @returns {Array.<*>} Converted array
 */
util.toArray = function toArray(object) {
    var array = [];
    if (object)
        for (var keys = Object.keys(object), i = 0; i < keys.length; ++i)
            array.push(object[keys[i]]);
    return array;
};

/**
 * Returns a safe property accessor for the specified properly name.
 * @param {string} prop Property name
 * @returns {string} Safe accessor
 */
util.safeProp = function safeProp(prop) {
    return "[\"" + prop.replace(/\\/g, "\\\\").replace(/"/g, "\\\"") + "\"]";
};

/**
 * Converts the first character of a string to upper case.
 * @param {string} str String to convert
 * @returns {string} Converted string
 */
util.ucFirst = function ucFirst(str) {
    return str.charAt(0).toUpperCase() + str.substring(1);
};

},{"./util/minimal":39,"@protobufjs/codegen":3,"@protobufjs/fetch":5,"@protobufjs/path":7}],38:[function(require,module,exports){
"use strict";
module.exports = LongBits;

var util = require("../util/minimal");

/**
 * Any compatible Long instance.
 * 
 * This is a minimal stand-alone definition of a Long instance. The actual type is that exported by long.js.
 * @typedef Long
 * @type {Object}
 * @property {number} low Low bits
 * @property {number} high High bits
 * @property {boolean} unsigned Whether unsigned or not
 */

/**
 * Constructs new long bits.
 * @classdesc Helper class for working with the low and high bits of a 64 bit value.
 * @memberof util
 * @constructor
 * @param {number} lo Low 32 bits, unsigned
 * @param {number} hi High 32 bits, unsigned
 */
function LongBits(lo, hi) {

    // note that the casts below are theoretically unnecessary as of today, but older statically
    // generated converter code might still call the ctor with signed 32bits. kept for compat.

    /**
     * Low bits.
     * @type {number}
     */
    this.lo = lo >>> 0;

    /**
     * High bits.
     * @type {number}
     */
    this.hi = hi >>> 0;
}

/**
 * Zero bits.
 * @memberof util.LongBits
 * @type {util.LongBits}
 */
var zero = LongBits.zero = new LongBits(0, 0);

zero.toNumber = function() { return 0; };
zero.zzEncode = zero.zzDecode = function() { return this; };
zero.length = function() { return 1; };

/**
 * Zero hash.
 * @memberof util.LongBits
 * @type {string}
 */
var zeroHash = LongBits.zeroHash = "\0\0\0\0\0\0\0\0";

/**
 * Constructs new long bits from the specified number.
 * @param {number} value Value
 * @returns {util.LongBits} Instance
 */
LongBits.fromNumber = function fromNumber(value) {
    if (value === 0)
        return zero;
    var sign = value < 0;
    if (sign)
        value = -value;
    var lo = value >>> 0,
        hi = (value - lo) / 4294967296 >>> 0; 
    if (sign) {
        hi = ~hi >>> 0;
        lo = ~lo >>> 0;
        if (++lo > 4294967295) {
            lo = 0;
            if (++hi > 4294967295)
                hi = 0;
        }
    }
    return new LongBits(lo, hi);
};

/**
 * Constructs new long bits from a number, long or string.
 * @param {Long|number|string} value Value
 * @returns {util.LongBits} Instance
 */
LongBits.from = function from(value) {
    if (typeof value === "number")
        return LongBits.fromNumber(value);
    if (util.isString(value)) {
        /* istanbul ignore else */
        if (util.Long)
            value = util.Long.fromString(value);
        else
            return LongBits.fromNumber(parseInt(value, 10));
    }
    return value.low || value.high ? new LongBits(value.low >>> 0, value.high >>> 0) : zero;
};

/**
 * Converts this long bits to a possibly unsafe JavaScript number.
 * @param {boolean} [unsigned=false] Whether unsigned or not
 * @returns {number} Possibly unsafe number
 */
LongBits.prototype.toNumber = function toNumber(unsigned) {
    if (!unsigned && this.hi >>> 31) {
        var lo = ~this.lo + 1 >>> 0,
            hi = ~this.hi     >>> 0;
        if (!lo)
            hi = hi + 1 >>> 0;
        return -(lo + hi * 4294967296);
    }
    return this.lo + this.hi * 4294967296;
};

/**
 * Converts this long bits to a long.
 * @param {boolean} [unsigned=false] Whether unsigned or not
 * @returns {Long} Long
 */
LongBits.prototype.toLong = function toLong(unsigned) {
    return util.Long
        ? new util.Long(this.lo | 0, this.hi | 0, Boolean(unsigned))
        /* istanbul ignore next */
        : { low: this.lo | 0, high: this.hi | 0, unsigned: Boolean(unsigned) };
};

var charCodeAt = String.prototype.charCodeAt;

/**
 * Constructs new long bits from the specified 8 characters long hash.
 * @param {string} hash Hash
 * @returns {util.LongBits} Bits
 */
LongBits.fromHash = function fromHash(hash) {
    if (hash === zeroHash)
        return zero;
    return new LongBits(
        ( charCodeAt.call(hash, 0)
        | charCodeAt.call(hash, 1) << 8
        | charCodeAt.call(hash, 2) << 16
        | charCodeAt.call(hash, 3) << 24) >>> 0
    ,
        ( charCodeAt.call(hash, 4)
        | charCodeAt.call(hash, 5) << 8
        | charCodeAt.call(hash, 6) << 16
        | charCodeAt.call(hash, 7) << 24) >>> 0
    );
};

/**
 * Converts this long bits to a 8 characters long hash.
 * @returns {string} Hash
 */
LongBits.prototype.toHash = function toHash() {
    return String.fromCharCode(
        this.lo        & 255,
        this.lo >>> 8  & 255,
        this.lo >>> 16 & 255,
        this.lo >>> 24      ,
        this.hi        & 255,
        this.hi >>> 8  & 255,
        this.hi >>> 16 & 255,
        this.hi >>> 24
    );
};

/**
 * Zig-zag encodes this long bits.
 * @returns {util.LongBits} `this`
 */
LongBits.prototype.zzEncode = function zzEncode() {
    var mask =   this.hi >> 31;
    this.hi  = ((this.hi << 1 | this.lo >>> 31) ^ mask) >>> 0;
    this.lo  = ( this.lo << 1                   ^ mask) >>> 0;
    return this;
};

/**
 * Zig-zag decodes this long bits.
 * @returns {util.LongBits} `this`
 */
LongBits.prototype.zzDecode = function zzDecode() {
    var mask = -(this.lo & 1);
    this.lo  = ((this.lo >>> 1 | this.hi << 31) ^ mask) >>> 0;
    this.hi  = ( this.hi >>> 1                  ^ mask) >>> 0;
    return this;
};

/**
 * Calculates the length of this longbits when encoded as a varint.
 * @returns {number} Length
 */
LongBits.prototype.length = function length() {
    var part0 =  this.lo,
        part1 = (this.lo >>> 28 | this.hi << 4) >>> 0,
        part2 =  this.hi >>> 24;
    return part2 === 0
         ? part1 === 0
           ? part0 < 16384
             ? part0 < 128 ? 1 : 2
             : part0 < 2097152 ? 3 : 4
           : part1 < 16384
             ? part1 < 128 ? 5 : 6
             : part1 < 2097152 ? 7 : 8
         : part2 < 128 ? 9 : 10;
};

},{"../util/minimal":39}],39:[function(require,module,exports){
(function (global){
"use strict";
var util = exports;

// used to return a Promise where callback is omitted
util.asPromise = require("@protobufjs/aspromise");

// converts to / from base64 encoded strings
util.base64 = require("@protobufjs/base64");

// base class of rpc.Service
util.EventEmitter = require("@protobufjs/eventemitter");

// requires modules optionally and hides the call from bundlers
util.inquire = require("@protobufjs/inquire");

// convert to / from utf8 encoded strings
util.utf8 = require("@protobufjs/utf8");

// provides a node-like buffer pool in the browser
util.pool = require("@protobufjs/pool");

// utility to work with the low and high bits of a 64 bit value
util.LongBits = require("./longbits");

/**
 * An immuable empty array.
 * @memberof util
 * @type {Array.<*>}
 */
util.emptyArray = Object.freeze ? Object.freeze([]) : /* istanbul ignore next */ []; // used on prototypes

/**
 * An immutable empty object.
 * @type {Object}
 */
util.emptyObject = Object.freeze ? Object.freeze({}) : /* istanbul ignore next */ {}; // used on prototypes

/**
 * Whether running within node or not.
 * @memberof util
 * @type {boolean}
 */
util.isNode = Boolean(global.process && global.process.versions && global.process.versions.node);

/**
 * Tests if the specified value is an integer.
 * @function
 * @param {*} value Value to test
 * @returns {boolean} `true` if the value is an integer
 */
util.isInteger = Number.isInteger || /* istanbul ignore next */ function isInteger(value) {
    return typeof value === "number" && isFinite(value) && Math.floor(value) === value;
};

/**
 * Tests if the specified value is a string.
 * @param {*} value Value to test
 * @returns {boolean} `true` if the value is a string
 */
util.isString = function isString(value) {
    return typeof value === "string" || value instanceof String;
};

/**
 * Tests if the specified value is a non-null object.
 * @param {*} value Value to test
 * @returns {boolean} `true` if the value is a non-null object
 */
util.isObject = function isObject(value) {
    return value && typeof value === "object";
};

/**
 * Node's Buffer class if available.
 * @type {?function(new: Buffer)}
 */
util.Buffer = (function() {
    try {
        var Buffer = util.inquire("buffer").Buffer;
        // refuse to use non-node buffers if not explicitly assigned (perf reasons):
        return Buffer.prototype.utf8Write ? Buffer : /* istanbul ignore next */ null;
    } catch (e) {
        /* istanbul ignore next */
        return null;
    }
})();

/**
 * Internal alias of or polyfull for Buffer.from.
 * @type {?function}
 * @param {string|number[]} value Value
 * @param {string} [encoding] Encoding if value is a string
 * @returns {Uint8Array}
 * @private
 */
util._Buffer_from = null;

/**
 * Internal alias of or polyfill for Buffer.allocUnsafe.
 * @type {?function}
 * @param {number} size Buffer size
 * @returns {Uint8Array}
 * @private
 */
util._Buffer_allocUnsafe = null;

/**
 * Creates a new buffer of whatever type supported by the environment.
 * @param {number|number[]} [sizeOrArray=0] Buffer size or number array
 * @returns {Uint8Array|Buffer} Buffer
 */
util.newBuffer = function newBuffer(sizeOrArray) {
    /* istanbul ignore next */
    return typeof sizeOrArray === "number"
        ? util.Buffer
            ? util._Buffer_allocUnsafe(sizeOrArray)
            : new util.Array(sizeOrArray)
        : util.Buffer
            ? util._Buffer_from(sizeOrArray)
            : typeof Uint8Array === "undefined"
                ? sizeOrArray
                : new Uint8Array(sizeOrArray);
};

/**
 * Array implementation used in the browser. `Uint8Array` if supported, otherwise `Array`.
 * @type {?function(new: Uint8Array, *)}
 */
util.Array = typeof Uint8Array !== "undefined" ? Uint8Array /* istanbul ignore next */ : Array;

/**
 * Long.js's Long class if available.
 * @type {?function(new: Long)}
 */
util.Long = /* istanbul ignore next */ global.dcodeIO && /* istanbul ignore next */ global.dcodeIO.Long || util.inquire("long");

/**
 * Converts a number or long to an 8 characters long hash string.
 * @param {Long|number} value Value to convert
 * @returns {string} Hash
 */
util.longToHash = function longToHash(value) {
    return value
        ? util.LongBits.from(value).toHash()
        : util.LongBits.zeroHash;
};

/**
 * Converts an 8 characters long hash string to a long or number.
 * @param {string} hash Hash
 * @param {boolean} [unsigned=false] Whether unsigned or not
 * @returns {Long|number} Original value
 */
util.longFromHash = function longFromHash(hash, unsigned) {
    var bits = util.LongBits.fromHash(hash);
    if (util.Long)
        return util.Long.fromBits(bits.lo, bits.hi, unsigned);
    return bits.toNumber(Boolean(unsigned));
};

/**
 * Merges the properties of the source object into the destination object.
 * @param {Object.<string,*>} dst Destination object
 * @param {Object.<string,*>} src Source object
 * @param {boolean} [ifNotSet=false] Merges only if the key is not already set
 * @returns {Object.<string,*>} Destination object
 */
util.merge = function merge(dst, src, ifNotSet) { // used by converters
    for (var keys = Object.keys(src), i = 0; i < keys.length; ++i)
        if (dst[keys[i]] === undefined || !ifNotSet)
            dst[keys[i]] = src[keys[i]];
    return dst;
};

/**
 * Converts the first character of a string to lower case.
 * @param {string} str String to convert
 * @returns {string} Converted string
 */
util.lcFirst = function lcFirst(str) {
    return str.charAt(0).toLowerCase() + str.substring(1);
};

/**
 * Builds a getter for a oneof's present field name.
 * @param {string[]} fieldNames Field names
 * @returns {function():string|undefined} Unbound getter
 */
util.oneOfGetter = function getOneOf(fieldNames) {
    var fieldMap = {};
    for (var i = 0; i < fieldNames.length; ++i)
        fieldMap[fieldNames[i]] = 1;

    /**
     * @returns {string|undefined} Set field name, if any
     * @this Object
     * @ignore
     */
    return function() { // eslint-disable-line consistent-return
        for (var keys = Object.keys(this), i = keys.length - 1; i > -1; --i)
            if (fieldMap[keys[i]] === 1 && this[keys[i]] !== undefined && this[keys[i]] !== null)
                return keys[i];
    };
};

/**
 * Builds a setter for a oneof's present field name.
 * @param {string[]} fieldNames Field names
 * @returns {function(?string):undefined} Unbound setter
 */
util.oneOfSetter = function setOneOf(fieldNames) {

    /**
     * @param {string} name Field name
     * @returns {undefined}
     * @this Object
     * @ignore
     */
    return function(name) {
        for (var i = 0; i < fieldNames.length; ++i)
            if (fieldNames[i] !== name)
                delete this[fieldNames[i]];
    };
};

/**
 * Lazily resolves fully qualified type names against the specified root.
 * @param {Root} root Root instanceof
 * @param {Object.<number,string|ReflectionObject>} lazyTypes Type names
 * @returns {undefined}
 */
util.lazyResolve = function lazyResolve(root, lazyTypes) {
    for (var i = 0; i < lazyTypes.length; ++i) {
        for (var keys = Object.keys(lazyTypes[i]), j = 0; j < keys.length; ++j) {
            var path = lazyTypes[i][keys[j]].split("."),
                ptr  = root;
            while (path.length)
                ptr = ptr[path.shift()];
            lazyTypes[i][keys[j]] = ptr;
        }
    }
};

/**
 * Default conversion options used for toJSON implementations. Converts longs, enums and bytes to strings.
 * @type {ConversionOptions}
 */
util.toJSONOptions = {
    longs: String,
    enums: String,
    bytes: String
};

util._configure = function() {
    var Buffer = util.Buffer;
    /* istanbul ignore if */
    if (!Buffer) {
        util._Buffer_from = util._Buffer_allocUnsafe = null;
        return;
    }
    // because node 4.x buffers are incompatible & immutable
    // see: https://github.com/dcodeIO/protobuf.js/pull/665
    util._Buffer_from = Buffer.from !== Uint8Array.from && Buffer.from ||
        /* istanbul ignore next */
        function Buffer_from(value, encoding) {
            return new Buffer(value, encoding);
        };
    util._Buffer_allocUnsafe = Buffer.allocUnsafe ||
        /* istanbul ignore next */
        function Buffer_allocUnsafe(size) {
            return new Buffer(size);
        };
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./longbits":38,"@protobufjs/aspromise":1,"@protobufjs/base64":2,"@protobufjs/eventemitter":4,"@protobufjs/inquire":6,"@protobufjs/pool":8,"@protobufjs/utf8":9}],40:[function(require,module,exports){
"use strict";
module.exports = verifier;

var Enum      = require("./enum"),
    util      = require("./util");

function invalid(field, expected) {
    return field.name + ": " + expected + (field.repeated && expected !== "array" ? "[]" : field.map && expected !== "object" ? "{k:"+field.keyType+"}" : "") + " expected";
}

/**
 * Generates a partial value verifier.
 * @param {Codegen} gen Codegen instance
 * @param {Field} field Reflected field
 * @param {number} fieldIndex Field index
 * @param {string} ref Variable reference
 * @returns {Codegen} Codegen instance
 * @ignore
 */
function genVerifyValue(gen, field, fieldIndex, ref) {
    /* eslint-disable no-unexpected-multiline */
    if (field.resolvedType) {
        if (field.resolvedType instanceof Enum) { gen
            ("switch(%s){", ref)
                ("default:")
                    ("return%j", invalid(field, "enum value"));
            for (var keys = Object.keys(field.resolvedType.values), j = 0; j < keys.length; ++j) gen
                ("case %d:", field.resolvedType.values[keys[j]]);
            gen
                    ("break")
            ("}");
        } else gen
            ("var e=types[%d].verify(%s);", fieldIndex, ref)
            ("if(e)")
                ("return%j+e", field.name + ".");
    } else {
        switch (field.type) {
            case "int32":
            case "uint32":
            case "sint32":
            case "fixed32":
            case "sfixed32": gen
                ("if(!util.isInteger(%s))", ref)
                    ("return%j", invalid(field, "integer"));
                break;
            case "int64":
            case "uint64":
            case "sint64":
            case "fixed64":
            case "sfixed64": gen
                ("if(!util.isInteger(%s)&&!(%s&&util.isInteger(%s.low)&&util.isInteger(%s.high)))", ref, ref, ref, ref)
                    ("return%j", invalid(field, "integer|Long"));
                break;
            case "float":
            case "double": gen
                ("if(typeof %s!==\"number\")", ref)
                    ("return%j", invalid(field, "number"));
                break;
            case "bool": gen
                ("if(typeof %s!==\"boolean\")", ref)
                    ("return%j", invalid(field, "boolean"));
                break;
            case "string": gen
                ("if(!util.isString(%s))", ref)
                    ("return%j", invalid(field, "string"));
                break;
            case "bytes": gen
                ("if(!(%s&&typeof %s.length===\"number\"||util.isString(%s)))", ref, ref, ref)
                    ("return%j", invalid(field, "buffer"));
                break;
        }
    }
    return gen;
    /* eslint-enable no-unexpected-multiline */
}

/**
 * Generates a partial key verifier.
 * @param {Codegen} gen Codegen instance
 * @param {Field} field Reflected field
 * @param {string} ref Variable reference
 * @returns {Codegen} Codegen instance
 * @ignore
 */
function genVerifyKey(gen, field, ref) {
    /* eslint-disable no-unexpected-multiline */
    switch (field.keyType) {
        case "int32":
        case "uint32":
        case "sint32":
        case "fixed32":
        case "sfixed32": gen
            ("if(!/^-?(?:0|[1-9][0-9]*)$/.test(%s))", ref) // it's important not to use any literals here that might be confused with short variable names by pbjs' beautify
                ("return%j", invalid(field, "integer key"));
            break;
        case "int64":
        case "uint64":
        case "sint64":
        case "fixed64":
        case "sfixed64": gen
            ("if(!/^(?:[\\x00-\\xff]{8}|-?(?:0|[1-9][0-9]*))$/.test(%s))", ref) // see comment above: x is ok, d is not
                ("return%j", invalid(field, "integer|Long key"));
            break;
        case "bool": gen
            ("if(!/^true|false|0|1$/.test(%s))", ref)
                ("return%j", invalid(field, "boolean key"));
            break;
    }
    return gen;
    /* eslint-enable no-unexpected-multiline */
}

/**
 * Generates a verifier specific to the specified message type.
 * @param {Type} mtype Message type
 * @returns {Codegen} Codegen instance
 */
function verifier(mtype) {
    /* eslint-disable no-unexpected-multiline */

    var gen = util.codegen("m")
    ("if(typeof m!==\"object\"||m===null)")
        ("return%j", "object expected");

    for (var i = 0; i < /* initializes */ mtype.fieldsArray.length; ++i) {
        var field = mtype._fieldsArray[i].resolve(),
            ref   = "m" + util.safeProp(field.name);

        // map fields
        if (field.map) { gen
            ("if(%s!==undefined){", ref)
                ("if(!util.isObject(%s))", ref)
                    ("return%j", invalid(field, "object"))
                ("var k=Object.keys(%s)", ref)
                ("for(var i=0;i<k.length;++i){");
                    genVerifyKey(gen, field, "k[i]");
                    genVerifyValue(gen, field, i, ref + "[k[i]]")
                ("}")
            ("}");

        // repeated fields
        } else if (field.repeated) { gen
            ("if(%s!==undefined){", ref)
                ("if(!Array.isArray(%s))", ref)
                    ("return%j", invalid(field, "array"))
                ("for(var i=0;i<%s.length;++i){", ref);
                    genVerifyValue(gen, field, i, ref + "[i]")
                ("}")
            ("}");

        // required or present fields
        } else {
            if (!field.required) {
                if (field.resolvedType && !(field.resolvedType instanceof Enum)) gen
            ("if(%s!==undefined&&%s!==null){", ref, ref);
                else gen
            ("if(%s!==undefined){", ref);
            }
                genVerifyValue(gen, field, i, ref);
            if (!field.required) gen
            ("}");
        }
    } return gen
    ("return null");
    /* eslint-enable no-unexpected-multiline */
}
},{"./enum":16,"./util":37}],41:[function(require,module,exports){
"use strict";
module.exports = Writer;

var util      = require("./util/minimal");

var BufferWriter; // cyclic

var LongBits  = util.LongBits,
    base64    = util.base64,
    utf8      = util.utf8;

/**
 * Constructs a new writer operation instance.
 * @classdesc Scheduled writer operation.
 * @constructor
 * @param {function(*, Uint8Array, number)} fn Function to call
 * @param {number} len Value byte length
 * @param {*} val Value to write
 * @ignore
 */
function Op(fn, len, val) {

    /**
     * Function to call.
     * @type {function(Uint8Array, number, *)}
     */
    this.fn = fn;

    /**
     * Value byte length.
     * @type {number}
     */
    this.len = len;

    /**
     * Next operation.
     * @type {Writer.Op|undefined}
     */
    this.next = undefined;

    /**
     * Value to write.
     * @type {*}
     */
    this.val = val; // type varies
}

/* istanbul ignore next */
function noop() {} // eslint-disable-line no-empty-function

/**
 * Constructs a new writer state instance.
 * @classdesc Copied writer state.
 * @memberof Writer
 * @constructor
 * @param {Writer} writer Writer to copy state from
 * @private
 * @ignore
 */
function State(writer) {

    /**
     * Current head.
     * @type {Writer.Op}
     */
    this.head = writer.head;

    /**
     * Current tail.
     * @type {Writer.Op}
     */
    this.tail = writer.tail;

    /**
     * Current buffer length.
     * @type {number}
     */
    this.len = writer.len;

    /**
     * Next state.
     * @type {?State}
     */
    this.next = writer.states;
}

/**
 * Constructs a new writer instance.
 * @classdesc Wire format writer using `Uint8Array` if available, otherwise `Array`.
 * @constructor
 */
function Writer() {

    /**
     * Current length.
     * @type {number}
     */
    this.len = 0;

    /**
     * Operations head.
     * @type {Object}
     */
    this.head = new Op(noop, 0, 0);

    /**
     * Operations tail
     * @type {Object}
     */
    this.tail = this.head;

    /**
     * Linked forked states.
     * @type {?Object}
     */
    this.states = null;

    // When a value is written, the writer calculates its byte length and puts it into a linked
    // list of operations to perform when finish() is called. This both allows us to allocate
    // buffers of the exact required size and reduces the amount of work we have to do compared
    // to first calculating over objects and then encoding over objects. In our case, the encoding
    // part is just a linked list walk calling operations with already prepared values.
}

/**
 * Creates a new writer.
 * @function
 * @returns {BufferWriter|Writer} A {@link BufferWriter} when Buffers are supported, otherwise a {@link Writer}
 */
Writer.create = util.Buffer
    ? function create_buffer_setup() {
        return (Writer.create = function create_buffer() {
            return new BufferWriter();
        })();
    }
    /* istanbul ignore next */
    : function create_array() {
        return new Writer();
    };

/**
 * Allocates a buffer of the specified size.
 * @param {number} size Buffer size
 * @returns {Uint8Array} Buffer
 */
Writer.alloc = function alloc(size) {
    return new util.Array(size);
};

// Use Uint8Array buffer pool in the browser, just like node does with buffers
/* istanbul ignore else */
if (util.Array !== Array)
    Writer.alloc = util.pool(Writer.alloc, util.Array.prototype.subarray);

/**
 * Pushes a new operation to the queue.
 * @param {function(Uint8Array, number, *)} fn Function to call
 * @param {number} len Value byte length
 * @param {number} val Value to write
 * @returns {Writer} `this`
 */
Writer.prototype.push = function push(fn, len, val) {
    this.tail = this.tail.next = new Op(fn, len, val);
    this.len += len;
    return this;
};

function writeByte(val, buf, pos) {
    buf[pos] = val & 255;
}

function writeVarint32(val, buf, pos) {
    while (val > 127) {
        buf[pos++] = val & 127 | 128;
        val >>>= 7;
    }
    buf[pos] = val;
}

/**
 * Constructs a new varint writer operation instance.
 * @classdesc Scheduled varint writer operation.
 * @extends Op
 * @constructor
 * @param {number} len Value byte length
 * @param {number} val Value to write
 * @ignore
 */
function VarintOp(len, val) {
    this.len = len;
    this.next = undefined;
    this.val = val;
}

VarintOp.prototype = Object.create(Op.prototype);
VarintOp.prototype.fn = writeVarint32;

/**
 * Writes an unsigned 32 bit value as a varint.
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer.prototype.uint32 = function write_uint32(value) {
    // here, the call to this.push has been inlined and a varint specific Op subclass is used.
    // uint32 is by far the most frequently used operation and benefits significantly from this.
    this.len += (this.tail = this.tail.next = new VarintOp(
        (value = value >>> 0)
                < 128       ? 1
        : value < 16384     ? 2
        : value < 2097152   ? 3
        : value < 268435456 ? 4
        :                     5,
    value)).len;
    return this;
};

/**
 * Writes a signed 32 bit value as a varint.
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer.prototype.int32 = function write_int32(value) {
    return value < 0
        ? this.push(writeVarint64, 10, LongBits.fromNumber(value)) // 10 bytes per spec
        : this.uint32(value);
};

/**
 * Writes a 32 bit value as a varint, zig-zag encoded.
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer.prototype.sint32 = function write_sint32(value) {
    return this.uint32((value << 1 ^ value >> 31) >>> 0);
};

function writeVarint64(val, buf, pos) {
    while (val.hi) {
        buf[pos++] = val.lo & 127 | 128;
        val.lo = (val.lo >>> 7 | val.hi << 25) >>> 0;
        val.hi >>>= 7;
    }
    while (val.lo > 127) {
        buf[pos++] = val.lo & 127 | 128;
        val.lo = val.lo >>> 7;
    }
    buf[pos++] = val.lo;
}

/**
 * Writes an unsigned 64 bit value as a varint.
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */
Writer.prototype.uint64 = function write_uint64(value) {
    var bits = LongBits.from(value);
    return this.push(writeVarint64, bits.length(), bits);
};

/**
 * Writes a signed 64 bit value as a varint.
 * @function
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */
Writer.prototype.int64 = Writer.prototype.uint64;

/**
 * Writes a signed 64 bit value as a varint, zig-zag encoded.
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */
Writer.prototype.sint64 = function write_sint64(value) {
    var bits = LongBits.from(value).zzEncode();
    return this.push(writeVarint64, bits.length(), bits);
};

/**
 * Writes a boolish value as a varint.
 * @param {boolean} value Value to write
 * @returns {Writer} `this`
 */
Writer.prototype.bool = function write_bool(value) {
    return this.push(writeByte, 1, value ? 1 : 0);
};

function writeFixed32(val, buf, pos) {
    buf[pos++] =  val         & 255;
    buf[pos++] =  val >>> 8   & 255;
    buf[pos++] =  val >>> 16  & 255;
    buf[pos  ] =  val >>> 24;
}

/**
 * Writes an unsigned 32 bit value as fixed 32 bits.
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer.prototype.fixed32 = function write_fixed32(value) {
    return this.push(writeFixed32, 4, value >>> 0);
};

/**
 * Writes a signed 32 bit value as fixed 32 bits.
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer.prototype.sfixed32 = Writer.prototype.fixed32;

/**
 * Writes an unsigned 64 bit value as fixed 64 bits.
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */
Writer.prototype.fixed64 = function write_fixed64(value) {
    var bits = LongBits.from(value);
    return this.push(writeFixed32, 4, bits.lo).push(writeFixed32, 4, bits.hi);
};

/**
 * Writes a signed 64 bit value as fixed 64 bits.
 * @function
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */
Writer.prototype.sfixed64 = Writer.prototype.fixed64;

var writeFloat = typeof Float32Array !== "undefined"
    ? (function() {
        var f32 = new Float32Array(1),
            f8b = new Uint8Array(f32.buffer);
        f32[0] = -0;
        return f8b[3] // already le?
            ? function writeFloat_f32(val, buf, pos) {
                f32[0] = val;
                buf[pos++] = f8b[0];
                buf[pos++] = f8b[1];
                buf[pos++] = f8b[2];
                buf[pos  ] = f8b[3];
            }
            /* istanbul ignore next */
            : function writeFloat_f32_le(val, buf, pos) {
                f32[0] = val;
                buf[pos++] = f8b[3];
                buf[pos++] = f8b[2];
                buf[pos++] = f8b[1];
                buf[pos  ] = f8b[0];
            };
    })()
    /* istanbul ignore next */
    : function writeFloat_ieee754(value, buf, pos) {
        var sign = value < 0 ? 1 : 0;
        if (sign)
            value = -value;
        if (value === 0)
            writeFixed32(1 / value > 0 ? /* positive */ 0 : /* negative 0 */ 2147483648, buf, pos);
        else if (isNaN(value))
            writeFixed32(2147483647, buf, pos);
        else if (value > 3.4028234663852886e+38) // +-Infinity
            writeFixed32((sign << 31 | 2139095040) >>> 0, buf, pos);
        else if (value < 1.1754943508222875e-38) // denormal
            writeFixed32((sign << 31 | Math.round(value / 1.401298464324817e-45)) >>> 0, buf, pos);
        else {
            var exponent = Math.floor(Math.log(value) / Math.LN2),
                mantissa = Math.round(value * Math.pow(2, -exponent) * 8388608) & 8388607;
            writeFixed32((sign << 31 | exponent + 127 << 23 | mantissa) >>> 0, buf, pos);
        }
    };

/**
 * Writes a float (32 bit).
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer.prototype.float = function write_float(value) {
    return this.push(writeFloat, 4, value);
};

var writeDouble = typeof Float64Array !== "undefined"
    ? (function() {
        var f64 = new Float64Array(1),
            f8b = new Uint8Array(f64.buffer);
        f64[0] = -0;
        return f8b[7] // already le?
            ? function writeDouble_f64(val, buf, pos) {
                f64[0] = val;
                buf[pos++] = f8b[0];
                buf[pos++] = f8b[1];
                buf[pos++] = f8b[2];
                buf[pos++] = f8b[3];
                buf[pos++] = f8b[4];
                buf[pos++] = f8b[5];
                buf[pos++] = f8b[6];
                buf[pos  ] = f8b[7];
            }
            /* istanbul ignore next */
            : function writeDouble_f64_le(val, buf, pos) {
                f64[0] = val;
                buf[pos++] = f8b[7];
                buf[pos++] = f8b[6];
                buf[pos++] = f8b[5];
                buf[pos++] = f8b[4];
                buf[pos++] = f8b[3];
                buf[pos++] = f8b[2];
                buf[pos++] = f8b[1];
                buf[pos  ] = f8b[0];
            };
    })()
    /* istanbul ignore next */
    : function writeDouble_ieee754(value, buf, pos) {
        var sign = value < 0 ? 1 : 0;
        if (sign)
            value = -value;
        if (value === 0) {
            writeFixed32(0, buf, pos);
            writeFixed32(1 / value > 0 ? /* positive */ 0 : /* negative 0 */ 2147483648, buf, pos + 4);
        } else if (isNaN(value)) {
            writeFixed32(4294967295, buf, pos);
            writeFixed32(2147483647, buf, pos + 4);
        } else if (value > 1.7976931348623157e+308) { // +-Infinity
            writeFixed32(0, buf, pos);
            writeFixed32((sign << 31 | 2146435072) >>> 0, buf, pos + 4);
        } else {
            var mantissa;
            if (value < 2.2250738585072014e-308) { // denormal
                mantissa = value / 5e-324;
                writeFixed32(mantissa >>> 0, buf, pos);
                writeFixed32((sign << 31 | mantissa / 4294967296) >>> 0, buf, pos + 4);
            } else {
                var exponent = Math.floor(Math.log(value) / Math.LN2);
                if (exponent === 1024)
                    exponent = 1023;
                mantissa = value * Math.pow(2, -exponent);
                writeFixed32(mantissa * 4503599627370496 >>> 0, buf, pos);
                writeFixed32((sign << 31 | exponent + 1023 << 20 | mantissa * 1048576 & 1048575) >>> 0, buf, pos + 4);
            }
        }
    };

/**
 * Writes a double (64 bit float).
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer.prototype.double = function write_double(value) {
    return this.push(writeDouble, 8, value);
};

var writeBytes = util.Array.prototype.set
    ? function writeBytes_set(val, buf, pos) {
        buf.set(val, pos); // also works for plain array values
    }
    /* istanbul ignore next */
    : function writeBytes_for(val, buf, pos) {
        for (var i = 0; i < val.length; ++i)
            buf[pos + i] = val[i];
    };

/**
 * Writes a sequence of bytes.
 * @param {Uint8Array|string} value Buffer or base64 encoded string to write
 * @returns {Writer} `this`
 */
Writer.prototype.bytes = function write_bytes(value) {
    var len = value.length >>> 0;
    if (!len)
        return this.push(writeByte, 1, 0);
    if (util.isString(value)) {
        var buf = Writer.alloc(len = base64.length(value));
        base64.decode(value, buf, 0);
        value = buf;
    }
    return this.uint32(len).push(writeBytes, len, value);
};

/**
 * Writes a string.
 * @param {string} value Value to write
 * @returns {Writer} `this`
 */
Writer.prototype.string = function write_string(value) {
    var len = utf8.length(value);
    return len
        ? this.uint32(len).push(utf8.write, len, value)
        : this.push(writeByte, 1, 0);
};

/**
 * Forks this writer's state by pushing it to a stack.
 * Calling {@link Writer#reset|reset} or {@link Writer#ldelim|ldelim} resets the writer to the previous state.
 * @returns {Writer} `this`
 */
Writer.prototype.fork = function fork() {
    this.states = new State(this);
    this.head = this.tail = new Op(noop, 0, 0);
    this.len = 0;
    return this;
};

/**
 * Resets this instance to the last state.
 * @returns {Writer} `this`
 */
Writer.prototype.reset = function reset() {
    if (this.states) {
        this.head   = this.states.head;
        this.tail   = this.states.tail;
        this.len    = this.states.len;
        this.states = this.states.next;
    } else {
        this.head = this.tail = new Op(noop, 0, 0);
        this.len  = 0;
    }
    return this;
};

/**
 * Resets to the last state and appends the fork state's current write length as a varint followed by its operations.
 * @returns {Writer} `this`
 */
Writer.prototype.ldelim = function ldelim() {
    var head = this.head,
        tail = this.tail,
        len  = this.len;
    this.reset().uint32(len);
    if (len) {
        this.tail.next = head.next; // skip noop
        this.tail = tail;
        this.len += len;
    }
    return this;
};

/**
 * Finishes the write operation.
 * @returns {Uint8Array} Finished buffer
 */
Writer.prototype.finish = function finish() {
    var head = this.head.next, // skip noop
        buf  = this.constructor.alloc(this.len),
        pos  = 0;
    while (head) {
        head.fn(head.val, buf, pos);
        pos += head.len;
        head = head.next;
    }
    // this.head = this.tail = null;
    return buf;
};

Writer._configure = function(BufferWriter_) {
    BufferWriter = BufferWriter_;
};

},{"./util/minimal":39}],42:[function(require,module,exports){
"use strict";
module.exports = BufferWriter;

// extends Writer
var Writer = require("./writer");
(BufferWriter.prototype = Object.create(Writer.prototype)).constructor = BufferWriter;

var util = require("./util/minimal");

var Buffer = util.Buffer;

/**
 * Constructs a new buffer writer instance.
 * @classdesc Wire format writer using node buffers.
 * @extends Writer
 * @constructor
 */
function BufferWriter() {
    Writer.call(this);
}

/**
 * Allocates a buffer of the specified size.
 * @param {number} size Buffer size
 * @returns {Buffer} Buffer
 */
BufferWriter.alloc = function alloc_buffer(size) {
    return (BufferWriter.alloc = util._Buffer_allocUnsafe)(size);
};

var writeBytesBuffer = Buffer && Buffer.prototype instanceof Uint8Array && Buffer.prototype.set.name === "set"
    ? function writeBytesBuffer_set(val, buf, pos) {
        buf.set(val, pos); // faster than copy (requires node >= 4 where Buffers extend Uint8Array and set is properly inherited)
                           // also works for plain array values
    }
    /* istanbul ignore next */
    : function writeBytesBuffer_copy(val, buf, pos) {
        if (val.copy) // Buffer values
            val.copy(buf, pos, 0, val.length);
        else for (var i = 0; i < val.length;) // plain array values
            buf[pos++] = val[i++];
    };

/**
 * @override
 */
BufferWriter.prototype.bytes = function write_bytes_buffer(value) {
    if (util.isString(value))
        value = util._Buffer_from(value, "base64");
    var len = value.length >>> 0;
    this.uint32(len);
    if (len)
        this.push(writeBytesBuffer, len, value);
    return this;
};

function writeStringBuffer(val, buf, pos) {
    if (val.length < 40) // plain js is faster for short strings (probably due to redundant assertions)
        util.utf8.write(val, buf, pos);
    else
        buf.utf8Write(val, pos);
}

/**
 * @override
 */
BufferWriter.prototype.string = function write_string_buffer(value) {
    var len = Buffer.byteLength(value);
    this.uint32(len);
    if (len)
        this.push(writeStringBuffer, len, value);
    return this;
};


/**
 * Finishes the write operation.
 * @name BufferWriter#finish
 * @function
 * @returns {Buffer} Finished buffer
 */

},{"./util/minimal":39,"./writer":41}],43:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _root = require('./models/root');

var _root2 = _interopRequireDefault(_root);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var CothorityProtobuf = function () {
  function CothorityProtobuf() {
    _classCallCheck(this, CothorityProtobuf);

    this.root = _root2.default;
  }

  /**
   * Encode a model to be transmitted over websocket
   * @param name
   * @param fields
   * @returns {*|Buffer|Uint8Array}
   */


  _createClass(CothorityProtobuf, [{
    key: 'encodeMessage',
    value: function encodeMessage(name, fields) {
      var model = this.getModel(name);

      // Create the message with the model
      var msg = model.create(fields);

      // Encode the message in a BufferArray
      return model.encode(msg).finish();
    }

    /**
     * Decode a message coming from a websocket
     * @param name
     * @param buffer
     */

  }, {
    key: 'decodeMessage',
    value: function decodeMessage(name, buffer) {
      var model = this.getModel(name);
      return model.decode(buffer);
    }

    /**
     * Return the protobuf loaded model
     * @param name
     * @returns {ReflectionObject|?ReflectionObject|string}
     */

  }, {
    key: 'getModel',
    value: function getModel(name) {
      return this.root.lookup('cothority.' + name);
    }
  }]);

  return CothorityProtobuf;
}();

exports.default = CothorityProtobuf;

},{"./models/root":53}],44:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _cothorityProtobuf = require('./cothority-protobuf');

var _cothorityProtobuf2 = _interopRequireDefault(_cothorityProtobuf);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var CothorityMessages = function (_CothorityProtobuf) {
  _inherits(CothorityMessages, _CothorityProtobuf);

  function CothorityMessages() {
    _classCallCheck(this, CothorityMessages);

    return _possibleConstructorReturn(this, (CothorityMessages.__proto__ || Object.getPrototypeOf(CothorityMessages)).apply(this, arguments));
  }

  _createClass(CothorityMessages, [{
    key: 'createSignatureRequest',


    /**
     * Create an encoded message to make a sign request to a cothority node
     * @param message to sign stored in a Uint8Array
     * @param servers list of ServerIdentity
     * @returns {*|Buffer|Uint8Array}
     */
    value: function createSignatureRequest(message, servers) {
      if (!(message instanceof Uint8Array)) {
        throw new Error("message must be a instance of Uint8Array");
      }

      var fields = {
        message: message,
        roster: {
          list: servers
        }
      };

      return this.encodeMessage('SignatureRequest', fields);
    }

    /**
     * Return the decoded response
     * @param response
     * @returns {*}
     */

  }, {
    key: 'decodeSignatureResponse',
    value: function decodeSignatureResponse(response) {
      response = new Uint8Array(response);

      return this.decodeMessage('SignatureResponse', response);
    }

    /**
     * Return the decoded response
     * @param response
     * @returns {*}
     */

  }, {
    key: 'decodeStatusResponse',
    value: function decodeStatusResponse(response) {
      response = new Uint8Array(response);

      return this.decodeMessage('StatusResponse', response);
    }

    /**
     * Create an encoded message to make a PinRequest to a cothority node
     * @param pin previously generated by the conode
     * @param publicKey
     * @returns {*|Buffer|Uint8Array}
     */

  }, {
    key: 'createPinRequest',
    value: function createPinRequest(pin, publicKey) {
      var fields = {
        pin: pin,
        public: publicKey
      };

      return this.encodeMessage('PinRequest', fields);
    }

    /**
     * Create an encoded message to store configuration information of a given PoP party
     * @param name
     * @param date
     * @param location
     * @param id
     * @param servers
     * @param aggregate
     * @returns {*|Buffer|Uint8Array}
     */

  }, {
    key: 'createStoreConfig',
    value: function createStoreConfig(name, date, location, id, servers, aggregate) {
      var fields = {
        desc: {
          name: name,
          dateTime: date,
          location: location,
          roster: {
            id: id,
            list: servers,
            aggregate: aggregate
          }
        }
      };

      return this.encodeMessage('StoreConfig', fields);
    }

    /**
     * Return the decoded response
     * @param response
     * @returns {*}
     */

  }, {
    key: 'deccdeStoreConfigReply',
    value: function deccdeStoreConfigReply(response) {
      response = new Uint8Array(response);

      return this.decodeMessage('StoreConfigReply', response);
    }

    /**
     * Create an encoded message to finalize on the given descid-popconfig
     * @param descId
     * @param attendees
     * @returns {*|Buffer|Uint8Array}
     */

  }, {
    key: 'createFinalizeRequest',
    value: function createFinalizeRequest(descId, attendees) {
      var fields = {
        descId: descId,
        attendees: attendees
      };

      return this.encodeMessage('FinalizeRequest', fields);
    }

    /**
     * Return the decoded response
     * @param response
     * @returns {*}
     */

  }, {
    key: 'decodeFinalizeResponse',
    value: function decodeFinalizeResponse(response) {
      response = new Uint8Array(response);

      return this.decodeMessage('FinalizeResponse', response);
    }
  }]);

  return CothorityMessages;
}(_cothorityProtobuf2.default);

exports.default = new CothorityMessages();

},{"./cothority-protobuf":43}],45:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _protobufjs = require('protobufjs');

var _protobufjs2 = _interopRequireDefault(_protobufjs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Type = _protobufjs2.default.Type,
    Field = _protobufjs2.default.Field,
    MapField = _protobufjs2.default.MapField;


var StatusResponse = new Type('StatusResponse').add(new MapField('system', 1, 'string', 'Status')).add(new Field('server', 2, 'ServerIdentity'));

exports.default = StatusResponse;

},{"protobufjs":10}],46:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _protobufjs = require('protobufjs');

var _protobufjs2 = _interopRequireDefault(_protobufjs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Type = _protobufjs2.default.Type,
    Field = _protobufjs2.default.Field;


var finalStatement = new Type("FinalStatement").add(new Field('desc', 1, 'popDesc')).add(new Field('attendees', 2, 'bytes')).add(new Field('signature', 3, 'bytes'));

exports.default = finalStatement;

},{"protobufjs":10}],47:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _protobufjs = require('protobufjs');

var _protobufjs2 = _interopRequireDefault(_protobufjs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Type = _protobufjs2.default.Type,
    Field = _protobufjs2.default.Field;


var finalizeRequest = new Type("FinalizeRequest").add(new Field('descId', 1, 'bytes')).add(new Field('attendees', 2, 'bytes'));

exports.default = finalizeRequest;

},{"protobufjs":10}],48:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _protobufjs = require('protobufjs');

var _protobufjs2 = _interopRequireDefault(_protobufjs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Type = _protobufjs2.default.Type,
    Field = _protobufjs2.default.Field;


var finalizeResponse = new Type("FinalizeResponse").add(new Field('final', 1, 'finalStatement'));

exports.default = finalizeResponse;

},{"protobufjs":10}],49:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _protobufjs = require('protobufjs');

var _protobufjs2 = _interopRequireDefault(_protobufjs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Type = _protobufjs2.default.Type,
    Field = _protobufjs2.default.Field;


var pinRequest = new Type("PinRequest").add(new Field('pin', 1, 'string')).add(new Field('public', 2, 'bytes'));

exports.default = pinRequest;

},{"protobufjs":10}],50:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _protobufjs = require('protobufjs');

var _protobufjs2 = _interopRequireDefault(_protobufjs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Type = _protobufjs2.default.Type,
    Field = _protobufjs2.default.Field;


var popDesc = new Type("PopDesc").add(new Field('name', 1, 'string')).add(new Field('dateTime', 2, 'string')).add(new Field('location', 3, 'string')).add(new Field('roster', 4, 'Roster'));

exports.default = popDesc;

},{"protobufjs":10}],51:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _protobufjs = require('protobufjs');

var _protobufjs2 = _interopRequireDefault(_protobufjs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Type = _protobufjs2.default.Type,
    Field = _protobufjs2.default.Field;


var storeConfigReply = new Type("StoreConfigReply").add(new Field('id', 1, 'bytes'));

exports.default = storeConfigReply;

},{"protobufjs":10}],52:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _protobufjs = require('protobufjs');

var _protobufjs2 = _interopRequireDefault(_protobufjs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Type = _protobufjs2.default.Type,
    Field = _protobufjs2.default.Field;


var storeConfig = new Type("StoreConfig").add(new Field('desc', 1, 'popDesc'));

exports.default = storeConfig;

},{"protobufjs":10}],53:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _protobufjs = require('protobufjs');

var _protobufjs2 = _interopRequireDefault(_protobufjs);

var _StatusResponse = require('./StatusResponse');

var _StatusResponse2 = _interopRequireDefault(_StatusResponse);

var _status = require('./status');

var _status2 = _interopRequireDefault(_status);

var _serverIdentity = require('./server-identity');

var _serverIdentity2 = _interopRequireDefault(_serverIdentity);

var _roster = require('./roster');

var _roster2 = _interopRequireDefault(_roster);

var _signatureRequest = require('./signature-request');

var _signatureRequest2 = _interopRequireDefault(_signatureRequest);

var _signatureResponse = require('./signature-response');

var _signatureResponse2 = _interopRequireDefault(_signatureResponse);

var _pinRequest = require('./pop/pin-request');

var _pinRequest2 = _interopRequireDefault(_pinRequest);

var _storeConfig = require('./pop/store-config');

var _storeConfig2 = _interopRequireDefault(_storeConfig);

var _storeConfigReply = require('./pop/store-config-reply');

var _storeConfigReply2 = _interopRequireDefault(_storeConfigReply);

var _finalizeRequest = require('./pop/finalize-request');

var _finalizeRequest2 = _interopRequireDefault(_finalizeRequest);

var _finalizeResponse = require('./pop/finalize-response');

var _finalizeResponse2 = _interopRequireDefault(_finalizeResponse);

var _popDesc = require('./pop/pop-desc');

var _popDesc2 = _interopRequireDefault(_popDesc);

var _finalStatement = require('./pop/final-statement');

var _finalStatement2 = _interopRequireDefault(_finalStatement);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Root = _protobufjs2.default.Root;


var root = new Root();
root.define("cothority").add(_status2.default).add(_serverIdentity2.default).add(_StatusResponse2.default).add(_roster2.default).add(_signatureRequest2.default).add(_signatureResponse2.default).add(_pinRequest2.default).add(_storeConfig2.default).add(_storeConfigReply2.default).add(_finalizeRequest2.default).add(_finalizeResponse2.default).add(_popDesc2.default).add(_finalStatement2.default);

exports.default = root;

},{"./StatusResponse":45,"./pop/final-statement":46,"./pop/finalize-request":47,"./pop/finalize-response":48,"./pop/pin-request":49,"./pop/pop-desc":50,"./pop/store-config":52,"./pop/store-config-reply":51,"./roster":54,"./server-identity":55,"./signature-request":56,"./signature-response":57,"./status":58,"protobufjs":10}],54:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _protobufjs = require('protobufjs');

var _protobufjs2 = _interopRequireDefault(_protobufjs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Type = _protobufjs2.default.Type,
    Field = _protobufjs2.default.Field;


var roster = new Type("Roster").add(new Field('id', 1, 'bytes')).add(new Field('list', 2, 'ServerIdentity', 'repeated')).add(new Field('aggregate', 3, 'bytes'));

exports.default = roster;

},{"protobufjs":10}],55:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _protobufjs = require('protobufjs');

var _protobufjs2 = _interopRequireDefault(_protobufjs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Type = _protobufjs2.default.Type,
    Field = _protobufjs2.default.Field;


var serverIdentity = new Type('ServerIdentity').add(new Field('public', 1, 'bytes')).add(new Field('id', 2, 'bytes')).add(new Field('address', 3, 'string')).add(new Field('description', 4, 'string'));

exports.default = serverIdentity;

},{"protobufjs":10}],56:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _protobufjs = require('protobufjs');

var _protobufjs2 = _interopRequireDefault(_protobufjs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Type = _protobufjs2.default.Type,
    Field = _protobufjs2.default.Field;


var signatureRequest = new Type("SignatureRequest").add(new Field('message', 1, 'bytes')).add(new Field('roster', 2, 'Roster'));

exports.default = signatureRequest;

},{"protobufjs":10}],57:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _protobufjs = require('protobufjs');

var _protobufjs2 = _interopRequireDefault(_protobufjs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Type = _protobufjs2.default.Type,
    Field = _protobufjs2.default.Field;


var signatureResponse = new Type("SignatureResponse").add(new Field('hash', 1, 'bytes', 'required')).add(new Field('signature', 2, 'bytes', 'required'));

exports.default = signatureResponse;

},{"protobufjs":10}],58:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _protobufjs = require('protobufjs');

var _protobufjs2 = _interopRequireDefault(_protobufjs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Type = _protobufjs2.default.Type,
    MapField = _protobufjs2.default.MapField;


var status = new Type('Status').add(new MapField('field', 1, 'string', 'string'));

exports.default = status;

},{"protobufjs":10}]},{},[44])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvQHByb3RvYnVmanMvYXNwcm9taXNlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL0Bwcm90b2J1ZmpzL2Jhc2U2NC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9AcHJvdG9idWZqcy9jb2RlZ2VuL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL0Bwcm90b2J1ZmpzL2V2ZW50ZW1pdHRlci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9AcHJvdG9idWZqcy9mZXRjaC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9AcHJvdG9idWZqcy9pbnF1aXJlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL0Bwcm90b2J1ZmpzL3BhdGgvaW5kZXguanMiLCJub2RlX21vZHVsZXMvQHByb3RvYnVmanMvcG9vbC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9AcHJvdG9idWZqcy91dGY4L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Byb3RvYnVmanMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvcHJvdG9idWZqcy9zcmMvY2xhc3MuanMiLCJub2RlX21vZHVsZXMvcHJvdG9idWZqcy9zcmMvY29tbW9uLmpzIiwibm9kZV9tb2R1bGVzL3Byb3RvYnVmanMvc3JjL2NvbnZlcnRlci5qcyIsIm5vZGVfbW9kdWxlcy9wcm90b2J1ZmpzL3NyYy9kZWNvZGVyLmpzIiwibm9kZV9tb2R1bGVzL3Byb3RvYnVmanMvc3JjL2VuY29kZXIuanMiLCJub2RlX21vZHVsZXMvcHJvdG9idWZqcy9zcmMvZW51bS5qcyIsIm5vZGVfbW9kdWxlcy9wcm90b2J1ZmpzL3NyYy9maWVsZC5qcyIsIm5vZGVfbW9kdWxlcy9wcm90b2J1ZmpzL3NyYy9pbmRleC1saWdodC5qcyIsIm5vZGVfbW9kdWxlcy9wcm90b2J1ZmpzL3NyYy9pbmRleC1taW5pbWFsLmpzIiwibm9kZV9tb2R1bGVzL3Byb3RvYnVmanMvc3JjL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Byb3RvYnVmanMvc3JjL21hcGZpZWxkLmpzIiwibm9kZV9tb2R1bGVzL3Byb3RvYnVmanMvc3JjL21lc3NhZ2UuanMiLCJub2RlX21vZHVsZXMvcHJvdG9idWZqcy9zcmMvbWV0aG9kLmpzIiwibm9kZV9tb2R1bGVzL3Byb3RvYnVmanMvc3JjL25hbWVzcGFjZS5qcyIsIm5vZGVfbW9kdWxlcy9wcm90b2J1ZmpzL3NyYy9vYmplY3QuanMiLCJub2RlX21vZHVsZXMvcHJvdG9idWZqcy9zcmMvb25lb2YuanMiLCJub2RlX21vZHVsZXMvcHJvdG9idWZqcy9zcmMvcGFyc2UuanMiLCJub2RlX21vZHVsZXMvcHJvdG9idWZqcy9zcmMvcmVhZGVyLmpzIiwibm9kZV9tb2R1bGVzL3Byb3RvYnVmanMvc3JjL3JlYWRlcl9idWZmZXIuanMiLCJub2RlX21vZHVsZXMvcHJvdG9idWZqcy9zcmMvcm9vdC5qcyIsIm5vZGVfbW9kdWxlcy9wcm90b2J1ZmpzL3NyYy9ycGMuanMiLCJub2RlX21vZHVsZXMvcHJvdG9idWZqcy9zcmMvcnBjL3NlcnZpY2UuanMiLCJub2RlX21vZHVsZXMvcHJvdG9idWZqcy9zcmMvc2VydmljZS5qcyIsIm5vZGVfbW9kdWxlcy9wcm90b2J1ZmpzL3NyYy90b2tlbml6ZS5qcyIsIm5vZGVfbW9kdWxlcy9wcm90b2J1ZmpzL3NyYy90eXBlLmpzIiwibm9kZV9tb2R1bGVzL3Byb3RvYnVmanMvc3JjL3R5cGVzLmpzIiwibm9kZV9tb2R1bGVzL3Byb3RvYnVmanMvc3JjL3V0aWwuanMiLCJub2RlX21vZHVsZXMvcHJvdG9idWZqcy9zcmMvdXRpbC9sb25nYml0cy5qcyIsIm5vZGVfbW9kdWxlcy9wcm90b2J1ZmpzL3NyYy91dGlsL21pbmltYWwuanMiLCJub2RlX21vZHVsZXMvcHJvdG9idWZqcy9zcmMvdmVyaWZpZXIuanMiLCJub2RlX21vZHVsZXMvcHJvdG9idWZqcy9zcmMvd3JpdGVyLmpzIiwibm9kZV9tb2R1bGVzL3Byb3RvYnVmanMvc3JjL3dyaXRlcl9idWZmZXIuanMiLCJzcmNcXGNvdGhvcml0eS1wcm90b2J1Zi5qcyIsInNyY1xcaW5kZXguanMiLCJzcmNcXG1vZGVsc1xcU3RhdHVzUmVzcG9uc2UuanMiLCJzcmNcXG1vZGVsc1xccG9wXFxmaW5hbC1zdGF0ZW1lbnQuanMiLCJzcmNcXG1vZGVsc1xccG9wXFxmaW5hbGl6ZS1yZXF1ZXN0LmpzIiwic3JjXFxtb2RlbHNcXHBvcFxcZmluYWxpemUtcmVzcG9uc2UuanMiLCJzcmNcXG1vZGVsc1xccG9wXFxwaW4tcmVxdWVzdC5qcyIsInNyY1xcbW9kZWxzXFxwb3BcXHBvcC1kZXNjLmpzIiwic3JjXFxtb2RlbHNcXHBvcFxcc3RvcmUtY29uZmlnLXJlcGx5LmpzIiwic3JjXFxtb2RlbHNcXHBvcFxcc3RvcmUtY29uZmlnLmpzIiwic3JjXFxtb2RlbHNcXHJvb3QuanMiLCJzcmNcXG1vZGVsc1xccm9zdGVyLmpzIiwic3JjXFxtb2RlbHNcXHNlcnZlci1pZGVudGl0eS5qcyIsInNyY1xcbW9kZWxzXFxzaWduYXR1cmUtcmVxdWVzdC5qcyIsInNyY1xcbW9kZWxzXFxzaWduYXR1cmUtcmVzcG9uc2UuanMiLCJzcmNcXG1vZGVsc1xcc3RhdHVzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6R0E7QUFDQTtBQUNBOztBQ0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5TkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOVFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25JQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdFdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdk1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNySkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2x0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOWZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3VkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNySkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdlQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNuTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNqUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcktBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbGpCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7Ozs7OztBQ2pGQTs7Ozs7Ozs7SUFFcUIsaUI7QUFFbkIsK0JBQWM7QUFBQTs7QUFDWixTQUFLLElBQUw7QUFDRDs7QUFFRDs7Ozs7Ozs7OztrQ0FNYyxJLEVBQU0sTSxFQUFRO0FBQzFCLFVBQU0sUUFBUSxLQUFLLFFBQUwsQ0FBYyxJQUFkLENBQWQ7O0FBRUE7QUFDQSxVQUFNLE1BQU0sTUFBTSxNQUFOLENBQWEsTUFBYixDQUFaOztBQUVBO0FBQ0EsYUFBTyxNQUFNLE1BQU4sQ0FBYSxHQUFiLEVBQWtCLE1BQWxCLEVBQVA7QUFDRDs7QUFFRDs7Ozs7Ozs7a0NBS2MsSSxFQUFNLE0sRUFBUTtBQUMxQixVQUFNLFFBQVEsS0FBSyxRQUFMLENBQWMsSUFBZCxDQUFkO0FBQ0EsYUFBTyxNQUFNLE1BQU4sQ0FBYSxNQUFiLENBQVA7QUFDRDs7QUFFRDs7Ozs7Ozs7NkJBS1MsSSxFQUFNO0FBQ2IsYUFBTyxLQUFLLElBQUwsQ0FBVSxNQUFWLGdCQUE4QixJQUE5QixDQUFQO0FBQ0Q7Ozs7OztrQkF2Q2tCLGlCOzs7Ozs7Ozs7OztBQ0ZyQjs7Ozs7Ozs7Ozs7O0lBRU0saUI7Ozs7Ozs7Ozs7Ozs7QUFFSjs7Ozs7OzJDQU11QixPLEVBQVMsTyxFQUFTO0FBQ3ZDLFVBQUksRUFBRSxtQkFBbUIsVUFBckIsQ0FBSixFQUFzQztBQUNwQyxjQUFNLElBQUksS0FBSixDQUFVLDBDQUFWLENBQU47QUFDRDs7QUFFRCxVQUFNLFNBQVM7QUFDYix3QkFEYTtBQUViLGdCQUFRO0FBQ04sZ0JBQU07QUFEQTtBQUZLLE9BQWY7O0FBT0EsYUFBTyxLQUFLLGFBQUwsQ0FBbUIsa0JBQW5CLEVBQXVDLE1BQXZDLENBQVA7QUFDRDs7QUFFRDs7Ozs7Ozs7NENBS3dCLFEsRUFBVTtBQUNoQyxpQkFBVyxJQUFJLFVBQUosQ0FBZSxRQUFmLENBQVg7O0FBRUEsYUFBTyxLQUFLLGFBQUwsQ0FBbUIsbUJBQW5CLEVBQXdDLFFBQXhDLENBQVA7QUFDRDs7QUFFRDs7Ozs7Ozs7eUNBS3FCLFEsRUFBVTtBQUM3QixpQkFBVyxJQUFJLFVBQUosQ0FBZSxRQUFmLENBQVg7O0FBRUEsYUFBTyxLQUFLLGFBQUwsQ0FBbUIsZ0JBQW5CLEVBQXFDLFFBQXJDLENBQVA7QUFDRDs7QUFFQzs7Ozs7Ozs7O3FDQU1lLEcsRUFBSyxTLEVBQVc7QUFDL0IsVUFBTSxTQUFTO0FBQ2IsYUFBSyxHQURRO0FBRWIsZ0JBQVE7QUFGSyxPQUFmOztBQUtBLGFBQU8sS0FBSyxhQUFMLENBQW1CLFlBQW5CLEVBQWlDLE1BQWpDLENBQVA7QUFDRDs7QUFFQzs7Ozs7Ozs7Ozs7OztzQ0FVZ0IsSSxFQUFNLEksRUFBTSxRLEVBQVUsRSxFQUFJLE8sRUFBUyxTLEVBQVc7QUFDOUQsVUFBTSxTQUFTO0FBQ2IsY0FBTTtBQUNKLGdCQUFNLElBREY7QUFFSixvQkFBVSxJQUZOO0FBR0osb0JBQVUsUUFITjtBQUlKLGtCQUFRO0FBQ04sZ0JBQUksRUFERTtBQUVOLGtCQUFNLE9BRkE7QUFHTix1QkFBVztBQUhMO0FBSko7QUFETyxPQUFmOztBQWFBLGFBQU8sS0FBSyxhQUFMLENBQW1CLGFBQW5CLEVBQWtDLE1BQWxDLENBQVA7QUFDRDs7QUFFQzs7Ozs7Ozs7MkNBS3FCLFEsRUFBVTtBQUMvQixpQkFBVyxJQUFJLFVBQUosQ0FBZSxRQUFmLENBQVg7O0FBRUEsYUFBTyxLQUFLLGFBQUwsQ0FBbUIsa0JBQW5CLEVBQXVDLFFBQXZDLENBQVA7QUFDRDs7QUFFQzs7Ozs7Ozs7OzBDQU1vQixNLEVBQVEsUyxFQUFXO0FBQ3ZDLFVBQU0sU0FBUztBQUNiLGdCQUFRLE1BREs7QUFFYixtQkFBVztBQUZFLE9BQWY7O0FBS0EsYUFBTyxLQUFLLGFBQUwsQ0FBbUIsaUJBQW5CLEVBQXNDLE1BQXRDLENBQVA7QUFDRDs7QUFFQzs7Ozs7Ozs7MkNBS3FCLFEsRUFBVTtBQUM3QixpQkFBVyxJQUFJLFVBQUosQ0FBZSxRQUFmLENBQVg7O0FBRUEsYUFBTyxLQUFLLGFBQUwsQ0FBbUIsa0JBQW5CLEVBQXVDLFFBQXZDLENBQVA7QUFDSDs7Ozs7O2tCQUdZLElBQUksaUJBQUosRTs7Ozs7Ozs7O0FDL0hmOzs7Ozs7SUFDTyxJLHdCQUFBLEk7SUFBTSxLLHdCQUFBLEs7SUFBTyxRLHdCQUFBLFE7OztBQUVwQixJQUFNLGlCQUFpQixJQUFJLElBQUosQ0FBUyxnQkFBVCxFQUNwQixHQURvQixDQUNoQixJQUFJLFFBQUosQ0FBYSxRQUFiLEVBQXVCLENBQXZCLEVBQTBCLFFBQTFCLEVBQW9DLFFBQXBDLENBRGdCLEVBRXBCLEdBRm9CLENBRWhCLElBQUksS0FBSixDQUFVLFFBQVYsRUFBb0IsQ0FBcEIsRUFBdUIsZ0JBQXZCLENBRmdCLENBQXZCOztrQkFJZSxjOzs7Ozs7Ozs7QUNQZjs7Ozs7O0lBQ08sSSx3QkFBQSxJO0lBQU0sSyx3QkFBQSxLOzs7QUFFYixJQUFNLGlCQUFpQixJQUFJLElBQUosQ0FBUyxnQkFBVCxFQUNsQixHQURrQixDQUNkLElBQUksS0FBSixDQUFVLE1BQVYsRUFBa0IsQ0FBbEIsRUFBcUIsU0FBckIsQ0FEYyxFQUVsQixHQUZrQixDQUVkLElBQUksS0FBSixDQUFVLFdBQVYsRUFBdUIsQ0FBdkIsRUFBMEIsT0FBMUIsQ0FGYyxFQUdsQixHQUhrQixDQUdkLElBQUksS0FBSixDQUFVLFdBQVYsRUFBdUIsQ0FBdkIsRUFBMEIsT0FBMUIsQ0FIYyxDQUF2Qjs7a0JBTWUsYzs7Ozs7Ozs7O0FDVGY7Ozs7OztJQUNPLEksd0JBQUEsSTtJQUFNLEssd0JBQUEsSzs7O0FBRWIsSUFBTSxrQkFBa0IsSUFBSSxJQUFKLENBQVMsaUJBQVQsRUFDbkIsR0FEbUIsQ0FDZixJQUFJLEtBQUosQ0FBVSxRQUFWLEVBQW9CLENBQXBCLEVBQXVCLE9BQXZCLENBRGUsRUFFbkIsR0FGbUIsQ0FFZixJQUFJLEtBQUosQ0FBVSxXQUFWLEVBQXVCLENBQXZCLEVBQTBCLE9BQTFCLENBRmUsQ0FBeEI7O2tCQUllLGU7Ozs7Ozs7OztBQ1BmOzs7Ozs7SUFDTyxJLHdCQUFBLEk7SUFBTSxLLHdCQUFBLEs7OztBQUViLElBQU0sbUJBQW1CLElBQUksSUFBSixDQUFTLGtCQUFULEVBQ3BCLEdBRG9CLENBQ2hCLElBQUksS0FBSixDQUFVLE9BQVYsRUFBbUIsQ0FBbkIsRUFBc0IsZ0JBQXRCLENBRGdCLENBQXpCOztrQkFHZSxnQjs7Ozs7Ozs7O0FDTmY7Ozs7OztJQUNPLEksd0JBQUEsSTtJQUFNLEssd0JBQUEsSzs7O0FBRWIsSUFBTSxhQUFhLElBQUksSUFBSixDQUFTLFlBQVQsRUFDZCxHQURjLENBQ1YsSUFBSSxLQUFKLENBQVUsS0FBVixFQUFpQixDQUFqQixFQUFvQixRQUFwQixDQURVLEVBRWQsR0FGYyxDQUVWLElBQUksS0FBSixDQUFVLFFBQVYsRUFBb0IsQ0FBcEIsRUFBdUIsT0FBdkIsQ0FGVSxDQUFuQjs7a0JBSWUsVTs7Ozs7Ozs7O0FDUGY7Ozs7OztJQUNPLEksd0JBQUEsSTtJQUFNLEssd0JBQUEsSzs7O0FBRWIsSUFBTSxVQUFVLElBQUksSUFBSixDQUFTLFNBQVQsRUFDWCxHQURXLENBQ1AsSUFBSSxLQUFKLENBQVUsTUFBVixFQUFrQixDQUFsQixFQUFxQixRQUFyQixDQURPLEVBRVgsR0FGVyxDQUVQLElBQUksS0FBSixDQUFVLFVBQVYsRUFBc0IsQ0FBdEIsRUFBeUIsUUFBekIsQ0FGTyxFQUdYLEdBSFcsQ0FHUCxJQUFJLEtBQUosQ0FBVSxVQUFWLEVBQXNCLENBQXRCLEVBQXlCLFFBQXpCLENBSE8sRUFJWCxHQUpXLENBSVAsSUFBSSxLQUFKLENBQVUsUUFBVixFQUFvQixDQUFwQixFQUF1QixRQUF2QixDQUpPLENBQWhCOztrQkFPZSxPOzs7Ozs7Ozs7QUNWZjs7Ozs7O0lBQ08sSSx3QkFBQSxJO0lBQU0sSyx3QkFBQSxLOzs7QUFFYixJQUFNLG1CQUFtQixJQUFJLElBQUosQ0FBUyxrQkFBVCxFQUNwQixHQURvQixDQUNoQixJQUFJLEtBQUosQ0FBVSxJQUFWLEVBQWdCLENBQWhCLEVBQW1CLE9BQW5CLENBRGdCLENBQXpCOztrQkFHZSxnQjs7Ozs7Ozs7O0FDTmY7Ozs7OztJQUNPLEksd0JBQUEsSTtJQUFNLEssd0JBQUEsSzs7O0FBRWIsSUFBTSxjQUFjLElBQUksSUFBSixDQUFTLGFBQVQsRUFDZixHQURlLENBQ1gsSUFBSSxLQUFKLENBQVUsTUFBVixFQUFrQixDQUFsQixFQUFxQixTQUFyQixDQURXLENBQXBCOztrQkFHZSxXOzs7Ozs7Ozs7QUNOZjs7OztBQUdBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7Ozs7SUFkTyxJLHdCQUFBLEk7OztBQWdCUCxJQUFNLE9BQU8sSUFBSSxJQUFKLEVBQWI7QUFDQSxLQUFLLE1BQUwsQ0FBWSxXQUFaLEVBQ0ssR0FETCxtQkFFSyxHQUZMLDJCQUdLLEdBSEwsMkJBSUssR0FKTCxtQkFLSyxHQUxMLDZCQU1LLEdBTkwsOEJBT0ssR0FQTCx1QkFRSyxHQVJMLHdCQVNLLEdBVEwsNkJBVUssR0FWTCw0QkFXSyxHQVhMLDZCQVlLLEdBWkwsb0JBYUssR0FiTDs7a0JBZWUsSTs7Ozs7Ozs7O0FDakNmOzs7Ozs7SUFDTyxJLHdCQUFBLEk7SUFBTSxLLHdCQUFBLEs7OztBQUViLElBQU0sU0FBUyxJQUFJLElBQUosQ0FBUyxRQUFULEVBQ1osR0FEWSxDQUNSLElBQUksS0FBSixDQUFVLElBQVYsRUFBZ0IsQ0FBaEIsRUFBbUIsT0FBbkIsQ0FEUSxFQUVaLEdBRlksQ0FFUixJQUFJLEtBQUosQ0FBVSxNQUFWLEVBQWtCLENBQWxCLEVBQXFCLGdCQUFyQixFQUF1QyxVQUF2QyxDQUZRLEVBR1osR0FIWSxDQUdSLElBQUksS0FBSixDQUFVLFdBQVYsRUFBdUIsQ0FBdkIsRUFBMEIsT0FBMUIsQ0FIUSxDQUFmOztrQkFLZSxNOzs7Ozs7Ozs7QUNSZjs7Ozs7O0lBQ08sSSx3QkFBQSxJO0lBQU0sSyx3QkFBQSxLOzs7QUFFYixJQUFNLGlCQUFpQixJQUFJLElBQUosQ0FBUyxnQkFBVCxFQUNwQixHQURvQixDQUNoQixJQUFJLEtBQUosQ0FBVSxRQUFWLEVBQW9CLENBQXBCLEVBQXVCLE9BQXZCLENBRGdCLEVBRXBCLEdBRm9CLENBRWhCLElBQUksS0FBSixDQUFVLElBQVYsRUFBZ0IsQ0FBaEIsRUFBbUIsT0FBbkIsQ0FGZ0IsRUFHcEIsR0FIb0IsQ0FHaEIsSUFBSSxLQUFKLENBQVUsU0FBVixFQUFxQixDQUFyQixFQUF3QixRQUF4QixDQUhnQixFQUlwQixHQUpvQixDQUloQixJQUFJLEtBQUosQ0FBVSxhQUFWLEVBQXlCLENBQXpCLEVBQTRCLFFBQTVCLENBSmdCLENBQXZCOztrQkFNZSxjOzs7Ozs7Ozs7QUNUZjs7Ozs7O0lBQ08sSSx3QkFBQSxJO0lBQU0sSyx3QkFBQSxLOzs7QUFFYixJQUFNLG1CQUFtQixJQUFJLElBQUosQ0FBUyxrQkFBVCxFQUN0QixHQURzQixDQUNsQixJQUFJLEtBQUosQ0FBVSxTQUFWLEVBQXFCLENBQXJCLEVBQXdCLE9BQXhCLENBRGtCLEVBRXRCLEdBRnNCLENBRWxCLElBQUksS0FBSixDQUFVLFFBQVYsRUFBb0IsQ0FBcEIsRUFBdUIsUUFBdkIsQ0FGa0IsQ0FBekI7O2tCQUllLGdCOzs7Ozs7Ozs7QUNQZjs7Ozs7O0lBQ08sSSx3QkFBQSxJO0lBQU0sSyx3QkFBQSxLOzs7QUFFYixJQUFNLG9CQUFvQixJQUFJLElBQUosQ0FBUyxtQkFBVCxFQUN2QixHQUR1QixDQUNuQixJQUFJLEtBQUosQ0FBVSxNQUFWLEVBQWtCLENBQWxCLEVBQXFCLE9BQXJCLEVBQThCLFVBQTlCLENBRG1CLEVBRXZCLEdBRnVCLENBRW5CLElBQUksS0FBSixDQUFVLFdBQVYsRUFBdUIsQ0FBdkIsRUFBMEIsT0FBMUIsRUFBbUMsVUFBbkMsQ0FGbUIsQ0FBMUI7O2tCQUllLGlCOzs7Ozs7Ozs7QUNQZjs7Ozs7O0lBQ08sSSx3QkFBQSxJO0lBQU0sUSx3QkFBQSxROzs7QUFFYixJQUFNLFNBQVMsSUFBSSxJQUFKLENBQVMsUUFBVCxFQUNaLEdBRFksQ0FDUixJQUFJLFFBQUosQ0FBYSxPQUFiLEVBQXNCLENBQXRCLEVBQXlCLFFBQXpCLEVBQW1DLFFBQW5DLENBRFEsQ0FBZjs7a0JBR2UsTSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcInVzZSBzdHJpY3RcIjtcclxubW9kdWxlLmV4cG9ydHMgPSBhc1Byb21pc2U7XHJcblxyXG4vKipcclxuICogUmV0dXJucyBhIHByb21pc2UgZnJvbSBhIG5vZGUtc3R5bGUgY2FsbGJhY2sgZnVuY3Rpb24uXHJcbiAqIEBtZW1iZXJvZiB1dGlsXHJcbiAqIEBwYXJhbSB7ZnVuY3Rpb24oP0Vycm9yLCAuLi4qKX0gZm4gRnVuY3Rpb24gdG8gY2FsbFxyXG4gKiBAcGFyYW0geyp9IGN0eCBGdW5jdGlvbiBjb250ZXh0XHJcbiAqIEBwYXJhbSB7Li4uKn0gcGFyYW1zIEZ1bmN0aW9uIGFyZ3VtZW50c1xyXG4gKiBAcmV0dXJucyB7UHJvbWlzZTwqPn0gUHJvbWlzaWZpZWQgZnVuY3Rpb25cclxuICovXHJcbmZ1bmN0aW9uIGFzUHJvbWlzZShmbiwgY3R4LyosIHZhcmFyZ3MgKi8pIHtcclxuICAgIHZhciBwYXJhbXMgPSBbXTtcclxuICAgIGZvciAodmFyIGkgPSAyOyBpIDwgYXJndW1lbnRzLmxlbmd0aDspXHJcbiAgICAgICAgcGFyYW1zLnB1c2goYXJndW1lbnRzW2krK10pO1xyXG4gICAgdmFyIHBlbmRpbmcgPSB0cnVlO1xyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIGFzUHJvbWlzZUV4ZWN1dG9yKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgIHBhcmFtcy5wdXNoKGZ1bmN0aW9uIGFzUHJvbWlzZUNhbGxiYWNrKGVyci8qLCB2YXJhcmdzICovKSB7XHJcbiAgICAgICAgICAgIGlmIChwZW5kaW5nKSB7XHJcbiAgICAgICAgICAgICAgICBwZW5kaW5nID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICBpZiAoZXJyKVxyXG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBbXTtcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7KVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBhcmdzLnB1c2goYXJndW1lbnRzW2krK10pO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUuYXBwbHkobnVsbCwgYXJncyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBmbi5hcHBseShjdHggfHwgdGhpcywgcGFyYW1zKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1pbnZhbGlkLXRoaXNcclxuICAgICAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgICAgICAgaWYgKHBlbmRpbmcpIHtcclxuICAgICAgICAgICAgICAgIHBlbmRpbmcgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbn1cclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4vKipcclxuICogQSBtaW5pbWFsIGJhc2U2NCBpbXBsZW1lbnRhdGlvbiBmb3IgbnVtYmVyIGFycmF5cy5cclxuICogQG1lbWJlcm9mIHV0aWxcclxuICogQG5hbWVzcGFjZVxyXG4gKi9cclxudmFyIGJhc2U2NCA9IGV4cG9ydHM7XHJcblxyXG4vKipcclxuICogQ2FsY3VsYXRlcyB0aGUgYnl0ZSBsZW5ndGggb2YgYSBiYXNlNjQgZW5jb2RlZCBzdHJpbmcuXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBzdHJpbmcgQmFzZTY0IGVuY29kZWQgc3RyaW5nXHJcbiAqIEByZXR1cm5zIHtudW1iZXJ9IEJ5dGUgbGVuZ3RoXHJcbiAqL1xyXG5iYXNlNjQubGVuZ3RoID0gZnVuY3Rpb24gbGVuZ3RoKHN0cmluZykge1xyXG4gICAgdmFyIHAgPSBzdHJpbmcubGVuZ3RoO1xyXG4gICAgaWYgKCFwKVxyXG4gICAgICAgIHJldHVybiAwO1xyXG4gICAgdmFyIG4gPSAwO1xyXG4gICAgd2hpbGUgKC0tcCAlIDQgPiAxICYmIHN0cmluZy5jaGFyQXQocCkgPT09IFwiPVwiKVxyXG4gICAgICAgICsrbjtcclxuICAgIHJldHVybiBNYXRoLmNlaWwoc3RyaW5nLmxlbmd0aCAqIDMpIC8gNCAtIG47XHJcbn07XHJcblxyXG4vLyBCYXNlNjQgZW5jb2RpbmcgdGFibGVcclxudmFyIGI2NCA9IG5ldyBBcnJheSg2NCk7XHJcblxyXG4vLyBCYXNlNjQgZGVjb2RpbmcgdGFibGVcclxudmFyIHM2NCA9IG5ldyBBcnJheSgxMjMpO1xyXG5cclxuLy8gNjUuLjkwLCA5Ny4uMTIyLCA0OC4uNTcsIDQzLCA0N1xyXG5mb3IgKHZhciBpID0gMDsgaSA8IDY0OylcclxuICAgIHM2NFtiNjRbaV0gPSBpIDwgMjYgPyBpICsgNjUgOiBpIDwgNTIgPyBpICsgNzEgOiBpIDwgNjIgPyBpIC0gNCA6IGkgLSA1OSB8IDQzXSA9IGkrKztcclxuXHJcbi8qKlxyXG4gKiBFbmNvZGVzIGEgYnVmZmVyIHRvIGEgYmFzZTY0IGVuY29kZWQgc3RyaW5nLlxyXG4gKiBAcGFyYW0ge1VpbnQ4QXJyYXl9IGJ1ZmZlciBTb3VyY2UgYnVmZmVyXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBzdGFydCBTb3VyY2Ugc3RhcnRcclxuICogQHBhcmFtIHtudW1iZXJ9IGVuZCBTb3VyY2UgZW5kXHJcbiAqIEByZXR1cm5zIHtzdHJpbmd9IEJhc2U2NCBlbmNvZGVkIHN0cmluZ1xyXG4gKi9cclxuYmFzZTY0LmVuY29kZSA9IGZ1bmN0aW9uIGVuY29kZShidWZmZXIsIHN0YXJ0LCBlbmQpIHtcclxuICAgIHZhciBzdHJpbmcgPSBbXTsgLy8gYWx0OiBuZXcgQXJyYXkoTWF0aC5jZWlsKChlbmQgLSBzdGFydCkgLyAzKSAqIDQpO1xyXG4gICAgdmFyIGkgPSAwLCAvLyBvdXRwdXQgaW5kZXhcclxuICAgICAgICBqID0gMCwgLy8gZ290byBpbmRleFxyXG4gICAgICAgIHQ7ICAgICAvLyB0ZW1wb3JhcnlcclxuICAgIHdoaWxlIChzdGFydCA8IGVuZCkge1xyXG4gICAgICAgIHZhciBiID0gYnVmZmVyW3N0YXJ0KytdO1xyXG4gICAgICAgIHN3aXRjaCAoaikge1xyXG4gICAgICAgICAgICBjYXNlIDA6XHJcbiAgICAgICAgICAgICAgICBzdHJpbmdbaSsrXSA9IGI2NFtiID4+IDJdO1xyXG4gICAgICAgICAgICAgICAgdCA9IChiICYgMykgPDwgNDtcclxuICAgICAgICAgICAgICAgIGogPSAxO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgMTpcclxuICAgICAgICAgICAgICAgIHN0cmluZ1tpKytdID0gYjY0W3QgfCBiID4+IDRdO1xyXG4gICAgICAgICAgICAgICAgdCA9IChiICYgMTUpIDw8IDI7XHJcbiAgICAgICAgICAgICAgICBqID0gMjtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIDI6XHJcbiAgICAgICAgICAgICAgICBzdHJpbmdbaSsrXSA9IGI2NFt0IHwgYiA+PiA2XTtcclxuICAgICAgICAgICAgICAgIHN0cmluZ1tpKytdID0gYjY0W2IgJiA2M107XHJcbiAgICAgICAgICAgICAgICBqID0gMDtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIGlmIChqKSB7XHJcbiAgICAgICAgc3RyaW5nW2krK10gPSBiNjRbdF07XHJcbiAgICAgICAgc3RyaW5nW2kgIF0gPSA2MTtcclxuICAgICAgICBpZiAoaiA9PT0gMSlcclxuICAgICAgICAgICAgc3RyaW5nW2kgKyAxXSA9IDYxO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkoU3RyaW5nLCBzdHJpbmcpO1xyXG59O1xyXG5cclxudmFyIGludmFsaWRFbmNvZGluZyA9IFwiaW52YWxpZCBlbmNvZGluZ1wiO1xyXG5cclxuLyoqXHJcbiAqIERlY29kZXMgYSBiYXNlNjQgZW5jb2RlZCBzdHJpbmcgdG8gYSBidWZmZXIuXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBzdHJpbmcgU291cmNlIHN0cmluZ1xyXG4gKiBAcGFyYW0ge1VpbnQ4QXJyYXl9IGJ1ZmZlciBEZXN0aW5hdGlvbiBidWZmZXJcclxuICogQHBhcmFtIHtudW1iZXJ9IG9mZnNldCBEZXN0aW5hdGlvbiBvZmZzZXRcclxuICogQHJldHVybnMge251bWJlcn0gTnVtYmVyIG9mIGJ5dGVzIHdyaXR0ZW5cclxuICogQHRocm93cyB7RXJyb3J9IElmIGVuY29kaW5nIGlzIGludmFsaWRcclxuICovXHJcbmJhc2U2NC5kZWNvZGUgPSBmdW5jdGlvbiBkZWNvZGUoc3RyaW5nLCBidWZmZXIsIG9mZnNldCkge1xyXG4gICAgdmFyIHN0YXJ0ID0gb2Zmc2V0O1xyXG4gICAgdmFyIGogPSAwLCAvLyBnb3RvIGluZGV4XHJcbiAgICAgICAgdDsgICAgIC8vIHRlbXBvcmFyeVxyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHJpbmcubGVuZ3RoOykge1xyXG4gICAgICAgIHZhciBjID0gc3RyaW5nLmNoYXJDb2RlQXQoaSsrKTtcclxuICAgICAgICBpZiAoYyA9PT0gNjEgJiYgaiA+IDEpXHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGlmICgoYyA9IHM2NFtjXSkgPT09IHVuZGVmaW5lZClcclxuICAgICAgICAgICAgdGhyb3cgRXJyb3IoaW52YWxpZEVuY29kaW5nKTtcclxuICAgICAgICBzd2l0Y2ggKGopIHtcclxuICAgICAgICAgICAgY2FzZSAwOlxyXG4gICAgICAgICAgICAgICAgdCA9IGM7XHJcbiAgICAgICAgICAgICAgICBqID0gMTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIDE6XHJcbiAgICAgICAgICAgICAgICBidWZmZXJbb2Zmc2V0KytdID0gdCA8PCAyIHwgKGMgJiA0OCkgPj4gNDtcclxuICAgICAgICAgICAgICAgIHQgPSBjO1xyXG4gICAgICAgICAgICAgICAgaiA9IDI7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSAyOlxyXG4gICAgICAgICAgICAgICAgYnVmZmVyW29mZnNldCsrXSA9ICh0ICYgMTUpIDw8IDQgfCAoYyAmIDYwKSA+PiAyO1xyXG4gICAgICAgICAgICAgICAgdCA9IGM7XHJcbiAgICAgICAgICAgICAgICBqID0gMztcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIDM6XHJcbiAgICAgICAgICAgICAgICBidWZmZXJbb2Zmc2V0KytdID0gKHQgJiAzKSA8PCA2IHwgYztcclxuICAgICAgICAgICAgICAgIGogPSAwO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgaWYgKGogPT09IDEpXHJcbiAgICAgICAgdGhyb3cgRXJyb3IoaW52YWxpZEVuY29kaW5nKTtcclxuICAgIHJldHVybiBvZmZzZXQgLSBzdGFydDtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBUZXN0cyBpZiB0aGUgc3BlY2lmaWVkIHN0cmluZyBhcHBlYXJzIHRvIGJlIGJhc2U2NCBlbmNvZGVkLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyaW5nIFN0cmluZyB0byB0ZXN0XHJcbiAqIEByZXR1cm5zIHtib29sZWFufSBgdHJ1ZWAgaWYgcHJvYmFibHkgYmFzZTY0IGVuY29kZWQsIG90aGVyd2lzZSBmYWxzZVxyXG4gKi9cclxuYmFzZTY0LnRlc3QgPSBmdW5jdGlvbiB0ZXN0KHN0cmluZykge1xyXG4gICAgcmV0dXJuIC9eKD86W0EtWmEtejAtOSsvXXs0fSkqKD86W0EtWmEtejAtOSsvXXsyfT09fFtBLVphLXowLTkrL117M309KT8kLy50ZXN0KHN0cmluZyk7XHJcbn07XHJcbiIsIlwidXNlIHN0cmljdFwiO1xyXG5tb2R1bGUuZXhwb3J0cyA9IGNvZGVnZW47XHJcblxyXG52YXIgYmxvY2tPcGVuUmUgID0gL1t7W10kLyxcclxuICAgIGJsb2NrQ2xvc2VSZSA9IC9eW31cXF1dLyxcclxuICAgIGNhc2luZ1JlICAgICA9IC86JC8sXHJcbiAgICBicmFuY2hSZSAgICAgPSAvXlxccyooPzppZnx9P2Vsc2UgaWZ8d2hpbGV8Zm9yKVxcYnxcXGIoPzplbHNlKVxccyokLyxcclxuICAgIGJyZWFrUmUgICAgICA9IC9cXGIoPzpicmVha3xjb250aW51ZSkoPzogXFx3Kyk/Oz8kfF5cXHMqcmV0dXJuXFxiLztcclxuXHJcbi8qKlxyXG4gKiBBIGNsb3N1cmUgZm9yIGdlbmVyYXRpbmcgZnVuY3Rpb25zIHByb2dyYW1tYXRpY2FsbHkuXHJcbiAqIEBtZW1iZXJvZiB1dGlsXHJcbiAqIEBuYW1lc3BhY2VcclxuICogQGZ1bmN0aW9uXHJcbiAqIEBwYXJhbSB7Li4uc3RyaW5nfSBwYXJhbXMgRnVuY3Rpb24gcGFyYW1ldGVyIG5hbWVzXHJcbiAqIEByZXR1cm5zIHtDb2RlZ2VufSBDb2RlZ2VuIGluc3RhbmNlXHJcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gc3VwcG9ydGVkIFdoZXRoZXIgY29kZSBnZW5lcmF0aW9uIGlzIHN1cHBvcnRlZCBieSB0aGUgZW52aXJvbm1lbnQuXHJcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdmVyYm9zZT1mYWxzZSBXaGVuIHNldCB0byB0cnVlLCBjb2RlZ2VuIHdpbGwgbG9nIGdlbmVyYXRlZCBjb2RlIHRvIGNvbnNvbGUuIFVzZWZ1bCBmb3IgZGVidWdnaW5nLlxyXG4gKiBAcHJvcGVydHkge2Z1bmN0aW9uKHN0cmluZywgLi4uKik6c3RyaW5nfSBzcHJpbnRmIFVuZGVybHlpbmcgc3ByaW50ZiBpbXBsZW1lbnRhdGlvblxyXG4gKi9cclxuZnVuY3Rpb24gY29kZWdlbigpIHtcclxuICAgIHZhciBwYXJhbXMgPSBbXSxcclxuICAgICAgICBzcmMgICAgPSBbXSxcclxuICAgICAgICBpbmRlbnQgPSAxLFxyXG4gICAgICAgIGluQ2FzZSA9IGZhbHNlO1xyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOylcclxuICAgICAgICBwYXJhbXMucHVzaChhcmd1bWVudHNbaSsrXSk7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBIGNvZGVnZW4gaW5zdGFuY2UgYXMgcmV0dXJuZWQgYnkge0BsaW5rIGNvZGVnZW59LCB0aGF0IGFsc28gaXMgYSBzcHJpbnRmLWxpa2UgYXBwZW5kZXIgZnVuY3Rpb24uXHJcbiAgICAgKiBAdHlwZWRlZiBDb2RlZ2VuXHJcbiAgICAgKiBAdHlwZSB7ZnVuY3Rpb259XHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZm9ybWF0IEZvcm1hdCBzdHJpbmdcclxuICAgICAqIEBwYXJhbSB7Li4uKn0gYXJncyBSZXBsYWNlbWVudHNcclxuICAgICAqIEByZXR1cm5zIHtDb2RlZ2VufSBJdHNlbGZcclxuICAgICAqIEBwcm9wZXJ0eSB7ZnVuY3Rpb24oc3RyaW5nPSk6c3RyaW5nfSBzdHIgU3RyaW5naWZpZXMgdGhlIHNvIGZhciBnZW5lcmF0ZWQgZnVuY3Rpb24gc291cmNlLlxyXG4gICAgICogQHByb3BlcnR5IHtmdW5jdGlvbihzdHJpbmc9LCBPYmplY3Q9KTpmdW5jdGlvbn0gZW9mIEVuZHMgZ2VuZXJhdGlvbiBhbmQgYnVpbGRzIHRoZSBmdW5jdGlvbiB3aGlsc3QgYXBwbHlpbmcgYSBzY29wZS5cclxuICAgICAqL1xyXG4gICAgLyoqL1xyXG4gICAgZnVuY3Rpb24gZ2VuKCkge1xyXG4gICAgICAgIHZhciBhcmdzID0gW10sXHJcbiAgICAgICAgICAgIGkgPSAwO1xyXG4gICAgICAgIGZvciAoOyBpIDwgYXJndW1lbnRzLmxlbmd0aDspXHJcbiAgICAgICAgICAgIGFyZ3MucHVzaChhcmd1bWVudHNbaSsrXSk7XHJcbiAgICAgICAgdmFyIGxpbmUgPSBzcHJpbnRmLmFwcGx5KG51bGwsIGFyZ3MpO1xyXG4gICAgICAgIHZhciBsZXZlbCA9IGluZGVudDtcclxuICAgICAgICBpZiAoc3JjLmxlbmd0aCkge1xyXG4gICAgICAgICAgICB2YXIgcHJldiA9IHNyY1tzcmMubGVuZ3RoIC0gMV07XHJcblxyXG4gICAgICAgICAgICAvLyBibG9jayBvcGVuIG9yIG9uZSB0aW1lIGJyYW5jaFxyXG4gICAgICAgICAgICBpZiAoYmxvY2tPcGVuUmUudGVzdChwcmV2KSlcclxuICAgICAgICAgICAgICAgIGxldmVsID0gKytpbmRlbnQ7IC8vIGtlZXBcclxuICAgICAgICAgICAgZWxzZSBpZiAoYnJhbmNoUmUudGVzdChwcmV2KSlcclxuICAgICAgICAgICAgICAgICsrbGV2ZWw7IC8vIG9uY2VcclxuXHJcbiAgICAgICAgICAgIC8vIGNhc2luZ1xyXG4gICAgICAgICAgICBpZiAoY2FzaW5nUmUudGVzdChwcmV2KSAmJiAhY2FzaW5nUmUudGVzdChsaW5lKSkge1xyXG4gICAgICAgICAgICAgICAgbGV2ZWwgPSArK2luZGVudDtcclxuICAgICAgICAgICAgICAgIGluQ2FzZSA9IHRydWU7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaW5DYXNlICYmIGJyZWFrUmUudGVzdChwcmV2KSkge1xyXG4gICAgICAgICAgICAgICAgbGV2ZWwgPSAtLWluZGVudDtcclxuICAgICAgICAgICAgICAgIGluQ2FzZSA9IGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBibG9jayBjbG9zZVxyXG4gICAgICAgICAgICBpZiAoYmxvY2tDbG9zZVJlLnRlc3QobGluZSkpXHJcbiAgICAgICAgICAgICAgICBsZXZlbCA9IC0taW5kZW50O1xyXG4gICAgICAgIH1cclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbGV2ZWw7ICsraSlcclxuICAgICAgICAgICAgbGluZSA9IFwiXFx0XCIgKyBsaW5lO1xyXG4gICAgICAgIHNyYy5wdXNoKGxpbmUpO1xyXG4gICAgICAgIHJldHVybiBnZW47XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTdHJpbmdpZmllcyB0aGUgc28gZmFyIGdlbmVyYXRlZCBmdW5jdGlvbiBzb3VyY2UuXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW25hbWVdIEZ1bmN0aW9uIG5hbWUsIGRlZmF1bHRzIHRvIGdlbmVyYXRlIGFuIGFub255bW91cyBmdW5jdGlvblxyXG4gICAgICogQHJldHVybnMge3N0cmluZ30gRnVuY3Rpb24gc291cmNlIHVzaW5nIHRhYnMgZm9yIGluZGVudGF0aW9uXHJcbiAgICAgKiBAaW5uZXJcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gc3RyKG5hbWUpIHtcclxuICAgICAgICByZXR1cm4gXCJmdW5jdGlvblwiICsgKG5hbWUgPyBcIiBcIiArIG5hbWUucmVwbGFjZSgvW15cXHdfJF0vZywgXCJfXCIpIDogXCJcIikgKyBcIihcIiArIHBhcmFtcy5qb2luKFwiLFwiKSArIFwiKSB7XFxuXCIgKyBzcmMuam9pbihcIlxcblwiKSArIFwiXFxufVwiO1xyXG4gICAgfVxyXG5cclxuICAgIGdlbi5zdHIgPSBzdHI7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBFbmRzIGdlbmVyYXRpb24gYW5kIGJ1aWxkcyB0aGUgZnVuY3Rpb24gd2hpbHN0IGFwcGx5aW5nIGEgc2NvcGUuXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW25hbWVdIEZ1bmN0aW9uIG5hbWUsIGRlZmF1bHRzIHRvIGdlbmVyYXRlIGFuIGFub255bW91cyBmdW5jdGlvblxyXG4gICAgICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywqPn0gW3Njb3BlXSBGdW5jdGlvbiBzY29wZVxyXG4gICAgICogQHJldHVybnMge2Z1bmN0aW9ufSBUaGUgZ2VuZXJhdGVkIGZ1bmN0aW9uLCB3aXRoIHNjb3BlIGFwcGxpZWQgaWYgc3BlY2lmaWVkXHJcbiAgICAgKiBAaW5uZXJcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gZW9mKG5hbWUsIHNjb3BlKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBuYW1lID09PSBcIm9iamVjdFwiKSB7XHJcbiAgICAgICAgICAgIHNjb3BlID0gbmFtZTtcclxuICAgICAgICAgICAgbmFtZSA9IHVuZGVmaW5lZDtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIHNvdXJjZSA9IGdlbi5zdHIobmFtZSk7XHJcbiAgICAgICAgaWYgKGNvZGVnZW4udmVyYm9zZSlcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCItLS0gY29kZWdlbiAtLS1cXG5cIiArIHNvdXJjZS5yZXBsYWNlKC9eL21nLCBcIj4gXCIpLnJlcGxhY2UoL1xcdC9nLCBcIiAgXCIpKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1jb25zb2xlXHJcbiAgICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhzY29wZSB8fCAoc2NvcGUgPSB7fSkpO1xyXG4gICAgICAgIHJldHVybiBGdW5jdGlvbi5hcHBseShudWxsLCBrZXlzLmNvbmNhdChcInJldHVybiBcIiArIHNvdXJjZSkpLmFwcGx5KG51bGwsIGtleXMubWFwKGZ1bmN0aW9uKGtleSkgeyByZXR1cm4gc2NvcGVba2V5XTsgfSkpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXHJcbiAgICAgICAgLy8gICAgIF4gQ3JlYXRlcyBhIHdyYXBwZXIgZnVuY3Rpb24gd2l0aCB0aGUgc2NvcGVkIHZhcmlhYmxlIG5hbWVzIGFzIGl0cyBwYXJhbWV0ZXJzLFxyXG4gICAgICAgIC8vICAgICAgIGNhbGxzIGl0IHdpdGggdGhlIHJlc3BlY3RpdmUgc2NvcGVkIHZhcmlhYmxlIHZhbHVlcyBeXHJcbiAgICAgICAgLy8gICAgICAgYW5kIHJldHVybnMgb3VyIGJyYW5kLW5ldyBwcm9wZXJseSBzY29wZWQgZnVuY3Rpb24uXHJcbiAgICAgICAgLy9cclxuICAgICAgICAvLyBUaGlzIHdvcmtzIGJlY2F1c2UgXCJJbnZva2luZyB0aGUgRnVuY3Rpb24gY29uc3RydWN0b3IgYXMgYSBmdW5jdGlvbiAod2l0aG91dCB1c2luZyB0aGVcclxuICAgICAgICAvLyBuZXcgb3BlcmF0b3IpIGhhcyB0aGUgc2FtZSBlZmZlY3QgYXMgaW52b2tpbmcgaXQgYXMgYSBjb25zdHJ1Y3Rvci5cIlxyXG4gICAgICAgIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2RlL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0Z1bmN0aW9uXHJcbiAgICB9XHJcblxyXG4gICAgZ2VuLmVvZiA9IGVvZjtcclxuXHJcbiAgICByZXR1cm4gZ2VuO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzcHJpbnRmKGZvcm1hdCkge1xyXG4gICAgdmFyIGFyZ3MgPSBbXSxcclxuICAgICAgICBpID0gMTtcclxuICAgIGZvciAoOyBpIDwgYXJndW1lbnRzLmxlbmd0aDspXHJcbiAgICAgICAgYXJncy5wdXNoKGFyZ3VtZW50c1tpKytdKTtcclxuICAgIGkgPSAwO1xyXG4gICAgZm9ybWF0ID0gZm9ybWF0LnJlcGxhY2UoLyUoW2RmanNdKS9nLCBmdW5jdGlvbigkMCwgJDEpIHtcclxuICAgICAgICBzd2l0Y2ggKCQxKSB7XHJcbiAgICAgICAgICAgIGNhc2UgXCJkXCI6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gTWF0aC5mbG9vcihhcmdzW2krK10pO1xyXG4gICAgICAgICAgICBjYXNlIFwiZlwiOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIE51bWJlcihhcmdzW2krK10pO1xyXG4gICAgICAgICAgICBjYXNlIFwialwiOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGFyZ3NbaSsrXSk7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXJnc1tpKytdO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgaWYgKGkgIT09IGFyZ3MubGVuZ3RoKVxyXG4gICAgICAgIHRocm93IEVycm9yKFwiYXJndW1lbnQgY291bnQgbWlzbWF0Y2hcIik7XHJcbiAgICByZXR1cm4gZm9ybWF0O1xyXG59XHJcblxyXG5jb2RlZ2VuLnNwcmludGYgICA9IHNwcmludGY7XHJcbmNvZGVnZW4uc3VwcG9ydGVkID0gZmFsc2U7IHRyeSB7IGNvZGVnZW4uc3VwcG9ydGVkID0gY29kZWdlbihcImFcIixcImJcIikoXCJyZXR1cm4gYS1iXCIpLmVvZigpKDIsMSkgPT09IDE7IH0gY2F0Y2ggKGUpIHt9IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tZW1wdHlcclxuY29kZWdlbi52ZXJib3NlICAgPSBmYWxzZTtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xyXG5cclxuLyoqXHJcbiAqIENvbnN0cnVjdHMgYSBuZXcgZXZlbnQgZW1pdHRlciBpbnN0YW5jZS5cclxuICogQGNsYXNzZGVzYyBBIG1pbmltYWwgZXZlbnQgZW1pdHRlci5cclxuICogQG1lbWJlcm9mIHV0aWxcclxuICogQGNvbnN0cnVjdG9yXHJcbiAqL1xyXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZWdpc3RlcmVkIGxpc3RlbmVycy5cclxuICAgICAqIEB0eXBlIHtPYmplY3QuPHN0cmluZywqPn1cclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKi9cclxuICAgIHRoaXMuX2xpc3RlbmVycyA9IHt9O1xyXG59XHJcblxyXG4vKipcclxuICogUmVnaXN0ZXJzIGFuIGV2ZW50IGxpc3RlbmVyLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gZXZ0IEV2ZW50IG5hbWVcclxuICogQHBhcmFtIHtmdW5jdGlvbn0gZm4gTGlzdGVuZXJcclxuICogQHBhcmFtIHsqfSBbY3R4XSBMaXN0ZW5lciBjb250ZXh0XHJcbiAqIEByZXR1cm5zIHt1dGlsLkV2ZW50RW1pdHRlcn0gYHRoaXNgXHJcbiAqL1xyXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gZnVuY3Rpb24gb24oZXZ0LCBmbiwgY3R4KSB7XHJcbiAgICAodGhpcy5fbGlzdGVuZXJzW2V2dF0gfHwgKHRoaXMuX2xpc3RlbmVyc1tldnRdID0gW10pKS5wdXNoKHtcclxuICAgICAgICBmbiAgOiBmbixcclxuICAgICAgICBjdHggOiBjdHggfHwgdGhpc1xyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gdGhpcztcclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZW1vdmVzIGFuIGV2ZW50IGxpc3RlbmVyIG9yIGFueSBtYXRjaGluZyBsaXN0ZW5lcnMgaWYgYXJndW1lbnRzIGFyZSBvbWl0dGVkLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gW2V2dF0gRXZlbnQgbmFtZS4gUmVtb3ZlcyBhbGwgbGlzdGVuZXJzIGlmIG9taXR0ZWQuXHJcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IFtmbl0gTGlzdGVuZXIgdG8gcmVtb3ZlLiBSZW1vdmVzIGFsbCBsaXN0ZW5lcnMgb2YgYGV2dGAgaWYgb21pdHRlZC5cclxuICogQHJldHVybnMge3V0aWwuRXZlbnRFbWl0dGVyfSBgdGhpc2BcclxuICovXHJcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub2ZmID0gZnVuY3Rpb24gb2ZmKGV2dCwgZm4pIHtcclxuICAgIGlmIChldnQgPT09IHVuZGVmaW5lZClcclxuICAgICAgICB0aGlzLl9saXN0ZW5lcnMgPSB7fTtcclxuICAgIGVsc2Uge1xyXG4gICAgICAgIGlmIChmbiA9PT0gdW5kZWZpbmVkKVxyXG4gICAgICAgICAgICB0aGlzLl9saXN0ZW5lcnNbZXZ0XSA9IFtdO1xyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzW2V2dF07XHJcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDspXHJcbiAgICAgICAgICAgICAgICBpZiAobGlzdGVuZXJzW2ldLmZuID09PSBmbilcclxuICAgICAgICAgICAgICAgICAgICBsaXN0ZW5lcnMuc3BsaWNlKGksIDEpO1xyXG4gICAgICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAgICAgICAgICsraTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcztcclxufTtcclxuXHJcbi8qKlxyXG4gKiBFbWl0cyBhbiBldmVudCBieSBjYWxsaW5nIGl0cyBsaXN0ZW5lcnMgd2l0aCB0aGUgc3BlY2lmaWVkIGFyZ3VtZW50cy5cclxuICogQHBhcmFtIHtzdHJpbmd9IGV2dCBFdmVudCBuYW1lXHJcbiAqIEBwYXJhbSB7Li4uKn0gYXJncyBBcmd1bWVudHNcclxuICogQHJldHVybnMge3V0aWwuRXZlbnRFbWl0dGVyfSBgdGhpc2BcclxuICovXHJcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uIGVtaXQoZXZ0KSB7XHJcbiAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzW2V2dF07XHJcbiAgICBpZiAobGlzdGVuZXJzKSB7XHJcbiAgICAgICAgdmFyIGFyZ3MgPSBbXSxcclxuICAgICAgICAgICAgaSA9IDE7XHJcbiAgICAgICAgZm9yICg7IGkgPCBhcmd1bWVudHMubGVuZ3RoOylcclxuICAgICAgICAgICAgYXJncy5wdXNoKGFyZ3VtZW50c1tpKytdKTtcclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDspXHJcbiAgICAgICAgICAgIGxpc3RlbmVyc1tpXS5mbi5hcHBseShsaXN0ZW5lcnNbaSsrXS5jdHgsIGFyZ3MpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbn07XHJcbiIsIlwidXNlIHN0cmljdFwiO1xyXG5tb2R1bGUuZXhwb3J0cyA9IGZldGNoO1xyXG5cclxudmFyIGFzUHJvbWlzZSA9IHJlcXVpcmUoXCJAcHJvdG9idWZqcy9hc3Byb21pc2VcIiksXHJcbiAgICBpbnF1aXJlICAgPSByZXF1aXJlKFwiQHByb3RvYnVmanMvaW5xdWlyZVwiKTtcclxuXHJcbnZhciBmcyA9IGlucXVpcmUoXCJmc1wiKTtcclxuXHJcbi8qKlxyXG4gKiBOb2RlLXN0eWxlIGNhbGxiYWNrIGFzIHVzZWQgYnkge0BsaW5rIHV0aWwuZmV0Y2h9LlxyXG4gKiBAdHlwZWRlZiBGZXRjaENhbGxiYWNrXHJcbiAqIEB0eXBlIHtmdW5jdGlvbn1cclxuICogQHBhcmFtIHs/RXJyb3J9IGVycm9yIEVycm9yLCBpZiBhbnksIG90aGVyd2lzZSBgbnVsbGBcclxuICogQHBhcmFtIHtzdHJpbmd9IFtjb250ZW50c10gRmlsZSBjb250ZW50cywgaWYgdGhlcmUgaGFzbid0IGJlZW4gYW4gZXJyb3JcclxuICogQHJldHVybnMge3VuZGVmaW5lZH1cclxuICovXHJcblxyXG4vKipcclxuICogT3B0aW9ucyBhcyB1c2VkIGJ5IHtAbGluayB1dGlsLmZldGNofS5cclxuICogQHR5cGVkZWYgRmV0Y2hPcHRpb25zXHJcbiAqIEB0eXBlIHtPYmplY3R9XHJcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gW2JpbmFyeT1mYWxzZV0gV2hldGhlciBleHBlY3RpbmcgYSBiaW5hcnkgcmVzcG9uc2VcclxuICogQHByb3BlcnR5IHtib29sZWFufSBbeGhyPWZhbHNlXSBJZiBgdHJ1ZWAsIGZvcmNlcyB0aGUgdXNlIG9mIFhNTEh0dHBSZXF1ZXN0XHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIEZldGNoZXMgdGhlIGNvbnRlbnRzIG9mIGEgZmlsZS5cclxuICogQG1lbWJlcm9mIHV0aWxcclxuICogQHBhcmFtIHtzdHJpbmd9IGZpbGVuYW1lIEZpbGUgcGF0aCBvciB1cmxcclxuICogQHBhcmFtIHtGZXRjaE9wdGlvbnN9IG9wdGlvbnMgRmV0Y2ggb3B0aW9uc1xyXG4gKiBAcGFyYW0ge0ZldGNoQ2FsbGJhY2t9IGNhbGxiYWNrIENhbGxiYWNrIGZ1bmN0aW9uXHJcbiAqIEByZXR1cm5zIHt1bmRlZmluZWR9XHJcbiAqL1xyXG5mdW5jdGlvbiBmZXRjaChmaWxlbmFtZSwgb3B0aW9ucywgY2FsbGJhY2spIHtcclxuICAgIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgY2FsbGJhY2sgPSBvcHRpb25zO1xyXG4gICAgICAgIG9wdGlvbnMgPSB7fTtcclxuICAgIH0gZWxzZSBpZiAoIW9wdGlvbnMpXHJcbiAgICAgICAgb3B0aW9ucyA9IHt9O1xyXG5cclxuICAgIGlmICghY2FsbGJhY2spXHJcbiAgICAgICAgcmV0dXJuIGFzUHJvbWlzZShmZXRjaCwgdGhpcywgZmlsZW5hbWUsIG9wdGlvbnMpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWludmFsaWQtdGhpc1xyXG5cclxuICAgIC8vIGlmIGEgbm9kZS1saWtlIGZpbGVzeXN0ZW0gaXMgcHJlc2VudCwgdHJ5IGl0IGZpcnN0IGJ1dCBmYWxsIGJhY2sgdG8gWEhSIGlmIG5vdGhpbmcgaXMgZm91bmQuXHJcbiAgICBpZiAoIW9wdGlvbnMueGhyICYmIGZzICYmIGZzLnJlYWRGaWxlKVxyXG4gICAgICAgIHJldHVybiBmcy5yZWFkRmlsZShmaWxlbmFtZSwgZnVuY3Rpb24gZmV0Y2hSZWFkRmlsZUNhbGxiYWNrKGVyciwgY29udGVudHMpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGVyciAmJiB0eXBlb2YgWE1MSHR0cFJlcXVlc3QgIT09IFwidW5kZWZpbmVkXCJcclxuICAgICAgICAgICAgICAgID8gZmV0Y2gueGhyKGZpbGVuYW1lLCBvcHRpb25zLCBjYWxsYmFjaylcclxuICAgICAgICAgICAgICAgIDogZXJyXHJcbiAgICAgICAgICAgICAgICA/IGNhbGxiYWNrKGVycilcclxuICAgICAgICAgICAgICAgIDogY2FsbGJhY2sobnVsbCwgb3B0aW9ucy5iaW5hcnkgPyBjb250ZW50cyA6IGNvbnRlbnRzLnRvU3RyaW5nKFwidXRmOFwiKSk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgLy8gdXNlIHRoZSBYSFIgdmVyc2lvbiBvdGhlcndpc2UuXHJcbiAgICByZXR1cm4gZmV0Y2gueGhyKGZpbGVuYW1lLCBvcHRpb25zLCBjYWxsYmFjayk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBGZXRjaGVzIHRoZSBjb250ZW50cyBvZiBhIGZpbGUuXHJcbiAqIEBuYW1lIHV0aWwuZmV0Y2hcclxuICogQGZ1bmN0aW9uXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoIEZpbGUgcGF0aCBvciB1cmxcclxuICogQHBhcmFtIHtGZXRjaENhbGxiYWNrfSBjYWxsYmFjayBDYWxsYmFjayBmdW5jdGlvblxyXG4gKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxyXG4gKiBAdmFyaWF0aW9uIDJcclxuICovXHJcblxyXG4vKipcclxuICogRmV0Y2hlcyB0aGUgY29udGVudHMgb2YgYSBmaWxlLlxyXG4gKiBAbmFtZSB1dGlsLmZldGNoXHJcbiAqIEBmdW5jdGlvblxyXG4gKiBAcGFyYW0ge3N0cmluZ30gcGF0aCBGaWxlIHBhdGggb3IgdXJsXHJcbiAqIEBwYXJhbSB7RmV0Y2hPcHRpb25zfSBbb3B0aW9uc10gRmV0Y2ggb3B0aW9uc1xyXG4gKiBAcmV0dXJucyB7UHJvbWlzZTxzdHJpbmd8VWludDhBcnJheT59IFByb21pc2VcclxuICogQHZhcmlhdGlvbiAzXHJcbiAqL1xyXG5cclxuLyoqL1xyXG5mZXRjaC54aHIgPSBmdW5jdGlvbiBmZXRjaF94aHIoZmlsZW5hbWUsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XHJcbiAgICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XHJcbiAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlIC8qIHdvcmtzIGV2ZXJ5d2hlcmUgKi8gPSBmdW5jdGlvbiBmZXRjaE9uUmVhZHlTdGF0ZUNoYW5nZSgpIHtcclxuXHJcbiAgICAgICAgaWYgKHhoci5yZWFkeVN0YXRlICE9PSA0KVxyXG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG5cclxuICAgICAgICAvLyBsb2NhbCBjb3JzIHNlY3VyaXR5IGVycm9ycyByZXR1cm4gc3RhdHVzIDAgLyBlbXB0eSBzdHJpbmcsIHRvby4gYWZhaWsgdGhpcyBjYW5ub3QgYmVcclxuICAgICAgICAvLyByZWxpYWJseSBkaXN0aW5ndWlzaGVkIGZyb20gYW4gYWN0dWFsbHkgZW1wdHkgZmlsZSBmb3Igc2VjdXJpdHkgcmVhc29ucy4gZmVlbCBmcmVlXHJcbiAgICAgICAgLy8gdG8gc2VuZCBhIHB1bGwgcmVxdWVzdCBpZiB5b3UgYXJlIGF3YXJlIG9mIGEgc29sdXRpb24uXHJcbiAgICAgICAgaWYgKHhoci5zdGF0dXMgIT09IDAgJiYgeGhyLnN0YXR1cyAhPT0gMjAwKVxyXG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soRXJyb3IoXCJzdGF0dXMgXCIgKyB4aHIuc3RhdHVzKSk7XHJcblxyXG4gICAgICAgIC8vIGlmIGJpbmFyeSBkYXRhIGlzIGV4cGVjdGVkLCBtYWtlIHN1cmUgdGhhdCBzb21lIHNvcnQgb2YgYXJyYXkgaXMgcmV0dXJuZWQsIGV2ZW4gaWZcclxuICAgICAgICAvLyBBcnJheUJ1ZmZlcnMgYXJlIG5vdCBzdXBwb3J0ZWQuIHRoZSBiaW5hcnkgc3RyaW5nIGZhbGxiYWNrLCBob3dldmVyLCBpcyB1bnNhZmUuXHJcbiAgICAgICAgaWYgKG9wdGlvbnMuYmluYXJ5KSB7XHJcbiAgICAgICAgICAgIHZhciBidWZmZXIgPSB4aHIucmVzcG9uc2U7XHJcbiAgICAgICAgICAgIGlmICghYnVmZmVyKSB7XHJcbiAgICAgICAgICAgICAgICBidWZmZXIgPSBbXTtcclxuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgeGhyLnJlc3BvbnNlVGV4dC5sZW5ndGg7ICsraSlcclxuICAgICAgICAgICAgICAgICAgICBidWZmZXIucHVzaCh4aHIucmVzcG9uc2VUZXh0LmNoYXJDb2RlQXQoaSkgJiAyNTUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhudWxsLCB0eXBlb2YgVWludDhBcnJheSAhPT0gXCJ1bmRlZmluZWRcIiA/IG5ldyBVaW50OEFycmF5KGJ1ZmZlcikgOiBidWZmZXIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gY2FsbGJhY2sobnVsbCwgeGhyLnJlc3BvbnNlVGV4dCk7XHJcbiAgICB9O1xyXG5cclxuICAgIGlmIChvcHRpb25zLmJpbmFyeSkge1xyXG4gICAgICAgIC8vIHJlZjogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1hNTEh0dHBSZXF1ZXN0L1NlbmRpbmdfYW5kX1JlY2VpdmluZ19CaW5hcnlfRGF0YSNSZWNlaXZpbmdfYmluYXJ5X2RhdGFfaW5fb2xkZXJfYnJvd3NlcnNcclxuICAgICAgICBpZiAoXCJvdmVycmlkZU1pbWVUeXBlXCIgaW4geGhyKVxyXG4gICAgICAgICAgICB4aHIub3ZlcnJpZGVNaW1lVHlwZShcInRleHQvcGxhaW47IGNoYXJzZXQ9eC11c2VyLWRlZmluZWRcIik7XHJcbiAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9IFwiYXJyYXlidWZmZXJcIjtcclxuICAgIH1cclxuXHJcbiAgICB4aHIub3BlbihcIkdFVFwiLCBmaWxlbmFtZSk7XHJcbiAgICB4aHIuc2VuZCgpO1xyXG59O1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxubW9kdWxlLmV4cG9ydHMgPSBpbnF1aXJlO1xyXG5cclxuLyoqXHJcbiAqIFJlcXVpcmVzIGEgbW9kdWxlIG9ubHkgaWYgYXZhaWxhYmxlLlxyXG4gKiBAbWVtYmVyb2YgdXRpbFxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbW9kdWxlTmFtZSBNb2R1bGUgdG8gcmVxdWlyZVxyXG4gKiBAcmV0dXJucyB7P09iamVjdH0gUmVxdWlyZWQgbW9kdWxlIGlmIGF2YWlsYWJsZSBhbmQgbm90IGVtcHR5LCBvdGhlcndpc2UgYG51bGxgXHJcbiAqL1xyXG5mdW5jdGlvbiBpbnF1aXJlKG1vZHVsZU5hbWUpIHtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgdmFyIG1vZCA9IGV2YWwoXCJxdWlyZVwiLnJlcGxhY2UoL14vLFwicmVcIikpKG1vZHVsZU5hbWUpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWV2YWxcclxuICAgICAgICBpZiAobW9kICYmIChtb2QubGVuZ3RoIHx8IE9iamVjdC5rZXlzKG1vZCkubGVuZ3RoKSlcclxuICAgICAgICAgICAgcmV0dXJuIG1vZDtcclxuICAgIH0gY2F0Y2ggKGUpIHt9IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tZW1wdHlcclxuICAgIHJldHVybiBudWxsO1xyXG59XHJcbiIsIlwidXNlIHN0cmljdFwiO1xyXG5cclxuLyoqXHJcbiAqIEEgbWluaW1hbCBwYXRoIG1vZHVsZSB0byByZXNvbHZlIFVuaXgsIFdpbmRvd3MgYW5kIFVSTCBwYXRocyBhbGlrZS5cclxuICogQG1lbWJlcm9mIHV0aWxcclxuICogQG5hbWVzcGFjZVxyXG4gKi9cclxudmFyIHBhdGggPSBleHBvcnRzO1xyXG5cclxudmFyIGlzQWJzb2x1dGUgPVxyXG4vKipcclxuICogVGVzdHMgaWYgdGhlIHNwZWNpZmllZCBwYXRoIGlzIGFic29sdXRlLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gcGF0aCBQYXRoIHRvIHRlc3RcclxuICogQHJldHVybnMge2Jvb2xlYW59IGB0cnVlYCBpZiBwYXRoIGlzIGFic29sdXRlXHJcbiAqL1xyXG5wYXRoLmlzQWJzb2x1dGUgPSBmdW5jdGlvbiBpc0Fic29sdXRlKHBhdGgpIHtcclxuICAgIHJldHVybiAvXig/OlxcL3xcXHcrOikvLnRlc3QocGF0aCk7XHJcbn07XHJcblxyXG52YXIgbm9ybWFsaXplID1cclxuLyoqXHJcbiAqIE5vcm1hbGl6ZXMgdGhlIHNwZWNpZmllZCBwYXRoLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gcGF0aCBQYXRoIHRvIG5vcm1hbGl6ZVxyXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBOb3JtYWxpemVkIHBhdGhcclxuICovXHJcbnBhdGgubm9ybWFsaXplID0gZnVuY3Rpb24gbm9ybWFsaXplKHBhdGgpIHtcclxuICAgIHBhdGggPSBwYXRoLnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpXHJcbiAgICAgICAgICAgICAgIC5yZXBsYWNlKC9cXC97Mix9L2csIFwiL1wiKTtcclxuICAgIHZhciBwYXJ0cyAgICA9IHBhdGguc3BsaXQoXCIvXCIpLFxyXG4gICAgICAgIGFic29sdXRlID0gaXNBYnNvbHV0ZShwYXRoKSxcclxuICAgICAgICBwcmVmaXggICA9IFwiXCI7XHJcbiAgICBpZiAoYWJzb2x1dGUpXHJcbiAgICAgICAgcHJlZml4ID0gcGFydHMuc2hpZnQoKSArIFwiL1wiO1xyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGg7KSB7XHJcbiAgICAgICAgaWYgKHBhcnRzW2ldID09PSBcIi4uXCIpIHtcclxuICAgICAgICAgICAgaWYgKGkgPiAwICYmIHBhcnRzW2kgLSAxXSAhPT0gXCIuLlwiKVxyXG4gICAgICAgICAgICAgICAgcGFydHMuc3BsaWNlKC0taSwgMik7XHJcbiAgICAgICAgICAgIGVsc2UgaWYgKGFic29sdXRlKVxyXG4gICAgICAgICAgICAgICAgcGFydHMuc3BsaWNlKGksIDEpO1xyXG4gICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgICArK2k7XHJcbiAgICAgICAgfSBlbHNlIGlmIChwYXJ0c1tpXSA9PT0gXCIuXCIpXHJcbiAgICAgICAgICAgIHBhcnRzLnNwbGljZShpLCAxKTtcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICsraTtcclxuICAgIH1cclxuICAgIHJldHVybiBwcmVmaXggKyBwYXJ0cy5qb2luKFwiL1wiKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZXNvbHZlcyB0aGUgc3BlY2lmaWVkIGluY2x1ZGUgcGF0aCBhZ2FpbnN0IHRoZSBzcGVjaWZpZWQgb3JpZ2luIHBhdGguXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBvcmlnaW5QYXRoIFBhdGggdG8gdGhlIG9yaWdpbiBmaWxlXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBpbmNsdWRlUGF0aCBJbmNsdWRlIHBhdGggcmVsYXRpdmUgdG8gb3JpZ2luIHBhdGhcclxuICogQHBhcmFtIHtib29sZWFufSBbYWxyZWFkeU5vcm1hbGl6ZWQ9ZmFsc2VdIGB0cnVlYCBpZiBib3RoIHBhdGhzIGFyZSBhbHJlYWR5IGtub3duIHRvIGJlIG5vcm1hbGl6ZWRcclxuICogQHJldHVybnMge3N0cmluZ30gUGF0aCB0byB0aGUgaW5jbHVkZSBmaWxlXHJcbiAqL1xyXG5wYXRoLnJlc29sdmUgPSBmdW5jdGlvbiByZXNvbHZlKG9yaWdpblBhdGgsIGluY2x1ZGVQYXRoLCBhbHJlYWR5Tm9ybWFsaXplZCkge1xyXG4gICAgaWYgKCFhbHJlYWR5Tm9ybWFsaXplZClcclxuICAgICAgICBpbmNsdWRlUGF0aCA9IG5vcm1hbGl6ZShpbmNsdWRlUGF0aCk7XHJcbiAgICBpZiAoaXNBYnNvbHV0ZShpbmNsdWRlUGF0aCkpXHJcbiAgICAgICAgcmV0dXJuIGluY2x1ZGVQYXRoO1xyXG4gICAgaWYgKCFhbHJlYWR5Tm9ybWFsaXplZClcclxuICAgICAgICBvcmlnaW5QYXRoID0gbm9ybWFsaXplKG9yaWdpblBhdGgpO1xyXG4gICAgcmV0dXJuIChvcmlnaW5QYXRoID0gb3JpZ2luUGF0aC5yZXBsYWNlKC8oPzpcXC98XilbXi9dKyQvLCBcIlwiKSkubGVuZ3RoID8gbm9ybWFsaXplKG9yaWdpblBhdGggKyBcIi9cIiArIGluY2x1ZGVQYXRoKSA6IGluY2x1ZGVQYXRoO1xyXG59O1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxubW9kdWxlLmV4cG9ydHMgPSBwb29sO1xyXG5cclxuLyoqXHJcbiAqIEFuIGFsbG9jYXRvciBhcyB1c2VkIGJ5IHtAbGluayB1dGlsLnBvb2x9LlxyXG4gKiBAdHlwZWRlZiBQb29sQWxsb2NhdG9yXHJcbiAqIEB0eXBlIHtmdW5jdGlvbn1cclxuICogQHBhcmFtIHtudW1iZXJ9IHNpemUgQnVmZmVyIHNpemVcclxuICogQHJldHVybnMge1VpbnQ4QXJyYXl9IEJ1ZmZlclxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBBIHNsaWNlciBhcyB1c2VkIGJ5IHtAbGluayB1dGlsLnBvb2x9LlxyXG4gKiBAdHlwZWRlZiBQb29sU2xpY2VyXHJcbiAqIEB0eXBlIHtmdW5jdGlvbn1cclxuICogQHBhcmFtIHtudW1iZXJ9IHN0YXJ0IFN0YXJ0IG9mZnNldFxyXG4gKiBAcGFyYW0ge251bWJlcn0gZW5kIEVuZCBvZmZzZXRcclxuICogQHJldHVybnMge1VpbnQ4QXJyYXl9IEJ1ZmZlciBzbGljZVxyXG4gKiBAdGhpcyB7VWludDhBcnJheX1cclxuICovXHJcblxyXG4vKipcclxuICogQSBnZW5lcmFsIHB1cnBvc2UgYnVmZmVyIHBvb2wuXHJcbiAqIEBtZW1iZXJvZiB1dGlsXHJcbiAqIEBmdW5jdGlvblxyXG4gKiBAcGFyYW0ge1Bvb2xBbGxvY2F0b3J9IGFsbG9jIEFsbG9jYXRvclxyXG4gKiBAcGFyYW0ge1Bvb2xTbGljZXJ9IHNsaWNlIFNsaWNlclxyXG4gKiBAcGFyYW0ge251bWJlcn0gW3NpemU9ODE5Ml0gU2xhYiBzaXplXHJcbiAqIEByZXR1cm5zIHtQb29sQWxsb2NhdG9yfSBQb29sZWQgYWxsb2NhdG9yXHJcbiAqL1xyXG5mdW5jdGlvbiBwb29sKGFsbG9jLCBzbGljZSwgc2l6ZSkge1xyXG4gICAgdmFyIFNJWkUgICA9IHNpemUgfHwgODE5MjtcclxuICAgIHZhciBNQVggICAgPSBTSVpFID4+PiAxO1xyXG4gICAgdmFyIHNsYWIgICA9IG51bGw7XHJcbiAgICB2YXIgb2Zmc2V0ID0gU0laRTtcclxuICAgIHJldHVybiBmdW5jdGlvbiBwb29sX2FsbG9jKHNpemUpIHtcclxuICAgICAgICBpZiAoc2l6ZSA8IDEgfHwgc2l6ZSA+IE1BWClcclxuICAgICAgICAgICAgcmV0dXJuIGFsbG9jKHNpemUpO1xyXG4gICAgICAgIGlmIChvZmZzZXQgKyBzaXplID4gU0laRSkge1xyXG4gICAgICAgICAgICBzbGFiID0gYWxsb2MoU0laRSk7XHJcbiAgICAgICAgICAgIG9mZnNldCA9IDA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciBidWYgPSBzbGljZS5jYWxsKHNsYWIsIG9mZnNldCwgb2Zmc2V0ICs9IHNpemUpO1xyXG4gICAgICAgIGlmIChvZmZzZXQgJiA3KSAvLyBhbGlnbiB0byAzMiBiaXRcclxuICAgICAgICAgICAgb2Zmc2V0ID0gKG9mZnNldCB8IDcpICsgMTtcclxuICAgICAgICByZXR1cm4gYnVmO1xyXG4gICAgfTtcclxufVxyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxuXHJcbi8qKlxyXG4gKiBBIG1pbmltYWwgVVRGOCBpbXBsZW1lbnRhdGlvbiBmb3IgbnVtYmVyIGFycmF5cy5cclxuICogQG1lbWJlcm9mIHV0aWxcclxuICogQG5hbWVzcGFjZVxyXG4gKi9cclxudmFyIHV0ZjggPSBleHBvcnRzO1xyXG5cclxuLyoqXHJcbiAqIENhbGN1bGF0ZXMgdGhlIFVURjggYnl0ZSBsZW5ndGggb2YgYSBzdHJpbmcuXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBzdHJpbmcgU3RyaW5nXHJcbiAqIEByZXR1cm5zIHtudW1iZXJ9IEJ5dGUgbGVuZ3RoXHJcbiAqL1xyXG51dGY4Lmxlbmd0aCA9IGZ1bmN0aW9uIHV0ZjhfbGVuZ3RoKHN0cmluZykge1xyXG4gICAgdmFyIGxlbiA9IDAsXHJcbiAgICAgICAgYyA9IDA7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN0cmluZy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgIGMgPSBzdHJpbmcuY2hhckNvZGVBdChpKTtcclxuICAgICAgICBpZiAoYyA8IDEyOClcclxuICAgICAgICAgICAgbGVuICs9IDE7XHJcbiAgICAgICAgZWxzZSBpZiAoYyA8IDIwNDgpXHJcbiAgICAgICAgICAgIGxlbiArPSAyO1xyXG4gICAgICAgIGVsc2UgaWYgKChjICYgMHhGQzAwKSA9PT0gMHhEODAwICYmIChzdHJpbmcuY2hhckNvZGVBdChpICsgMSkgJiAweEZDMDApID09PSAweERDMDApIHtcclxuICAgICAgICAgICAgKytpO1xyXG4gICAgICAgICAgICBsZW4gKz0gNDtcclxuICAgICAgICB9IGVsc2VcclxuICAgICAgICAgICAgbGVuICs9IDM7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbGVuO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJlYWRzIFVURjggYnl0ZXMgYXMgYSBzdHJpbmcuXHJcbiAqIEBwYXJhbSB7VWludDhBcnJheX0gYnVmZmVyIFNvdXJjZSBidWZmZXJcclxuICogQHBhcmFtIHtudW1iZXJ9IHN0YXJ0IFNvdXJjZSBzdGFydFxyXG4gKiBAcGFyYW0ge251bWJlcn0gZW5kIFNvdXJjZSBlbmRcclxuICogQHJldHVybnMge3N0cmluZ30gU3RyaW5nIHJlYWRcclxuICovXHJcbnV0ZjgucmVhZCA9IGZ1bmN0aW9uIHV0ZjhfcmVhZChidWZmZXIsIHN0YXJ0LCBlbmQpIHtcclxuICAgIHZhciBsZW4gPSBlbmQgLSBzdGFydDtcclxuICAgIGlmIChsZW4gPCAxKVxyXG4gICAgICAgIHJldHVybiBcIlwiO1xyXG4gICAgdmFyIHBhcnRzID0gbnVsbCxcclxuICAgICAgICBjaHVuayA9IFtdLFxyXG4gICAgICAgIGkgPSAwLCAvLyBjaGFyIG9mZnNldFxyXG4gICAgICAgIHQ7ICAgICAvLyB0ZW1wb3JhcnlcclxuICAgIHdoaWxlIChzdGFydCA8IGVuZCkge1xyXG4gICAgICAgIHQgPSBidWZmZXJbc3RhcnQrK107XHJcbiAgICAgICAgaWYgKHQgPCAxMjgpXHJcbiAgICAgICAgICAgIGNodW5rW2krK10gPSB0O1xyXG4gICAgICAgIGVsc2UgaWYgKHQgPiAxOTEgJiYgdCA8IDIyNClcclxuICAgICAgICAgICAgY2h1bmtbaSsrXSA9ICh0ICYgMzEpIDw8IDYgfCBidWZmZXJbc3RhcnQrK10gJiA2MztcclxuICAgICAgICBlbHNlIGlmICh0ID4gMjM5ICYmIHQgPCAzNjUpIHtcclxuICAgICAgICAgICAgdCA9ICgodCAmIDcpIDw8IDE4IHwgKGJ1ZmZlcltzdGFydCsrXSAmIDYzKSA8PCAxMiB8IChidWZmZXJbc3RhcnQrK10gJiA2MykgPDwgNiB8IGJ1ZmZlcltzdGFydCsrXSAmIDYzKSAtIDB4MTAwMDA7XHJcbiAgICAgICAgICAgIGNodW5rW2krK10gPSAweEQ4MDAgKyAodCA+PiAxMCk7XHJcbiAgICAgICAgICAgIGNodW5rW2krK10gPSAweERDMDAgKyAodCAmIDEwMjMpO1xyXG4gICAgICAgIH0gZWxzZVxyXG4gICAgICAgICAgICBjaHVua1tpKytdID0gKHQgJiAxNSkgPDwgMTIgfCAoYnVmZmVyW3N0YXJ0KytdICYgNjMpIDw8IDYgfCBidWZmZXJbc3RhcnQrK10gJiA2MztcclxuICAgICAgICBpZiAoaSA+IDgxOTEpIHtcclxuICAgICAgICAgICAgKHBhcnRzIHx8IChwYXJ0cyA9IFtdKSkucHVzaChTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KFN0cmluZywgY2h1bmspKTtcclxuICAgICAgICAgICAgaSA9IDA7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgaWYgKHBhcnRzKSB7XHJcbiAgICAgICAgaWYgKGkpXHJcbiAgICAgICAgICAgIHBhcnRzLnB1c2goU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShTdHJpbmcsIGNodW5rLnNsaWNlKDAsIGkpKSk7XHJcbiAgICAgICAgcmV0dXJuIHBhcnRzLmpvaW4oXCJcIik7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShTdHJpbmcsIGNodW5rLnNsaWNlKDAsIGkpKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBXcml0ZXMgYSBzdHJpbmcgYXMgVVRGOCBieXRlcy5cclxuICogQHBhcmFtIHtzdHJpbmd9IHN0cmluZyBTb3VyY2Ugc3RyaW5nXHJcbiAqIEBwYXJhbSB7VWludDhBcnJheX0gYnVmZmVyIERlc3RpbmF0aW9uIGJ1ZmZlclxyXG4gKiBAcGFyYW0ge251bWJlcn0gb2Zmc2V0IERlc3RpbmF0aW9uIG9mZnNldFxyXG4gKiBAcmV0dXJucyB7bnVtYmVyfSBCeXRlcyB3cml0dGVuXHJcbiAqL1xyXG51dGY4LndyaXRlID0gZnVuY3Rpb24gdXRmOF93cml0ZShzdHJpbmcsIGJ1ZmZlciwgb2Zmc2V0KSB7XHJcbiAgICB2YXIgc3RhcnQgPSBvZmZzZXQsXHJcbiAgICAgICAgYzEsIC8vIGNoYXJhY3RlciAxXHJcbiAgICAgICAgYzI7IC8vIGNoYXJhY3RlciAyXHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN0cmluZy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgIGMxID0gc3RyaW5nLmNoYXJDb2RlQXQoaSk7XHJcbiAgICAgICAgaWYgKGMxIDwgMTI4KSB7XHJcbiAgICAgICAgICAgIGJ1ZmZlcltvZmZzZXQrK10gPSBjMTtcclxuICAgICAgICB9IGVsc2UgaWYgKGMxIDwgMjA0OCkge1xyXG4gICAgICAgICAgICBidWZmZXJbb2Zmc2V0KytdID0gYzEgPj4gNiAgICAgICB8IDE5MjtcclxuICAgICAgICAgICAgYnVmZmVyW29mZnNldCsrXSA9IGMxICAgICAgICYgNjMgfCAxMjg7XHJcbiAgICAgICAgfSBlbHNlIGlmICgoYzEgJiAweEZDMDApID09PSAweEQ4MDAgJiYgKChjMiA9IHN0cmluZy5jaGFyQ29kZUF0KGkgKyAxKSkgJiAweEZDMDApID09PSAweERDMDApIHtcclxuICAgICAgICAgICAgYzEgPSAweDEwMDAwICsgKChjMSAmIDB4MDNGRikgPDwgMTApICsgKGMyICYgMHgwM0ZGKTtcclxuICAgICAgICAgICAgKytpO1xyXG4gICAgICAgICAgICBidWZmZXJbb2Zmc2V0KytdID0gYzEgPj4gMTggICAgICB8IDI0MDtcclxuICAgICAgICAgICAgYnVmZmVyW29mZnNldCsrXSA9IGMxID4+IDEyICYgNjMgfCAxMjg7XHJcbiAgICAgICAgICAgIGJ1ZmZlcltvZmZzZXQrK10gPSBjMSA+PiA2ICAmIDYzIHwgMTI4O1xyXG4gICAgICAgICAgICBidWZmZXJbb2Zmc2V0KytdID0gYzEgICAgICAgJiA2MyB8IDEyODtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBidWZmZXJbb2Zmc2V0KytdID0gYzEgPj4gMTIgICAgICB8IDIyNDtcclxuICAgICAgICAgICAgYnVmZmVyW29mZnNldCsrXSA9IGMxID4+IDYgICYgNjMgfCAxMjg7XHJcbiAgICAgICAgICAgIGJ1ZmZlcltvZmZzZXQrK10gPSBjMSAgICAgICAmIDYzIHwgMTI4O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBvZmZzZXQgLSBzdGFydDtcclxufTtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcIi4vc3JjL2luZGV4XCIpO1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxubW9kdWxlLmV4cG9ydHMgPSBDbGFzcztcclxuXHJcbnZhciBNZXNzYWdlID0gcmVxdWlyZShcIi4vbWVzc2FnZVwiKSxcclxuICAgIHV0aWwgICAgPSByZXF1aXJlKFwiLi91dGlsXCIpO1xyXG5cclxudmFyIFR5cGU7IC8vIGN5Y2xpY1xyXG5cclxuLyoqXHJcbiAqIENvbnN0cnVjdHMgYSBuZXcgbWVzc2FnZSBwcm90b3R5cGUgZm9yIHRoZSBzcGVjaWZpZWQgcmVmbGVjdGVkIHR5cGUgYW5kIHNldHMgdXAgaXRzIGNvbnN0cnVjdG9yLlxyXG4gKiBAY2xhc3NkZXNjIFJ1bnRpbWUgY2xhc3MgcHJvdmlkaW5nIHRoZSB0b29scyB0byBjcmVhdGUgeW91ciBvd24gY3VzdG9tIGNsYXNzZXMuXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKiBAcGFyYW0ge1R5cGV9IHR5cGUgUmVmbGVjdGVkIG1lc3NhZ2UgdHlwZVxyXG4gKiBAcGFyYW0geyp9IFtjdG9yXSBDdXN0b20gY29uc3RydWN0b3IgdG8gc2V0IHVwLCBkZWZhdWx0cyB0byBjcmVhdGUgYSBnZW5lcmljIG9uZSBpZiBvbWl0dGVkXHJcbiAqIEByZXR1cm5zIHtNZXNzYWdlfSBNZXNzYWdlIHByb3RvdHlwZVxyXG4gKi9cclxuZnVuY3Rpb24gQ2xhc3ModHlwZSwgY3Rvcikge1xyXG4gICAgaWYgKCFUeXBlKVxyXG4gICAgICAgIFR5cGUgPSByZXF1aXJlKFwiLi90eXBlXCIpO1xyXG5cclxuICAgIGlmICghKHR5cGUgaW5zdGFuY2VvZiBUeXBlKSlcclxuICAgICAgICB0aHJvdyBUeXBlRXJyb3IoXCJ0eXBlIG11c3QgYmUgYSBUeXBlXCIpO1xyXG5cclxuICAgIGlmIChjdG9yKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBjdG9yICE9PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgICAgIHRocm93IFR5cGVFcnJvcihcImN0b3IgbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO1xyXG4gICAgfSBlbHNlXHJcbiAgICAgICAgLy8gY3JlYXRlIG5hbWVkIGNvbnN0cnVjdG9yIGZ1bmN0aW9ucyAoY29kZWdlbiBpcyByZXF1aXJlZCBhbnl3YXkpXHJcbiAgICAgICAgY3RvciA9IHV0aWwuY29kZWdlbihcInBcIikoXCJyZXR1cm4gYy5jYWxsKHRoaXMscClcIikuZW9mKHR5cGUubmFtZSwge1xyXG4gICAgICAgICAgICBjOiBNZXNzYWdlXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgLy8gTGV0J3MgcHJldGVuZC4uLlxyXG4gICAgY3Rvci5jb25zdHJ1Y3RvciA9IENsYXNzO1xyXG5cclxuICAgIC8vIG5ldyBDbGFzcygpIC0+IE1lc3NhZ2UucHJvdG90eXBlXHJcbiAgICAoY3Rvci5wcm90b3R5cGUgPSBuZXcgTWVzc2FnZSgpKS5jb25zdHJ1Y3RvciA9IGN0b3I7XHJcblxyXG4gICAgLy8gU3RhdGljIG1ldGhvZHMgb24gTWVzc2FnZSBhcmUgaW5zdGFuY2UgbWV0aG9kcyBvbiBDbGFzcyBhbmQgdmljZSB2ZXJzYVxyXG4gICAgdXRpbC5tZXJnZShjdG9yLCBNZXNzYWdlLCB0cnVlKTtcclxuXHJcbiAgICAvLyBDbGFzc2VzIGFuZCBtZXNzYWdlcyByZWZlcmVuY2UgdGhlaXIgcmVmbGVjdGVkIHR5cGVcclxuICAgIGN0b3IuJHR5cGUgPSB0eXBlO1xyXG4gICAgY3Rvci5wcm90b3R5cGUuJHR5cGUgPSB0eXBlO1xyXG5cclxuICAgIC8vIE1lc3NhZ2VzIGhhdmUgbm9uLWVudW1lcmFibGUgZGVmYXVsdCB2YWx1ZXMgb24gdGhlaXIgcHJvdG90eXBlXHJcbiAgICB2YXIgaSA9IDA7XHJcbiAgICBmb3IgKDsgaSA8IC8qIGluaXRpYWxpemVzICovIHR5cGUuZmllbGRzQXJyYXkubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAvLyBvYmplY3RzIG9uIHRoZSBwcm90b3R5cGUgbXVzdCBiZSBpbW1tdXRhYmxlLiB1c2VycyBtdXN0IGFzc2lnbiBhIG5ldyBvYmplY3QgaW5zdGFuY2UgYW5kXHJcbiAgICAgICAgLy8gY2Fubm90IHVzZSBBcnJheSNwdXNoIG9uIGVtcHR5IGFycmF5cyBvbiB0aGUgcHJvdG90eXBlIGZvciBleGFtcGxlLCBhcyB0aGlzIHdvdWxkIG1vZGlmeVxyXG4gICAgICAgIC8vIHRoZSB2YWx1ZSBvbiB0aGUgcHJvdG90eXBlIGZvciBBTEwgbWVzc2FnZXMgb2YgdGhpcyB0eXBlLiBIZW5jZSwgdGhlc2Ugb2JqZWN0cyBhcmUgZnJvemVuLlxyXG4gICAgICAgIGN0b3IucHJvdG90eXBlW3R5cGUuX2ZpZWxkc0FycmF5W2ldLm5hbWVdID0gQXJyYXkuaXNBcnJheSh0eXBlLl9maWVsZHNBcnJheVtpXS5yZXNvbHZlKCkuZGVmYXVsdFZhbHVlKVxyXG4gICAgICAgICAgICA/IHV0aWwuZW1wdHlBcnJheVxyXG4gICAgICAgICAgICA6IHV0aWwuaXNPYmplY3QodHlwZS5fZmllbGRzQXJyYXlbaV0uZGVmYXVsdFZhbHVlKSAmJiAhdHlwZS5fZmllbGRzQXJyYXlbaV0ubG9uZ1xyXG4gICAgICAgICAgICAgID8gdXRpbC5lbXB0eU9iamVjdFxyXG4gICAgICAgICAgICAgIDogdHlwZS5fZmllbGRzQXJyYXlbaV0uZGVmYXVsdFZhbHVlOyAvLyBpZiBhIGxvbmcsIGl0IGlzIGZyb3plbiB3aGVuIGluaXRpYWxpemVkXHJcbiAgICB9XHJcblxyXG4gICAgLy8gTWVzc2FnZXMgaGF2ZSBub24tZW51bWVyYWJsZSBnZXR0ZXJzIGFuZCBzZXR0ZXJzIGZvciBlYWNoIHZpcnR1YWwgb25lb2YgZmllbGRcclxuICAgIHZhciBjdG9yUHJvcGVydGllcyA9IHt9O1xyXG4gICAgZm9yIChpID0gMDsgaSA8IC8qIGluaXRpYWxpemVzICovIHR5cGUub25lb2ZzQXJyYXkubGVuZ3RoOyArK2kpXHJcbiAgICAgICAgY3RvclByb3BlcnRpZXNbdHlwZS5fb25lb2ZzQXJyYXlbaV0ucmVzb2x2ZSgpLm5hbWVdID0ge1xyXG4gICAgICAgICAgICBnZXQ6IHV0aWwub25lT2ZHZXR0ZXIodHlwZS5fb25lb2ZzQXJyYXlbaV0ub25lb2YpLFxyXG4gICAgICAgICAgICBzZXQ6IHV0aWwub25lT2ZTZXR0ZXIodHlwZS5fb25lb2ZzQXJyYXlbaV0ub25lb2YpXHJcbiAgICAgICAgfTtcclxuICAgIGlmIChpKVxyXG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKGN0b3IucHJvdG90eXBlLCBjdG9yUHJvcGVydGllcyk7XHJcblxyXG4gICAgLy8gUmVnaXN0ZXJcclxuICAgIHR5cGUuY3RvciA9IGN0b3I7XHJcblxyXG4gICAgcmV0dXJuIGN0b3IucHJvdG90eXBlO1xyXG59XHJcblxyXG4vKipcclxuICogQ29uc3RydWN0cyBhIG5ldyBtZXNzYWdlIHByb3RvdHlwZSBmb3IgdGhlIHNwZWNpZmllZCByZWZsZWN0ZWQgdHlwZSBhbmQgc2V0cyB1cCBpdHMgY29uc3RydWN0b3IuXHJcbiAqIEBmdW5jdGlvblxyXG4gKiBAcGFyYW0ge1R5cGV9IHR5cGUgUmVmbGVjdGVkIG1lc3NhZ2UgdHlwZVxyXG4gKiBAcGFyYW0geyp9IFtjdG9yXSBDdXN0b20gY29uc3RydWN0b3IgdG8gc2V0IHVwLCBkZWZhdWx0cyB0byBjcmVhdGUgYSBnZW5lcmljIG9uZSBpZiBvbWl0dGVkXHJcbiAqIEByZXR1cm5zIHtNZXNzYWdlfSBNZXNzYWdlIHByb3RvdHlwZVxyXG4gKi9cclxuQ2xhc3MuY3JlYXRlID0gQ2xhc3M7XHJcblxyXG4vLyBTdGF0aWMgbWV0aG9kcyBvbiBNZXNzYWdlIGFyZSBpbnN0YW5jZSBtZXRob2RzIG9uIENsYXNzIGFuZCB2aWNlIHZlcnNhXHJcbkNsYXNzLnByb3RvdHlwZSA9IE1lc3NhZ2U7XHJcblxyXG4vKipcclxuICogQ3JlYXRlcyBhIG5ldyBtZXNzYWdlIG9mIHRoaXMgdHlwZSBmcm9tIGEgcGxhaW4gb2JqZWN0LiBBbHNvIGNvbnZlcnRzIHZhbHVlcyB0byB0aGVpciByZXNwZWN0aXZlIGludGVybmFsIHR5cGVzLlxyXG4gKiBAbmFtZSBDbGFzcyNmcm9tT2JqZWN0XHJcbiAqIEBmdW5jdGlvblxyXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCo+fSBvYmplY3QgUGxhaW4gb2JqZWN0XHJcbiAqIEByZXR1cm5zIHtNZXNzYWdlfSBNZXNzYWdlIGluc3RhbmNlXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIENyZWF0ZXMgYSBuZXcgbWVzc2FnZSBvZiB0aGlzIHR5cGUgZnJvbSBhIHBsYWluIG9iamVjdC4gQWxzbyBjb252ZXJ0cyB2YWx1ZXMgdG8gdGhlaXIgcmVzcGVjdGl2ZSBpbnRlcm5hbCB0eXBlcy5cclxuICogVGhpcyBpcyBhbiBhbGlhcyBvZiB7QGxpbmsgQ2xhc3MjZnJvbU9iamVjdH0uXHJcbiAqIEBuYW1lIENsYXNzI2Zyb21cclxuICogQGZ1bmN0aW9uXHJcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsKj59IG9iamVjdCBQbGFpbiBvYmplY3RcclxuICogQHJldHVybnMge01lc3NhZ2V9IE1lc3NhZ2UgaW5zdGFuY2VcclxuICovXHJcblxyXG4vKipcclxuICogQ3JlYXRlcyBhIHBsYWluIG9iamVjdCBmcm9tIGEgbWVzc2FnZSBvZiB0aGlzIHR5cGUuIEFsc28gY29udmVydHMgdmFsdWVzIHRvIG90aGVyIHR5cGVzIGlmIHNwZWNpZmllZC5cclxuICogQG5hbWUgQ2xhc3MjdG9PYmplY3RcclxuICogQGZ1bmN0aW9uXHJcbiAqIEBwYXJhbSB7TWVzc2FnZX0gbWVzc2FnZSBNZXNzYWdlIGluc3RhbmNlXHJcbiAqIEBwYXJhbSB7Q29udmVyc2lvbk9wdGlvbnN9IFtvcHRpb25zXSBDb252ZXJzaW9uIG9wdGlvbnNcclxuICogQHJldHVybnMge09iamVjdC48c3RyaW5nLCo+fSBQbGFpbiBvYmplY3RcclxuICovXHJcblxyXG4vKipcclxuICogRW5jb2RlcyBhIG1lc3NhZ2Ugb2YgdGhpcyB0eXBlLlxyXG4gKiBAbmFtZSBDbGFzcyNlbmNvZGVcclxuICogQGZ1bmN0aW9uXHJcbiAqIEBwYXJhbSB7TWVzc2FnZXxPYmplY3R9IG1lc3NhZ2UgTWVzc2FnZSB0byBlbmNvZGVcclxuICogQHBhcmFtIHtXcml0ZXJ9IFt3cml0ZXJdIFdyaXRlciB0byB1c2VcclxuICogQHJldHVybnMge1dyaXRlcn0gV3JpdGVyXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIEVuY29kZXMgYSBtZXNzYWdlIG9mIHRoaXMgdHlwZSBwcmVjZWVkZWQgYnkgaXRzIGxlbmd0aCBhcyBhIHZhcmludC5cclxuICogQG5hbWUgQ2xhc3MjZW5jb2RlRGVsaW1pdGVkXHJcbiAqIEBmdW5jdGlvblxyXG4gKiBAcGFyYW0ge01lc3NhZ2V8T2JqZWN0fSBtZXNzYWdlIE1lc3NhZ2UgdG8gZW5jb2RlXHJcbiAqIEBwYXJhbSB7V3JpdGVyfSBbd3JpdGVyXSBXcml0ZXIgdG8gdXNlXHJcbiAqIEByZXR1cm5zIHtXcml0ZXJ9IFdyaXRlclxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBEZWNvZGVzIGEgbWVzc2FnZSBvZiB0aGlzIHR5cGUuXHJcbiAqIEBuYW1lIENsYXNzI2RlY29kZVxyXG4gKiBAZnVuY3Rpb25cclxuICogQHBhcmFtIHtSZWFkZXJ8VWludDhBcnJheX0gcmVhZGVyIFJlYWRlciBvciBidWZmZXIgdG8gZGVjb2RlXHJcbiAqIEByZXR1cm5zIHtNZXNzYWdlfSBEZWNvZGVkIG1lc3NhZ2VcclxuICovXHJcblxyXG4vKipcclxuICogRGVjb2RlcyBhIG1lc3NhZ2Ugb2YgdGhpcyB0eXBlIHByZWNlZWRlZCBieSBpdHMgbGVuZ3RoIGFzIGEgdmFyaW50LlxyXG4gKiBAbmFtZSBDbGFzcyNkZWNvZGVEZWxpbWl0ZWRcclxuICogQGZ1bmN0aW9uXHJcbiAqIEBwYXJhbSB7UmVhZGVyfFVpbnQ4QXJyYXl9IHJlYWRlciBSZWFkZXIgb3IgYnVmZmVyIHRvIGRlY29kZVxyXG4gKiBAcmV0dXJucyB7TWVzc2FnZX0gRGVjb2RlZCBtZXNzYWdlXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIFZlcmlmaWVzIGEgbWVzc2FnZSBvZiB0aGlzIHR5cGUuXHJcbiAqIEBuYW1lIENsYXNzI3ZlcmlmeVxyXG4gKiBAZnVuY3Rpb25cclxuICogQHBhcmFtIHtNZXNzYWdlfE9iamVjdH0gbWVzc2FnZSBNZXNzYWdlIG9yIHBsYWluIG9iamVjdCB0byB2ZXJpZnlcclxuICogQHJldHVybnMgez9zdHJpbmd9IGBudWxsYCBpZiB2YWxpZCwgb3RoZXJ3aXNlIHRoZSByZWFzb24gd2h5IGl0IGlzIG5vdFxyXG4gKi9cclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbm1vZHVsZS5leHBvcnRzID0gY29tbW9uO1xyXG5cclxuLyoqXHJcbiAqIFByb3ZpZGVzIGNvbW1vbiB0eXBlIGRlZmluaXRpb25zLlxyXG4gKiBDYW4gYWxzbyBiZSB1c2VkIHRvIHByb3ZpZGUgYWRkaXRpb25hbCBnb29nbGUgdHlwZXMgb3IgeW91ciBvd24gY3VzdG9tIHR5cGVzLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBTaG9ydCBuYW1lIGFzIGluIGBnb29nbGUvcHJvdG9idWYvW25hbWVdLnByb3RvYCBvciBmdWxsIGZpbGUgbmFtZVxyXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCo+fSBqc29uIEpTT04gZGVmaW5pdGlvbiB3aXRoaW4gYGdvb2dsZS5wcm90b2J1ZmAgaWYgYSBzaG9ydCBuYW1lLCBvdGhlcndpc2UgdGhlIGZpbGUncyByb290IGRlZmluaXRpb25cclxuICogQHJldHVybnMge3VuZGVmaW5lZH1cclxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywqPn0gZ29vZ2xlL3Byb3RvYnVmL2FueS5wcm90byBBbnlcclxuICogQHByb3BlcnR5IHtPYmplY3QuPHN0cmluZywqPn0gZ29vZ2xlL3Byb3RvYnVmL2R1cmF0aW9uLnByb3RvIER1cmF0aW9uXHJcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsKj59IGdvb2dsZS9wcm90b2J1Zi9lbXB0eS5wcm90byBFbXB0eVxyXG4gKiBAcHJvcGVydHkge09iamVjdC48c3RyaW5nLCo+fSBnb29nbGUvcHJvdG9idWYvc3RydWN0LnByb3RvIFN0cnVjdCwgVmFsdWUsIE51bGxWYWx1ZSBhbmQgTGlzdFZhbHVlXHJcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsKj59IGdvb2dsZS9wcm90b2J1Zi90aW1lc3RhbXAucHJvdG8gVGltZXN0YW1wXHJcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsKj59IGdvb2dsZS9wcm90b2J1Zi93cmFwcGVycy5wcm90byBXcmFwcGVyc1xyXG4gKiBAZXhhbXBsZVxyXG4gKiAvLyBtYW51YWxseSBwcm92aWRlcyBkZXNjcmlwdG9yLnByb3RvIChhc3N1bWVzIGdvb2dsZS9wcm90b2J1Zi8gbmFtZXNwYWNlIGFuZCAucHJvdG8gZXh0ZW5zaW9uKVxyXG4gKiBwcm90b2J1Zi5jb21tb24oXCJkZXNjcmlwdG9yXCIsIGRlc2NyaXB0b3JKc29uKTtcclxuICogXHJcbiAqIC8vIG1hbnVhbGx5IHByb3ZpZGVzIGEgY3VzdG9tIGRlZmluaXRpb24gKHVzZXMgbXkuZm9vIG5hbWVzcGFjZSlcclxuICogcHJvdG9idWYuY29tbW9uKFwibXkvZm9vL2Jhci5wcm90b1wiLCBteUZvb0Jhckpzb24pO1xyXG4gKi9cclxuZnVuY3Rpb24gY29tbW9uKG5hbWUsIGpzb24pIHtcclxuICAgIGlmICghL1xcL3xcXC4vLnRlc3QobmFtZSkpIHtcclxuICAgICAgICBuYW1lID0gXCJnb29nbGUvcHJvdG9idWYvXCIgKyBuYW1lICsgXCIucHJvdG9cIjtcclxuICAgICAgICBqc29uID0geyBuZXN0ZWQ6IHsgZ29vZ2xlOiB7IG5lc3RlZDogeyBwcm90b2J1ZjogeyBuZXN0ZWQ6IGpzb24gfSB9IH0gfSB9O1xyXG4gICAgfVxyXG4gICAgY29tbW9uW25hbWVdID0ganNvbjtcclxufVxyXG5cclxuLy8gTm90IHByb3ZpZGVkIGJlY2F1c2Ugb2YgbGltaXRlZCB1c2UgKGZlZWwgZnJlZSB0byBkaXNjdXNzIG9yIHRvIHByb3ZpZGUgeW91cnNlbGYpOlxyXG4vL1xyXG4vLyBnb29nbGUvcHJvdG9idWYvZGVzY3JpcHRvci5wcm90b1xyXG4vLyBnb29nbGUvcHJvdG9idWYvZmllbGRfbWFzay5wcm90b1xyXG4vLyBnb29nbGUvcHJvdG9idWYvc291cmNlX2NvbnRleHQucHJvdG9cclxuLy8gZ29vZ2xlL3Byb3RvYnVmL3R5cGUucHJvdG9cclxuLy9cclxuLy8gU3RyaXBwZWQgYW5kIHByZS1wYXJzZWQgdmVyc2lvbnMgb2YgdGhlc2Ugbm9uLWJ1bmRsZWQgZmlsZXMgYXJlIGluc3RlYWQgYXZhaWxhYmxlIGFzIHBhcnQgb2ZcclxuLy8gdGhlIHJlcG9zaXRvcnkgb3IgcGFja2FnZSB3aXRoaW4gdGhlIGdvb2dsZS9wcm90b2J1ZiBkaXJlY3RvcnkuXHJcblxyXG5jb21tb24oXCJhbnlcIiwge1xyXG4gICAgQW55OiB7XHJcbiAgICAgICAgZmllbGRzOiB7XHJcbiAgICAgICAgICAgIHR5cGVfdXJsOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiBcInN0cmluZ1wiLFxyXG4gICAgICAgICAgICAgICAgaWQ6IDFcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgdmFsdWU6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6IFwiYnl0ZXNcIixcclxuICAgICAgICAgICAgICAgIGlkOiAyXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbn0pO1xyXG5cclxudmFyIHRpbWVUeXBlO1xyXG5cclxuY29tbW9uKFwiZHVyYXRpb25cIiwge1xyXG4gICAgRHVyYXRpb246IHRpbWVUeXBlID0ge1xyXG4gICAgICAgIGZpZWxkczoge1xyXG4gICAgICAgICAgICBzZWNvbmRzOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiBcImludDY0XCIsXHJcbiAgICAgICAgICAgICAgICBpZDogMVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBuYW5vczoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogXCJpbnQzMlwiLFxyXG4gICAgICAgICAgICAgICAgaWQ6IDJcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufSk7XHJcblxyXG5jb21tb24oXCJ0aW1lc3RhbXBcIiwge1xyXG4gICAgVGltZXN0YW1wOiB0aW1lVHlwZVxyXG59KTtcclxuXHJcbmNvbW1vbihcImVtcHR5XCIsIHtcclxuICAgIEVtcHR5OiB7XHJcbiAgICAgICAgZmllbGRzOiB7fVxyXG4gICAgfVxyXG59KTtcclxuXHJcbmNvbW1vbihcInN0cnVjdFwiLCB7XHJcbiAgICBTdHJ1Y3Q6IHtcclxuICAgICAgICBmaWVsZHM6IHtcclxuICAgICAgICAgICAgZmllbGRzOiB7XHJcbiAgICAgICAgICAgICAgICBrZXlUeXBlOiBcInN0cmluZ1wiLFxyXG4gICAgICAgICAgICAgICAgdHlwZTogXCJWYWx1ZVwiLFxyXG4gICAgICAgICAgICAgICAgaWQ6IDFcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbiAgICBWYWx1ZToge1xyXG4gICAgICAgIG9uZW9mczoge1xyXG4gICAgICAgICAgICBraW5kOiB7XHJcbiAgICAgICAgICAgICAgICBvbmVvZjogW1xyXG4gICAgICAgICAgICAgICAgICAgIFwibnVsbFZhbHVlXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJudW1iZXJWYWx1ZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwic3RyaW5nVmFsdWVcIixcclxuICAgICAgICAgICAgICAgICAgICBcImJvb2xWYWx1ZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwic3RydWN0VmFsdWVcIixcclxuICAgICAgICAgICAgICAgICAgICBcImxpc3RWYWx1ZVwiXHJcbiAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIGZpZWxkczoge1xyXG4gICAgICAgICAgICBudWxsVmFsdWU6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6IFwiTnVsbFZhbHVlXCIsXHJcbiAgICAgICAgICAgICAgICBpZDogMVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBudW1iZXJWYWx1ZToge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogXCJkb3VibGVcIixcclxuICAgICAgICAgICAgICAgIGlkOiAyXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHN0cmluZ1ZhbHVlOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiBcInN0cmluZ1wiLFxyXG4gICAgICAgICAgICAgICAgaWQ6IDNcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgYm9vbFZhbHVlOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiBcImJvb2xcIixcclxuICAgICAgICAgICAgICAgIGlkOiA0XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHN0cnVjdFZhbHVlOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiBcIlN0cnVjdFwiLFxyXG4gICAgICAgICAgICAgICAgaWQ6IDVcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgbGlzdFZhbHVlOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiBcIkxpc3RWYWx1ZVwiLFxyXG4gICAgICAgICAgICAgICAgaWQ6IDZcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbiAgICBOdWxsVmFsdWU6IHtcclxuICAgICAgICB2YWx1ZXM6IHtcclxuICAgICAgICAgICAgTlVMTF9WQUxVRTogMFxyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbiAgICBMaXN0VmFsdWU6IHtcclxuICAgICAgICBmaWVsZHM6IHtcclxuICAgICAgICAgICAgdmFsdWVzOiB7XHJcbiAgICAgICAgICAgICAgICBydWxlOiBcInJlcGVhdGVkXCIsXHJcbiAgICAgICAgICAgICAgICB0eXBlOiBcIlZhbHVlXCIsXHJcbiAgICAgICAgICAgICAgICBpZDogMVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59KTtcclxuXHJcbmNvbW1vbihcIndyYXBwZXJzXCIsIHtcclxuICAgIERvdWJsZVZhbHVlOiB7XHJcbiAgICAgICAgZmllbGRzOiB7XHJcbiAgICAgICAgICAgIHZhbHVlOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiBcImRvdWJsZVwiLFxyXG4gICAgICAgICAgICAgICAgaWQ6IDFcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbiAgICBGbG9hdFZhbHVlOiB7XHJcbiAgICAgICAgZmllbGRzOiB7XHJcbiAgICAgICAgICAgIHZhbHVlOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiBcImZsb2F0XCIsXHJcbiAgICAgICAgICAgICAgICBpZDogMVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIEludDY0VmFsdWU6IHtcclxuICAgICAgICBmaWVsZHM6IHtcclxuICAgICAgICAgICAgdmFsdWU6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6IFwiaW50NjRcIixcclxuICAgICAgICAgICAgICAgIGlkOiAxXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgVUludDY0VmFsdWU6IHtcclxuICAgICAgICBmaWVsZHM6IHtcclxuICAgICAgICAgICAgdmFsdWU6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6IFwidWludDY0XCIsXHJcbiAgICAgICAgICAgICAgICBpZDogMVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIEludDMyVmFsdWU6IHtcclxuICAgICAgICBmaWVsZHM6IHtcclxuICAgICAgICAgICAgdmFsdWU6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6IFwiaW50MzJcIixcclxuICAgICAgICAgICAgICAgIGlkOiAxXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgVUludDMyVmFsdWU6IHtcclxuICAgICAgICBmaWVsZHM6IHtcclxuICAgICAgICAgICAgdmFsdWU6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6IFwidWludDMyXCIsXHJcbiAgICAgICAgICAgICAgICBpZDogMVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIEJvb2xWYWx1ZToge1xyXG4gICAgICAgIGZpZWxkczoge1xyXG4gICAgICAgICAgICB2YWx1ZToge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogXCJib29sXCIsXHJcbiAgICAgICAgICAgICAgICBpZDogMVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIFN0cmluZ1ZhbHVlOiB7XHJcbiAgICAgICAgZmllbGRzOiB7XHJcbiAgICAgICAgICAgIHZhbHVlOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiBcInN0cmluZ1wiLFxyXG4gICAgICAgICAgICAgICAgaWQ6IDFcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbiAgICBCeXRlc1ZhbHVlOiB7XHJcbiAgICAgICAgZmllbGRzOiB7XHJcbiAgICAgICAgICAgIHZhbHVlOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiBcImJ5dGVzXCIsXHJcbiAgICAgICAgICAgICAgICBpZDogMVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59KTtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbi8qKlxyXG4gKiBSdW50aW1lIG1lc3NhZ2UgZnJvbS90byBwbGFpbiBvYmplY3QgY29udmVydGVycy5cclxuICogQG5hbWVzcGFjZVxyXG4gKi9cclxudmFyIGNvbnZlcnRlciA9IGV4cG9ydHM7XHJcblxyXG52YXIgRW51bSA9IHJlcXVpcmUoXCIuL2VudW1cIiksXHJcbiAgICB1dGlsID0gcmVxdWlyZShcIi4vdXRpbFwiKTtcclxuXHJcbi8qKlxyXG4gKiBHZW5lcmF0ZXMgYSBwYXJ0aWFsIHZhbHVlIGZyb21PYmplY3QgY29udmV0ZXIuXHJcbiAqIEBwYXJhbSB7Q29kZWdlbn0gZ2VuIENvZGVnZW4gaW5zdGFuY2VcclxuICogQHBhcmFtIHtGaWVsZH0gZmllbGQgUmVmbGVjdGVkIGZpZWxkXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBmaWVsZEluZGV4IEZpZWxkIGluZGV4XHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wIFByb3BlcnR5IHJlZmVyZW5jZVxyXG4gKiBAcmV0dXJucyB7Q29kZWdlbn0gQ29kZWdlbiBpbnN0YW5jZVxyXG4gKiBAaWdub3JlXHJcbiAqL1xyXG5mdW5jdGlvbiBnZW5WYWx1ZVBhcnRpYWxfZnJvbU9iamVjdChnZW4sIGZpZWxkLCBmaWVsZEluZGV4LCBwcm9wKSB7XHJcbiAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby11bmV4cGVjdGVkLW11bHRpbGluZSwgYmxvY2stc2NvcGVkLXZhciwgbm8tcmVkZWNsYXJlICovXHJcbiAgICBpZiAoZmllbGQucmVzb2x2ZWRUeXBlKSB7XHJcbiAgICAgICAgaWYgKGZpZWxkLnJlc29sdmVkVHlwZSBpbnN0YW5jZW9mIEVudW0pIHsgZ2VuXHJcbiAgICAgICAgICAgIChcInN3aXRjaChkJXMpe1wiLCBwcm9wKTtcclxuICAgICAgICAgICAgZm9yICh2YXIgdmFsdWVzID0gZmllbGQucmVzb2x2ZWRUeXBlLnZhbHVlcywga2V5cyA9IE9iamVjdC5rZXlzKHZhbHVlcyksIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGZpZWxkLnJlcGVhdGVkICYmIHZhbHVlc1trZXlzW2ldXSA9PT0gZmllbGQudHlwZURlZmF1bHQpIGdlblxyXG4gICAgICAgICAgICAgICAgKFwiZGVmYXVsdDpcIik7XHJcbiAgICAgICAgICAgICAgICBnZW5cclxuICAgICAgICAgICAgICAgIChcImNhc2UlajpcIiwga2V5c1tpXSlcclxuICAgICAgICAgICAgICAgIChcImNhc2UgJWo6XCIsIHZhbHVlc1trZXlzW2ldXSlcclxuICAgICAgICAgICAgICAgICAgICAoXCJtJXM9JWpcIiwgcHJvcCwgdmFsdWVzW2tleXNbaV1dKVxyXG4gICAgICAgICAgICAgICAgICAgIChcImJyZWFrXCIpO1xyXG4gICAgICAgICAgICB9IGdlblxyXG4gICAgICAgICAgICAoXCJ9XCIpO1xyXG4gICAgICAgIH0gZWxzZSBnZW5cclxuICAgICAgICAgICAgKFwiaWYodHlwZW9mIGQlcyE9PVxcXCJvYmplY3RcXFwiKVwiLCBwcm9wKVxyXG4gICAgICAgICAgICAgICAgKFwidGhyb3cgVHlwZUVycm9yKCVqKVwiLCBmaWVsZC5mdWxsTmFtZSArIFwiOiBvYmplY3QgZXhwZWN0ZWRcIilcclxuICAgICAgICAgICAgKFwibSVzPXR5cGVzWyVkXS5mcm9tT2JqZWN0KGQlcylcIiwgcHJvcCwgZmllbGRJbmRleCwgcHJvcCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHZhciBpc1Vuc2lnbmVkID0gZmFsc2U7XHJcbiAgICAgICAgc3dpdGNoIChmaWVsZC50eXBlKSB7XHJcbiAgICAgICAgICAgIGNhc2UgXCJkb3VibGVcIjpcclxuICAgICAgICAgICAgY2FzZSBcImZsb2F0XCI6Z2VuXHJcbiAgICAgICAgICAgICAgICAoXCJtJXM9TnVtYmVyKGQlcylcIiwgcHJvcCwgcHJvcCk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBcInVpbnQzMlwiOlxyXG4gICAgICAgICAgICBjYXNlIFwiZml4ZWQzMlwiOiBnZW5cclxuICAgICAgICAgICAgICAgIChcIm0lcz1kJXM+Pj4wXCIsIHByb3AsIHByb3ApO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgXCJpbnQzMlwiOlxyXG4gICAgICAgICAgICBjYXNlIFwic2ludDMyXCI6XHJcbiAgICAgICAgICAgIGNhc2UgXCJzZml4ZWQzMlwiOiBnZW5cclxuICAgICAgICAgICAgICAgIChcIm0lcz1kJXN8MFwiLCBwcm9wLCBwcm9wKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIFwidWludDY0XCI6XHJcbiAgICAgICAgICAgICAgICBpc1Vuc2lnbmVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tZmFsbHRocm91Z2hcclxuICAgICAgICAgICAgY2FzZSBcImludDY0XCI6XHJcbiAgICAgICAgICAgIGNhc2UgXCJzaW50NjRcIjpcclxuICAgICAgICAgICAgY2FzZSBcImZpeGVkNjRcIjpcclxuICAgICAgICAgICAgY2FzZSBcInNmaXhlZDY0XCI6IGdlblxyXG4gICAgICAgICAgICAgICAgKFwiaWYodXRpbC5Mb25nKVwiKVxyXG4gICAgICAgICAgICAgICAgICAgIChcIihtJXM9dXRpbC5Mb25nLmZyb21WYWx1ZShkJXMpKS51bnNpZ25lZD0lalwiLCBwcm9wLCBwcm9wLCBpc1Vuc2lnbmVkKVxyXG4gICAgICAgICAgICAgICAgKFwiZWxzZSBpZih0eXBlb2YgZCVzPT09XFxcInN0cmluZ1xcXCIpXCIsIHByb3ApXHJcbiAgICAgICAgICAgICAgICAgICAgKFwibSVzPXBhcnNlSW50KGQlcywxMClcIiwgcHJvcCwgcHJvcClcclxuICAgICAgICAgICAgICAgIChcImVsc2UgaWYodHlwZW9mIGQlcz09PVxcXCJudW1iZXJcXFwiKVwiLCBwcm9wKVxyXG4gICAgICAgICAgICAgICAgICAgIChcIm0lcz1kJXNcIiwgcHJvcCwgcHJvcClcclxuICAgICAgICAgICAgICAgIChcImVsc2UgaWYodHlwZW9mIGQlcz09PVxcXCJvYmplY3RcXFwiKVwiLCBwcm9wKVxyXG4gICAgICAgICAgICAgICAgICAgIChcIm0lcz1uZXcgdXRpbC5Mb25nQml0cyhkJXMubG93Pj4+MCxkJXMuaGlnaD4+PjApLnRvTnVtYmVyKCVzKVwiLCBwcm9wLCBwcm9wLCBwcm9wLCBpc1Vuc2lnbmVkID8gXCJ0cnVlXCIgOiBcIlwiKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIFwiYnl0ZXNcIjogZ2VuXHJcbiAgICAgICAgICAgICAgICAoXCJpZih0eXBlb2YgZCVzPT09XFxcInN0cmluZ1xcXCIpXCIsIHByb3ApXHJcbiAgICAgICAgICAgICAgICAgICAgKFwidXRpbC5iYXNlNjQuZGVjb2RlKGQlcyxtJXM9dXRpbC5uZXdCdWZmZXIodXRpbC5iYXNlNjQubGVuZ3RoKGQlcykpLDApXCIsIHByb3AsIHByb3AsIHByb3ApXHJcbiAgICAgICAgICAgICAgICAoXCJlbHNlIGlmKGQlcy5sZW5ndGgpXCIsIHByb3ApXHJcbiAgICAgICAgICAgICAgICAgICAgKFwibSVzPWQlc1wiLCBwcm9wLCBwcm9wKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIFwic3RyaW5nXCI6IGdlblxyXG4gICAgICAgICAgICAgICAgKFwibSVzPVN0cmluZyhkJXMpXCIsIHByb3AsIHByb3ApO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgXCJib29sXCI6IGdlblxyXG4gICAgICAgICAgICAgICAgKFwibSVzPUJvb2xlYW4oZCVzKVwiLCBwcm9wLCBwcm9wKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAvKiBkZWZhdWx0OiBnZW5cclxuICAgICAgICAgICAgICAgIChcIm0lcz1kJXNcIiwgcHJvcCwgcHJvcCk7XHJcbiAgICAgICAgICAgICAgICBicmVhazsgKi9cclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZ2VuO1xyXG4gICAgLyogZXNsaW50LWVuYWJsZSBuby11bmV4cGVjdGVkLW11bHRpbGluZSwgYmxvY2stc2NvcGVkLXZhciwgbm8tcmVkZWNsYXJlICovXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBHZW5lcmF0ZXMgYSBwbGFpbiBvYmplY3QgdG8gcnVudGltZSBtZXNzYWdlIGNvbnZlcnRlciBzcGVjaWZpYyB0byB0aGUgc3BlY2lmaWVkIG1lc3NhZ2UgdHlwZS5cclxuICogQHBhcmFtIHtUeXBlfSBtdHlwZSBNZXNzYWdlIHR5cGVcclxuICogQHJldHVybnMge0NvZGVnZW59IENvZGVnZW4gaW5zdGFuY2VcclxuICovXHJcbmNvbnZlcnRlci5mcm9tT2JqZWN0ID0gZnVuY3Rpb24gZnJvbU9iamVjdChtdHlwZSkge1xyXG4gICAgLyogZXNsaW50LWRpc2FibGUgbm8tdW5leHBlY3RlZC1tdWx0aWxpbmUsIGJsb2NrLXNjb3BlZC12YXIsIG5vLXJlZGVjbGFyZSAqL1xyXG4gICAgdmFyIGZpZWxkcyA9IG10eXBlLmZpZWxkc0FycmF5O1xyXG4gICAgdmFyIGdlbiA9IHV0aWwuY29kZWdlbihcImRcIilcclxuICAgIChcImlmKGQgaW5zdGFuY2VvZiB0aGlzLmN0b3IpXCIpXHJcbiAgICAgICAgKFwicmV0dXJuIGRcIik7XHJcbiAgICBpZiAoIWZpZWxkcy5sZW5ndGgpIHJldHVybiBnZW5cclxuICAgIChcInJldHVybiBuZXcgdGhpcy5jdG9yXCIpO1xyXG4gICAgZ2VuXHJcbiAgICAoXCJ2YXIgbT1uZXcgdGhpcy5jdG9yXCIpO1xyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBmaWVsZHMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICB2YXIgZmllbGQgID0gZmllbGRzW2ldLnJlc29sdmUoKSxcclxuICAgICAgICAgICAgcHJvcCAgID0gdXRpbC5zYWZlUHJvcChmaWVsZC5uYW1lKTtcclxuXHJcbiAgICAgICAgLy8gTWFwIGZpZWxkc1xyXG4gICAgICAgIGlmIChmaWVsZC5tYXApIHsgZ2VuXHJcbiAgICAoXCJpZihkJXMpe1wiLCBwcm9wKVxyXG4gICAgICAgIChcImlmKHR5cGVvZiBkJXMhPT1cXFwib2JqZWN0XFxcIilcIiwgcHJvcClcclxuICAgICAgICAgICAgKFwidGhyb3cgVHlwZUVycm9yKCVqKVwiLCBmaWVsZC5mdWxsTmFtZSArIFwiOiBvYmplY3QgZXhwZWN0ZWRcIilcclxuICAgICAgICAoXCJtJXM9e31cIiwgcHJvcClcclxuICAgICAgICAoXCJmb3IodmFyIGtzPU9iamVjdC5rZXlzKGQlcyksaT0wO2k8a3MubGVuZ3RoOysraSl7XCIsIHByb3ApO1xyXG4gICAgICAgICAgICBnZW5WYWx1ZVBhcnRpYWxfZnJvbU9iamVjdChnZW4sIGZpZWxkLCBpLCBwcm9wICsgXCJba3NbaV1dXCIpXHJcbiAgICAgICAgKFwifVwiKVxyXG4gICAgKFwifVwiKTtcclxuXHJcbiAgICAgICAgLy8gUmVwZWF0ZWQgZmllbGRzXHJcbiAgICAgICAgfSBlbHNlIGlmIChmaWVsZC5yZXBlYXRlZCkgeyBnZW5cclxuICAgIChcImlmKGQlcyl7XCIsIHByb3ApXHJcbiAgICAgICAgKFwiaWYoIUFycmF5LmlzQXJyYXkoZCVzKSlcIiwgcHJvcClcclxuICAgICAgICAgICAgKFwidGhyb3cgVHlwZUVycm9yKCVqKVwiLCBmaWVsZC5mdWxsTmFtZSArIFwiOiBhcnJheSBleHBlY3RlZFwiKVxyXG4gICAgICAgIChcIm0lcz1bXVwiLCBwcm9wKVxyXG4gICAgICAgIChcImZvcih2YXIgaT0wO2k8ZCVzLmxlbmd0aDsrK2kpe1wiLCBwcm9wKTtcclxuICAgICAgICAgICAgZ2VuVmFsdWVQYXJ0aWFsX2Zyb21PYmplY3QoZ2VuLCBmaWVsZCwgaSwgcHJvcCArIFwiW2ldXCIpXHJcbiAgICAgICAgKFwifVwiKVxyXG4gICAgKFwifVwiKTtcclxuXHJcbiAgICAgICAgLy8gTm9uLXJlcGVhdGVkIGZpZWxkc1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGlmICghKGZpZWxkLnJlc29sdmVkVHlwZSBpbnN0YW5jZW9mIEVudW0pKSBnZW4gLy8gbm8gbmVlZCB0byB0ZXN0IGZvciBudWxsL3VuZGVmaW5lZCBpZiBhbiBlbnVtICh1c2VzIHN3aXRjaClcclxuICAgIChcImlmKGQlcyE9PXVuZGVmaW5lZCYmZCVzIT09bnVsbCl7XCIsIHByb3AsIHByb3ApO1xyXG4gICAgICAgIGdlblZhbHVlUGFydGlhbF9mcm9tT2JqZWN0KGdlbiwgZmllbGQsIGksIHByb3ApO1xyXG4gICAgICAgICAgICBpZiAoIShmaWVsZC5yZXNvbHZlZFR5cGUgaW5zdGFuY2VvZiBFbnVtKSkgZ2VuXHJcbiAgICAoXCJ9XCIpO1xyXG4gICAgICAgIH1cclxuICAgIH0gcmV0dXJuIGdlblxyXG4gICAgKFwicmV0dXJuIG1cIik7XHJcbiAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLXVuZXhwZWN0ZWQtbXVsdGlsaW5lLCBibG9jay1zY29wZWQtdmFyLCBuby1yZWRlY2xhcmUgKi9cclxufTtcclxuXHJcbi8qKlxyXG4gKiBHZW5lcmF0ZXMgYSBwYXJ0aWFsIHZhbHVlIHRvT2JqZWN0IGNvbnZlcnRlci5cclxuICogQHBhcmFtIHtDb2RlZ2VufSBnZW4gQ29kZWdlbiBpbnN0YW5jZVxyXG4gKiBAcGFyYW0ge0ZpZWxkfSBmaWVsZCBSZWZsZWN0ZWQgZmllbGRcclxuICogQHBhcmFtIHtudW1iZXJ9IGZpZWxkSW5kZXggRmllbGQgaW5kZXhcclxuICogQHBhcmFtIHtzdHJpbmd9IHByb3AgUHJvcGVydHkgcmVmZXJlbmNlXHJcbiAqIEByZXR1cm5zIHtDb2RlZ2VufSBDb2RlZ2VuIGluc3RhbmNlXHJcbiAqIEBpZ25vcmVcclxuICovXHJcbmZ1bmN0aW9uIGdlblZhbHVlUGFydGlhbF90b09iamVjdChnZW4sIGZpZWxkLCBmaWVsZEluZGV4LCBwcm9wKSB7XHJcbiAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby11bmV4cGVjdGVkLW11bHRpbGluZSwgYmxvY2stc2NvcGVkLXZhciwgbm8tcmVkZWNsYXJlICovXHJcbiAgICBpZiAoZmllbGQucmVzb2x2ZWRUeXBlKSB7XHJcbiAgICAgICAgaWYgKGZpZWxkLnJlc29sdmVkVHlwZSBpbnN0YW5jZW9mIEVudW0pIGdlblxyXG4gICAgICAgICAgICAoXCJkJXM9by5lbnVtcz09PVN0cmluZz90eXBlc1slZF0udmFsdWVzW20lc106bSVzXCIsIHByb3AsIGZpZWxkSW5kZXgsIHByb3AsIHByb3ApO1xyXG4gICAgICAgIGVsc2UgZ2VuXHJcbiAgICAgICAgICAgIChcImQlcz10eXBlc1slZF0udG9PYmplY3QobSVzLG8pXCIsIHByb3AsIGZpZWxkSW5kZXgsIHByb3ApO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICB2YXIgaXNVbnNpZ25lZCA9IGZhbHNlO1xyXG4gICAgICAgIHN3aXRjaCAoZmllbGQudHlwZSkge1xyXG4gICAgICAgICAgICBjYXNlIFwidWludDY0XCI6XHJcbiAgICAgICAgICAgICAgICBpc1Vuc2lnbmVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tZmFsbHRocm91Z2hcclxuICAgICAgICAgICAgY2FzZSBcImludDY0XCI6XHJcbiAgICAgICAgICAgIGNhc2UgXCJzaW50NjRcIjpcclxuICAgICAgICAgICAgY2FzZSBcImZpeGVkNjRcIjpcclxuICAgICAgICAgICAgY2FzZSBcInNmaXhlZDY0XCI6IGdlblxyXG4gICAgICAgICAgICAoXCJpZih0eXBlb2YgbSVzPT09XFxcIm51bWJlclxcXCIpXCIsIHByb3ApXHJcbiAgICAgICAgICAgICAgICAoXCJkJXM9by5sb25ncz09PVN0cmluZz9TdHJpbmcobSVzKTptJXNcIiwgcHJvcCwgcHJvcCwgcHJvcClcclxuICAgICAgICAgICAgKFwiZWxzZVwiKSAvLyBMb25nLWxpa2VcclxuICAgICAgICAgICAgICAgIChcImQlcz1vLmxvbmdzPT09U3RyaW5nP3V0aWwuTG9uZy5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChtJXMpOm8ubG9uZ3M9PT1OdW1iZXI/bmV3IHV0aWwuTG9uZ0JpdHMobSVzLmxvdz4+PjAsbSVzLmhpZ2g+Pj4wKS50b051bWJlciglcyk6bSVzXCIsIHByb3AsIHByb3AsIHByb3AsIHByb3AsIGlzVW5zaWduZWQgPyBcInRydWVcIjogXCJcIiwgcHJvcCk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBcImJ5dGVzXCI6IGdlblxyXG4gICAgICAgICAgICAoXCJkJXM9by5ieXRlcz09PVN0cmluZz91dGlsLmJhc2U2NC5lbmNvZGUobSVzLDAsbSVzLmxlbmd0aCk6by5ieXRlcz09PUFycmF5P0FycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKG0lcyk6bSVzXCIsIHByb3AsIHByb3AsIHByb3AsIHByb3AsIHByb3ApO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6IGdlblxyXG4gICAgICAgICAgICAoXCJkJXM9bSVzXCIsIHByb3AsIHByb3ApO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGdlbjtcclxuICAgIC8qIGVzbGludC1lbmFibGUgbm8tdW5leHBlY3RlZC1tdWx0aWxpbmUsIGJsb2NrLXNjb3BlZC12YXIsIG5vLXJlZGVjbGFyZSAqL1xyXG59XHJcblxyXG4vKipcclxuICogR2VuZXJhdGVzIGEgcnVudGltZSBtZXNzYWdlIHRvIHBsYWluIG9iamVjdCBjb252ZXJ0ZXIgc3BlY2lmaWMgdG8gdGhlIHNwZWNpZmllZCBtZXNzYWdlIHR5cGUuXHJcbiAqIEBwYXJhbSB7VHlwZX0gbXR5cGUgTWVzc2FnZSB0eXBlXHJcbiAqIEByZXR1cm5zIHtDb2RlZ2VufSBDb2RlZ2VuIGluc3RhbmNlXHJcbiAqL1xyXG5jb252ZXJ0ZXIudG9PYmplY3QgPSBmdW5jdGlvbiB0b09iamVjdChtdHlwZSkge1xyXG4gICAgLyogZXNsaW50LWRpc2FibGUgbm8tdW5leHBlY3RlZC1tdWx0aWxpbmUsIGJsb2NrLXNjb3BlZC12YXIsIG5vLXJlZGVjbGFyZSAqL1xyXG4gICAgdmFyIGZpZWxkcyA9IG10eXBlLmZpZWxkc0FycmF5O1xyXG4gICAgaWYgKCFmaWVsZHMubGVuZ3RoKVxyXG4gICAgICAgIHJldHVybiB1dGlsLmNvZGVnZW4oKShcInJldHVybiB7fVwiKTtcclxuICAgIHZhciBnZW4gPSB1dGlsLmNvZGVnZW4oXCJtXCIsIFwib1wiKVxyXG4gICAgKFwiaWYoIW8pXCIpXHJcbiAgICAgICAgKFwibz17fVwiKVxyXG4gICAgKFwidmFyIGQ9e31cIik7XHJcblxyXG4gICAgdmFyIHJlcGVhdGVkRmllbGRzID0gW10sXHJcbiAgICAgICAgbWFwRmllbGRzID0gW10sXHJcbiAgICAgICAgb3RoZXJGaWVsZHMgPSBbXSxcclxuICAgICAgICBpID0gMDtcclxuICAgIGZvciAoOyBpIDwgZmllbGRzLmxlbmd0aDsgKytpKVxyXG4gICAgICAgIGlmIChmaWVsZHNbaV0ucmVzb2x2ZSgpLnJlcGVhdGVkKVxyXG4gICAgICAgICAgICByZXBlYXRlZEZpZWxkcy5wdXNoKGZpZWxkc1tpXSk7XHJcbiAgICAgICAgZWxzZSBpZiAoZmllbGRzW2ldLm1hcClcclxuICAgICAgICAgICAgbWFwRmllbGRzLnB1c2goZmllbGRzW2ldKTtcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgIG90aGVyRmllbGRzLnB1c2goZmllbGRzW2ldKTtcclxuXHJcbiAgICBpZiAocmVwZWF0ZWRGaWVsZHMubGVuZ3RoKSB7IGdlblxyXG4gICAgKFwiaWYoby5hcnJheXN8fG8uZGVmYXVsdHMpe1wiKTtcclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgcmVwZWF0ZWRGaWVsZHMubGVuZ3RoOyArK2kpIGdlblxyXG4gICAgICAgIChcImQlcz1bXVwiLCB1dGlsLnNhZmVQcm9wKHJlcGVhdGVkRmllbGRzW2ldLm5hbWUpKTtcclxuICAgICAgICBnZW5cclxuICAgIChcIn1cIik7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKG1hcEZpZWxkcy5sZW5ndGgpIHsgZ2VuXHJcbiAgICAoXCJpZihvLm9iamVjdHN8fG8uZGVmYXVsdHMpe1wiKTtcclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbWFwRmllbGRzLmxlbmd0aDsgKytpKSBnZW5cclxuICAgICAgICAoXCJkJXM9e31cIiwgdXRpbC5zYWZlUHJvcChtYXBGaWVsZHNbaV0ubmFtZSkpO1xyXG4gICAgICAgIGdlblxyXG4gICAgKFwifVwiKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAob3RoZXJGaWVsZHMubGVuZ3RoKSB7IGdlblxyXG4gICAgKFwiaWYoby5kZWZhdWx0cyl7XCIpO1xyXG4gICAgICAgIGZvciAoaSA9IDAsIGZpZWxkOyBpIDwgb3RoZXJGaWVsZHMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgdmFyIGZpZWxkID0gb3RoZXJGaWVsZHNbaV0sXHJcbiAgICAgICAgICAgICAgICBwcm9wICA9IHV0aWwuc2FmZVByb3AoZmllbGQubmFtZSk7XHJcbiAgICAgICAgICAgIGlmIChmaWVsZC5yZXNvbHZlZFR5cGUgaW5zdGFuY2VvZiBFbnVtKSBnZW5cclxuICAgICAgICAoXCJkJXM9by5lbnVtcz09PVN0cmluZz8lajolalwiLCBwcm9wLCBmaWVsZC5yZXNvbHZlZFR5cGUudmFsdWVzQnlJZFtmaWVsZC50eXBlRGVmYXVsdF0sIGZpZWxkLnR5cGVEZWZhdWx0KTtcclxuICAgICAgICAgICAgZWxzZSBpZiAoZmllbGQubG9uZykgZ2VuXHJcbiAgICAgICAgKFwiaWYodXRpbC5Mb25nKXtcIilcclxuICAgICAgICAgICAgKFwidmFyIG49bmV3IHV0aWwuTG9uZyglZCwlZCwlailcIiwgZmllbGQudHlwZURlZmF1bHQubG93LCBmaWVsZC50eXBlRGVmYXVsdC5oaWdoLCBmaWVsZC50eXBlRGVmYXVsdC51bnNpZ25lZClcclxuICAgICAgICAgICAgKFwiZCVzPW8ubG9uZ3M9PT1TdHJpbmc/bi50b1N0cmluZygpOm8ubG9uZ3M9PT1OdW1iZXI/bi50b051bWJlcigpOm5cIiwgcHJvcClcclxuICAgICAgICAoXCJ9ZWxzZVwiKVxyXG4gICAgICAgICAgICAoXCJkJXM9by5sb25ncz09PVN0cmluZz8lajolZFwiLCBwcm9wLCBmaWVsZC50eXBlRGVmYXVsdC50b1N0cmluZygpLCBmaWVsZC50eXBlRGVmYXVsdC50b051bWJlcigpKTtcclxuICAgICAgICAgICAgZWxzZSBpZiAoZmllbGQuYnl0ZXMpIGdlblxyXG4gICAgICAgIChcImQlcz1vLmJ5dGVzPT09U3RyaW5nPyVqOiVzXCIsIHByb3AsIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkoU3RyaW5nLCBmaWVsZC50eXBlRGVmYXVsdCksIFwiW1wiICsgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZmllbGQudHlwZURlZmF1bHQpLmpvaW4oXCIsXCIpICsgXCJdXCIpO1xyXG4gICAgICAgICAgICBlbHNlIGdlblxyXG4gICAgICAgIChcImQlcz0lalwiLCBwcm9wLCBmaWVsZC50eXBlRGVmYXVsdCk7IC8vIGFsc28gbWVzc2FnZXMgKD1udWxsKVxyXG4gICAgICAgIH0gZ2VuXHJcbiAgICAoXCJ9XCIpO1xyXG4gICAgfVxyXG4gICAgZm9yIChpID0gMCwgZmllbGQ7IGkgPCBmaWVsZHMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICB2YXIgZmllbGQgPSBmaWVsZHNbaV0sXHJcbiAgICAgICAgICAgIHByb3AgID0gdXRpbC5zYWZlUHJvcChmaWVsZC5uYW1lKTsgZ2VuXHJcbiAgICAoXCJpZihtJXMhPT11bmRlZmluZWQmJm0lcyE9PW51bGwmJm0uaGFzT3duUHJvcGVydHkoJWopKXtcIiwgcHJvcCwgcHJvcCwgZmllbGQubmFtZSk7XHJcbiAgICAgICAgaWYgKGZpZWxkLm1hcCkgeyBnZW5cclxuICAgICAgICAoXCJkJXM9e31cIiwgcHJvcClcclxuICAgICAgICAoXCJmb3IodmFyIGtzMj1PYmplY3Qua2V5cyhtJXMpLGo9MDtqPGtzMi5sZW5ndGg7KytqKXtcIiwgcHJvcCk7XHJcbiAgICAgICAgICAgIGdlblZhbHVlUGFydGlhbF90b09iamVjdChnZW4sIGZpZWxkLCBpLCBwcm9wICsgXCJba3MyW2pdXVwiKVxyXG4gICAgICAgIChcIn1cIik7XHJcbiAgICAgICAgfSBlbHNlIGlmIChmaWVsZC5yZXBlYXRlZCkgeyBnZW5cclxuICAgICAgICAoXCJkJXM9W11cIiwgcHJvcClcclxuICAgICAgICAoXCJmb3IodmFyIGo9MDtqPG0lcy5sZW5ndGg7KytqKXtcIiwgcHJvcCk7XHJcbiAgICAgICAgICAgIGdlblZhbHVlUGFydGlhbF90b09iamVjdChnZW4sIGZpZWxkLCBpLCBwcm9wICsgXCJbal1cIilcclxuICAgICAgICAoXCJ9XCIpO1xyXG4gICAgICAgIH0gZWxzZVxyXG4gICAgICAgIGdlblZhbHVlUGFydGlhbF90b09iamVjdChnZW4sIGZpZWxkLCBpLCBwcm9wKTtcclxuICAgICAgICBnZW5cclxuICAgIChcIn1cIik7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZ2VuXHJcbiAgICAoXCJyZXR1cm4gZFwiKTtcclxuICAgIC8qIGVzbGludC1lbmFibGUgbm8tdW5leHBlY3RlZC1tdWx0aWxpbmUsIGJsb2NrLXNjb3BlZC12YXIsIG5vLXJlZGVjbGFyZSAqL1xyXG59O1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxubW9kdWxlLmV4cG9ydHMgPSBkZWNvZGVyO1xyXG5cclxuZGVjb2Rlci5jb21wYXQgPSB0cnVlO1xyXG5cclxudmFyIEVudW0gICAgPSByZXF1aXJlKFwiLi9lbnVtXCIpLFxyXG4gICAgdHlwZXMgICA9IHJlcXVpcmUoXCIuL3R5cGVzXCIpLFxyXG4gICAgdXRpbCAgICA9IHJlcXVpcmUoXCIuL3V0aWxcIik7XHJcblxyXG4vKipcclxuICogR2VuZXJhdGVzIGEgZGVjb2RlciBzcGVjaWZpYyB0byB0aGUgc3BlY2lmaWVkIG1lc3NhZ2UgdHlwZS5cclxuICogQHBhcmFtIHtUeXBlfSBtdHlwZSBNZXNzYWdlIHR5cGVcclxuICogQHJldHVybnMge0NvZGVnZW59IENvZGVnZW4gaW5zdGFuY2VcclxuICogQHByb3BlcnR5IHtib29sZWFufSBjb21wYXQ9dHJ1ZSBHZW5lcmF0ZXMgYmFja3dhcmQvZm9yd2FyZCBjb21wYXRpYmxlIGRlY29kZXJzIChwYWNrZWQgZmllbGRzKVxyXG4gKi9cclxuZnVuY3Rpb24gZGVjb2RlcihtdHlwZSkge1xyXG4gICAgLyogZXNsaW50LWRpc2FibGUgbm8tdW5leHBlY3RlZC1tdWx0aWxpbmUgKi9cclxuICAgIHZhciBnZW4gPSB1dGlsLmNvZGVnZW4oXCJyXCIsIFwibFwiKVxyXG4gICAgKFwiaWYoIShyIGluc3RhbmNlb2YgUmVhZGVyKSlcIilcclxuICAgICAgICAoXCJyPVJlYWRlci5jcmVhdGUocilcIilcclxuICAgIChcInZhciBjPWw9PT11bmRlZmluZWQ/ci5sZW46ci5wb3MrbCxtPW5ldyB0aGlzLmN0b3JcIilcclxuICAgIChcIndoaWxlKHIucG9zPGMpe1wiKVxyXG4gICAgICAgIChcInZhciB0PXIudWludDMyKClcIik7XHJcbiAgICBpZiAobXR5cGUuZ3JvdXApIGdlblxyXG4gICAgICAgIChcImlmKCh0JjcpPT09NClcIilcclxuICAgICAgICAgICAgKFwiYnJlYWtcIik7XHJcbiAgICBnZW5cclxuICAgICAgICAoXCJzd2l0Y2godD4+PjMpe1wiKTtcclxuXHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IC8qIGluaXRpYWxpemVzICovIG10eXBlLmZpZWxkc0FycmF5Lmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgdmFyIGZpZWxkID0gbXR5cGUuX2ZpZWxkc0FycmF5W2ldLnJlc29sdmUoKSxcclxuICAgICAgICAgICAgdHlwZSAgPSBmaWVsZC5yZXNvbHZlZFR5cGUgaW5zdGFuY2VvZiBFbnVtID8gXCJ1aW50MzJcIiA6IGZpZWxkLnR5cGUsXHJcbiAgICAgICAgICAgIHJlZiAgID0gXCJtXCIgKyB1dGlsLnNhZmVQcm9wKGZpZWxkLm5hbWUpOyBnZW5cclxuICAgICAgICAgICAgKFwiY2FzZSAlZDpcIiwgZmllbGQuaWQpO1xyXG5cclxuICAgICAgICAvLyBNYXAgZmllbGRzXHJcbiAgICAgICAgaWYgKGZpZWxkLm1hcCkgeyBnZW5cclxuXHJcbiAgICAgICAgICAgICAgICAoXCJyLnNraXAoKS5wb3MrK1wiKSAvLyBhc3N1bWVzIGlkIDEgKyBrZXkgd2lyZVR5cGVcclxuICAgICAgICAgICAgICAgIChcImlmKCVzPT09dXRpbC5lbXB0eU9iamVjdClcIiwgcmVmKVxyXG4gICAgICAgICAgICAgICAgICAgIChcIiVzPXt9XCIsIHJlZilcclxuICAgICAgICAgICAgICAgIChcInZhciBrPXIuJXMoKVwiLCBmaWVsZC5rZXlUeXBlKVxyXG4gICAgICAgICAgICAgICAgKFwici5wb3MrK1wiKTsgLy8gYXNzdW1lcyBpZCAyICsgdmFsdWUgd2lyZVR5cGVcclxuICAgICAgICAgICAgaWYgKHR5cGVzLmJhc2ljW3R5cGVdID09PSB1bmRlZmluZWQpIGdlblxyXG4gICAgICAgICAgICAgICAgKFwiJXNbdHlwZW9mIGs9PT1cXFwib2JqZWN0XFxcIj91dGlsLmxvbmdUb0hhc2goayk6a109dHlwZXNbJWRdLmRlY29kZShyLHIudWludDMyKCkpXCIsIHJlZiwgaSk7IC8vIGNhbid0IGJlIGdyb3Vwc1xyXG4gICAgICAgICAgICBlbHNlIGdlblxyXG4gICAgICAgICAgICAgICAgKFwiJXNbdHlwZW9mIGs9PT1cXFwib2JqZWN0XFxcIj91dGlsLmxvbmdUb0hhc2goayk6a109ci4lcygpXCIsIHJlZiwgdHlwZSk7XHJcblxyXG4gICAgICAgIC8vIFJlcGVhdGVkIGZpZWxkc1xyXG4gICAgICAgIH0gZWxzZSBpZiAoZmllbGQucmVwZWF0ZWQpIHsgZ2VuXHJcblxyXG4gICAgICAgICAgICAgICAgKFwiaWYoISglcyYmJXMubGVuZ3RoKSlcIiwgcmVmLCByZWYpXHJcbiAgICAgICAgICAgICAgICAgICAgKFwiJXM9W11cIiwgcmVmKTtcclxuXHJcbiAgICAgICAgICAgIC8vIFBhY2thYmxlIChhbHdheXMgY2hlY2sgZm9yIGZvcndhcmQgYW5kIGJhY2t3YXJkIGNvbXBhdGlibGl0eSlcclxuICAgICAgICAgICAgaWYgKChkZWNvZGVyLmNvbXBhdCB8fCBmaWVsZC5wYWNrZWQpICYmIHR5cGVzLnBhY2tlZFt0eXBlXSAhPT0gdW5kZWZpbmVkKSBnZW5cclxuICAgICAgICAgICAgICAgIChcImlmKCh0JjcpPT09Mil7XCIpXHJcbiAgICAgICAgICAgICAgICAgICAgKFwidmFyIGMyPXIudWludDMyKCkrci5wb3NcIilcclxuICAgICAgICAgICAgICAgICAgICAoXCJ3aGlsZShyLnBvczxjMilcIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgKFwiJXMucHVzaChyLiVzKCkpXCIsIHJlZiwgdHlwZSlcclxuICAgICAgICAgICAgICAgIChcIn1lbHNlXCIpO1xyXG5cclxuICAgICAgICAgICAgLy8gTm9uLXBhY2tlZFxyXG4gICAgICAgICAgICBpZiAodHlwZXMuYmFzaWNbdHlwZV0gPT09IHVuZGVmaW5lZCkgZ2VuKGZpZWxkLnJlc29sdmVkVHlwZS5ncm91cFxyXG4gICAgICAgICAgICAgICAgICAgID8gXCIlcy5wdXNoKHR5cGVzWyVkXS5kZWNvZGUocikpXCJcclxuICAgICAgICAgICAgICAgICAgICA6IFwiJXMucHVzaCh0eXBlc1slZF0uZGVjb2RlKHIsci51aW50MzIoKSkpXCIsIHJlZiwgaSk7XHJcbiAgICAgICAgICAgIGVsc2UgZ2VuXHJcbiAgICAgICAgICAgICAgICAgICAgKFwiJXMucHVzaChyLiVzKCkpXCIsIHJlZiwgdHlwZSk7XHJcblxyXG4gICAgICAgIC8vIE5vbi1yZXBlYXRlZFxyXG4gICAgICAgIH0gZWxzZSBpZiAodHlwZXMuYmFzaWNbdHlwZV0gPT09IHVuZGVmaW5lZCkgZ2VuKGZpZWxkLnJlc29sdmVkVHlwZS5ncm91cFxyXG4gICAgICAgICAgICAgICAgPyBcIiVzPXR5cGVzWyVkXS5kZWNvZGUocilcIlxyXG4gICAgICAgICAgICAgICAgOiBcIiVzPXR5cGVzWyVkXS5kZWNvZGUocixyLnVpbnQzMigpKVwiLCByZWYsIGkpO1xyXG4gICAgICAgIGVsc2UgZ2VuXHJcbiAgICAgICAgICAgICAgICAoXCIlcz1yLiVzKClcIiwgcmVmLCB0eXBlKTtcclxuICAgICAgICBnZW5cclxuICAgICAgICAgICAgICAgIChcImJyZWFrXCIpO1xyXG5cclxuICAgIC8vIFVua25vd24gZmllbGRzXHJcbiAgICB9IHJldHVybiBnZW5cclxuICAgICAgICAgICAgKFwiZGVmYXVsdDpcIilcclxuICAgICAgICAgICAgICAgIChcInIuc2tpcFR5cGUodCY3KVwiKVxyXG4gICAgICAgICAgICAgICAgKFwiYnJlYWtcIilcclxuXHJcbiAgICAgICAgKFwifVwiKVxyXG4gICAgKFwifVwiKVxyXG4gICAgKFwicmV0dXJuIG1cIik7XHJcbiAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLXVuZXhwZWN0ZWQtbXVsdGlsaW5lICovXHJcbn1cclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbm1vZHVsZS5leHBvcnRzID0gZW5jb2RlcjtcclxuXHJcbnZhciBFbnVtICAgICA9IHJlcXVpcmUoXCIuL2VudW1cIiksXHJcbiAgICB0eXBlcyAgICA9IHJlcXVpcmUoXCIuL3R5cGVzXCIpLFxyXG4gICAgdXRpbCAgICAgPSByZXF1aXJlKFwiLi91dGlsXCIpO1xyXG5cclxuLyoqXHJcbiAqIEdlbmVyYXRlcyBhIHBhcnRpYWwgbWVzc2FnZSB0eXBlIGVuY29kZXIuXHJcbiAqIEBwYXJhbSB7Q29kZWdlbn0gZ2VuIENvZGVnZW4gaW5zdGFuY2VcclxuICogQHBhcmFtIHtGaWVsZH0gZmllbGQgUmVmbGVjdGVkIGZpZWxkXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBmaWVsZEluZGV4IEZpZWxkIGluZGV4XHJcbiAqIEBwYXJhbSB7c3RyaW5nfSByZWYgVmFyaWFibGUgcmVmZXJlbmNlXHJcbiAqIEByZXR1cm5zIHtDb2RlZ2VufSBDb2RlZ2VuIGluc3RhbmNlXHJcbiAqIEBpZ25vcmVcclxuICovXHJcbmZ1bmN0aW9uIGdlblR5cGVQYXJ0aWFsKGdlbiwgZmllbGQsIGZpZWxkSW5kZXgsIHJlZikge1xyXG4gICAgcmV0dXJuIGZpZWxkLnJlc29sdmVkVHlwZS5ncm91cFxyXG4gICAgICAgID8gZ2VuKFwidHlwZXNbJWRdLmVuY29kZSglcyx3LnVpbnQzMiglZCkpLnVpbnQzMiglZClcIiwgZmllbGRJbmRleCwgcmVmLCAoZmllbGQuaWQgPDwgMyB8IDMpID4+PiAwLCAoZmllbGQuaWQgPDwgMyB8IDQpID4+PiAwKVxyXG4gICAgICAgIDogZ2VuKFwidHlwZXNbJWRdLmVuY29kZSglcyx3LnVpbnQzMiglZCkuZm9yaygpKS5sZGVsaW0oKVwiLCBmaWVsZEluZGV4LCByZWYsIChmaWVsZC5pZCA8PCAzIHwgMikgPj4+IDApO1xyXG59XHJcblxyXG4vKipcclxuICogR2VuZXJhdGVzIGFuIGVuY29kZXIgc3BlY2lmaWMgdG8gdGhlIHNwZWNpZmllZCBtZXNzYWdlIHR5cGUuXHJcbiAqIEBwYXJhbSB7VHlwZX0gbXR5cGUgTWVzc2FnZSB0eXBlXHJcbiAqIEByZXR1cm5zIHtDb2RlZ2VufSBDb2RlZ2VuIGluc3RhbmNlXHJcbiAqL1xyXG5mdW5jdGlvbiBlbmNvZGVyKG10eXBlKSB7XHJcbiAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby11bmV4cGVjdGVkLW11bHRpbGluZSwgYmxvY2stc2NvcGVkLXZhciwgbm8tcmVkZWNsYXJlICovXHJcbiAgICB2YXIgZ2VuID0gdXRpbC5jb2RlZ2VuKFwibVwiLCBcIndcIilcclxuICAgIChcImlmKCF3KVwiKVxyXG4gICAgICAgIChcInc9V3JpdGVyLmNyZWF0ZSgpXCIpO1xyXG5cclxuICAgIHZhciBpLCByZWY7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IC8qIGluaXRpYWxpemVzICovIG10eXBlLmZpZWxkc0FycmF5Lmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgdmFyIGZpZWxkICAgID0gbXR5cGUuX2ZpZWxkc0FycmF5W2ldLnJlc29sdmUoKTtcclxuICAgICAgICBpZiAoZmllbGQucGFydE9mKSAvLyBzZWUgYmVsb3cgZm9yIG9uZW9mc1xyXG4gICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICB2YXIgdHlwZSAgICAgPSBmaWVsZC5yZXNvbHZlZFR5cGUgaW5zdGFuY2VvZiBFbnVtID8gXCJ1aW50MzJcIiA6IGZpZWxkLnR5cGUsXHJcbiAgICAgICAgICAgIHdpcmVUeXBlID0gdHlwZXMuYmFzaWNbdHlwZV07XHJcbiAgICAgICAgICAgIHJlZiAgICAgID0gXCJtXCIgKyB1dGlsLnNhZmVQcm9wKGZpZWxkLm5hbWUpO1xyXG5cclxuICAgICAgICAvLyBNYXAgZmllbGRzXHJcbiAgICAgICAgaWYgKGZpZWxkLm1hcCkge1xyXG4gICAgICAgICAgICBnZW5cclxuICAgIChcImlmKCVzJiZtLmhhc093blByb3BlcnR5KCVqKSl7XCIsIHJlZiwgZmllbGQubmFtZSlcclxuICAgICAgICAoXCJmb3IodmFyIGtzPU9iamVjdC5rZXlzKCVzKSxpPTA7aTxrcy5sZW5ndGg7KytpKXtcIiwgcmVmKVxyXG4gICAgICAgICAgICAoXCJ3LnVpbnQzMiglZCkuZm9yaygpLnVpbnQzMiglZCkuJXMoa3NbaV0pXCIsIChmaWVsZC5pZCA8PCAzIHwgMikgPj4+IDAsIDggfCB0eXBlcy5tYXBLZXlbZmllbGQua2V5VHlwZV0sIGZpZWxkLmtleVR5cGUpO1xyXG4gICAgICAgICAgICBpZiAod2lyZVR5cGUgPT09IHVuZGVmaW5lZCkgZ2VuXHJcbiAgICAgICAgICAgIChcInR5cGVzWyVkXS5lbmNvZGUoJXNba3NbaV1dLHcudWludDMyKDE4KS5mb3JrKCkpLmxkZWxpbSgpLmxkZWxpbSgpXCIsIGksIHJlZik7IC8vIGNhbid0IGJlIGdyb3Vwc1xyXG4gICAgICAgICAgICBlbHNlIGdlblxyXG4gICAgICAgICAgICAoXCIudWludDMyKCVkKS4lcyglc1trc1tpXV0pLmxkZWxpbSgpXCIsIDE2IHwgd2lyZVR5cGUsIHR5cGUsIHJlZik7XHJcbiAgICAgICAgICAgIGdlblxyXG4gICAgICAgIChcIn1cIilcclxuICAgIChcIn1cIik7XHJcblxyXG4gICAgICAgIC8vIFJlcGVhdGVkIGZpZWxkc1xyXG4gICAgICAgIH0gZWxzZSBpZiAoZmllbGQucmVwZWF0ZWQpIHtcclxuXHJcbiAgICAgICAgICAgIC8vIFBhY2tlZCByZXBlYXRlZFxyXG4gICAgICAgICAgICBpZiAoZmllbGQucGFja2VkICYmIHR5cGVzLnBhY2tlZFt0eXBlXSAhPT0gdW5kZWZpbmVkKSB7IGdlblxyXG5cclxuICAgIChcImlmKCVzJiYlcy5sZW5ndGgmJm0uaGFzT3duUHJvcGVydHkoJWopKXtcIiwgcmVmLCByZWYsIGZpZWxkLm5hbWUpXHJcbiAgICAgICAgKFwidy51aW50MzIoJWQpLmZvcmsoKVwiLCAoZmllbGQuaWQgPDwgMyB8IDIpID4+PiAwKVxyXG4gICAgICAgIChcImZvcih2YXIgaT0wO2k8JXMubGVuZ3RoOysraSlcIiwgcmVmKVxyXG4gICAgICAgICAgICAoXCJ3LiVzKCVzW2ldKVwiLCB0eXBlLCByZWYpXHJcbiAgICAgICAgKFwidy5sZGVsaW0oKVwiKVxyXG4gICAgKFwifVwiKTtcclxuXHJcbiAgICAgICAgICAgIC8vIE5vbi1wYWNrZWRcclxuICAgICAgICAgICAgfSBlbHNlIHsgZ2VuXHJcblxyXG4gICAgKFwiaWYoJXMhPT11bmRlZmluZWQmJm0uaGFzT3duUHJvcGVydHkoJWopKXtcIiwgcmVmLCBmaWVsZC5uYW1lKVxyXG4gICAgICAgIChcImZvcih2YXIgaT0wO2k8JXMubGVuZ3RoOysraSlcIiwgcmVmKTtcclxuICAgICAgICAgICAgICAgIGlmICh3aXJlVHlwZSA9PT0gdW5kZWZpbmVkKVxyXG4gICAgICAgICAgICBnZW5UeXBlUGFydGlhbChnZW4sIGZpZWxkLCBpLCByZWYgKyBcIltpXVwiKTtcclxuICAgICAgICAgICAgICAgIGVsc2UgZ2VuXHJcbiAgICAgICAgICAgIChcIncudWludDMyKCVkKS4lcyglc1tpXSlcIiwgKGZpZWxkLmlkIDw8IDMgfCB3aXJlVHlwZSkgPj4+IDAsIHR5cGUsIHJlZik7XHJcbiAgICAgICAgICAgICAgICBnZW5cclxuICAgIChcIn1cIik7XHJcblxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIE5vbi1yZXBlYXRlZFxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGlmICghZmllbGQucmVxdWlyZWQpIHtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoZmllbGQubG9uZykgZ2VuXHJcbiAgICAoXCJpZiglcyE9PXVuZGVmaW5lZCYmJXMhPT1udWxsJiZtLmhhc093blByb3BlcnR5KCVqKSlcIiwgcmVmLCByZWYsIGZpZWxkLm5hbWUpO1xyXG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoZmllbGQuYnl0ZXMgfHwgZmllbGQucmVzb2x2ZWRUeXBlICYmICEoZmllbGQucmVzb2x2ZWRUeXBlIGluc3RhbmNlb2YgRW51bSkpIGdlblxyXG4gICAgKFwiaWYoJXMmJm0uaGFzT3duUHJvcGVydHkoJWopKVwiLCByZWYsIGZpZWxkLm5hbWUpO1xyXG4gICAgICAgICAgICAgICAgZWxzZSBnZW5cclxuICAgIChcImlmKCVzIT09dW5kZWZpbmVkJiZtLmhhc093blByb3BlcnR5KCVqKSlcIiwgcmVmLCBmaWVsZC5uYW1lKTtcclxuXHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICh3aXJlVHlwZSA9PT0gdW5kZWZpbmVkKVxyXG4gICAgICAgIGdlblR5cGVQYXJ0aWFsKGdlbiwgZmllbGQsIGksIHJlZik7XHJcbiAgICAgICAgICAgIGVsc2UgZ2VuXHJcbiAgICAgICAgKFwidy51aW50MzIoJWQpLiVzKCVzKVwiLCAoZmllbGQuaWQgPDwgMyB8IHdpcmVUeXBlKSA+Pj4gMCwgdHlwZSwgcmVmKTtcclxuXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIG9uZW9mc1xyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCAvKiBpbml0aWFsaXplcyAqLyBtdHlwZS5vbmVvZnNBcnJheS5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgIHZhciBvbmVvZiA9IG10eXBlLl9vbmVvZnNBcnJheVtpXTsgZ2VuXHJcbiAgICAgICAgKFwic3dpdGNoKCVzKXtcIiwgXCJtXCIgKyB1dGlsLnNhZmVQcm9wKG9uZW9mLm5hbWUpKTtcclxuICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IC8qIGRpcmVjdCAqLyBvbmVvZi5maWVsZHNBcnJheS5sZW5ndGg7ICsraikge1xyXG4gICAgICAgICAgICB2YXIgZmllbGQgICAgPSBvbmVvZi5maWVsZHNBcnJheVtqXSxcclxuICAgICAgICAgICAgICAgIHR5cGUgICAgID0gZmllbGQucmVzb2x2ZWRUeXBlIGluc3RhbmNlb2YgRW51bSA/IFwidWludDMyXCIgOiBmaWVsZC50eXBlLFxyXG4gICAgICAgICAgICAgICAgd2lyZVR5cGUgPSB0eXBlcy5iYXNpY1t0eXBlXTtcclxuICAgICAgICAgICAgICAgIHJlZiAgICAgID0gXCJtXCIgKyB1dGlsLnNhZmVQcm9wKGZpZWxkLm5hbWUpOyBnZW5cclxuICAgICAgICAgICAgKFwiY2FzZSVqOlwiLCBmaWVsZC5uYW1lKTtcclxuICAgICAgICAgICAgaWYgKHdpcmVUeXBlID09PSB1bmRlZmluZWQpXHJcbiAgICAgICAgICAgICAgICBnZW5UeXBlUGFydGlhbChnZW4sIGZpZWxkLCBtdHlwZS5fZmllbGRzQXJyYXkuaW5kZXhPZihmaWVsZCksIHJlZik7XHJcbiAgICAgICAgICAgIGVsc2UgZ2VuXHJcbiAgICAgICAgICAgICAgICAoXCJ3LnVpbnQzMiglZCkuJXMoJXMpXCIsIChmaWVsZC5pZCA8PCAzIHwgd2lyZVR5cGUpID4+PiAwLCB0eXBlLCByZWYpO1xyXG4gICAgICAgICAgICBnZW5cclxuICAgICAgICAgICAgICAgIChcImJyZWFrXCIpO1xyXG4gICAgICAgIH0gZ2VuXHJcbiAgICAgICAgKFwifVwiKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIGdlblxyXG4gICAgKFwicmV0dXJuIHdcIik7XHJcbiAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLXVuZXhwZWN0ZWQtbXVsdGlsaW5lLCBibG9jay1zY29wZWQtdmFyLCBuby1yZWRlY2xhcmUgKi9cclxufSIsIlwidXNlIHN0cmljdFwiO1xyXG5tb2R1bGUuZXhwb3J0cyA9IEVudW07XHJcblxyXG4vLyBleHRlbmRzIFJlZmxlY3Rpb25PYmplY3RcclxudmFyIFJlZmxlY3Rpb25PYmplY3QgPSByZXF1aXJlKFwiLi9vYmplY3RcIik7XHJcbigoRW51bS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlZmxlY3Rpb25PYmplY3QucHJvdG90eXBlKSkuY29uc3RydWN0b3IgPSBFbnVtKS5jbGFzc05hbWUgPSBcIkVudW1cIjtcclxuXHJcbnZhciB1dGlsID0gcmVxdWlyZShcIi4vdXRpbFwiKTtcclxuXHJcbi8qKlxyXG4gKiBDb25zdHJ1Y3RzIGEgbmV3IGVudW0gaW5zdGFuY2UuXHJcbiAqIEBjbGFzc2Rlc2MgUmVmbGVjdGVkIGVudW0uXHJcbiAqIEBleHRlbmRzIFJlZmxlY3Rpb25PYmplY3RcclxuICogQGNvbnN0cnVjdG9yXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIFVuaXF1ZSBuYW1lIHdpdGhpbiBpdHMgbmFtZXNwYWNlXHJcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsbnVtYmVyPn0gW3ZhbHVlc10gRW51bSB2YWx1ZXMgYXMgYW4gb2JqZWN0LCBieSBuYW1lXHJcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsKj59IFtvcHRpb25zXSBEZWNsYXJlZCBvcHRpb25zXHJcbiAqL1xyXG5mdW5jdGlvbiBFbnVtKG5hbWUsIHZhbHVlcywgb3B0aW9ucykge1xyXG4gICAgUmVmbGVjdGlvbk9iamVjdC5jYWxsKHRoaXMsIG5hbWUsIG9wdGlvbnMpO1xyXG5cclxuICAgIGlmICh2YWx1ZXMgJiYgdHlwZW9mIHZhbHVlcyAhPT0gXCJvYmplY3RcIilcclxuICAgICAgICB0aHJvdyBUeXBlRXJyb3IoXCJ2YWx1ZXMgbXVzdCBiZSBhbiBvYmplY3RcIik7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBFbnVtIHZhbHVlcyBieSBpZC5cclxuICAgICAqIEB0eXBlIHtPYmplY3QuPG51bWJlcixzdHJpbmc+fVxyXG4gICAgICovXHJcbiAgICB0aGlzLnZhbHVlc0J5SWQgPSB7fTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEVudW0gdmFsdWVzIGJ5IG5hbWUuXHJcbiAgICAgKiBAdHlwZSB7T2JqZWN0LjxzdHJpbmcsbnVtYmVyPn1cclxuICAgICAqL1xyXG4gICAgdGhpcy52YWx1ZXMgPSBPYmplY3QuY3JlYXRlKHRoaXMudmFsdWVzQnlJZCk7IC8vIHRvSlNPTiwgbWFya2VyXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBWYWx1ZSBjb21tZW50IHRleHRzLCBpZiBhbnkuXHJcbiAgICAgKiBAdHlwZSB7T2JqZWN0LjxzdHJpbmcsc3RyaW5nPn1cclxuICAgICAqL1xyXG4gICAgdGhpcy5jb21tZW50cyA9IHt9O1xyXG5cclxuICAgIC8vIE5vdGUgdGhhdCB2YWx1ZXMgaW5oZXJpdCB2YWx1ZXNCeUlkIG9uIHRoZWlyIHByb3RvdHlwZSB3aGljaCBtYWtlcyB0aGVtIGEgVHlwZVNjcmlwdC1cclxuICAgIC8vIGNvbXBhdGlibGUgZW51bS4gVGhpcyBpcyB1c2VkIGJ5IHBidHMgdG8gd3JpdGUgYWN0dWFsIGVudW0gZGVmaW5pdGlvbnMgdGhhdCB3b3JrIGZvclxyXG4gICAgLy8gc3RhdGljIGFuZCByZWZsZWN0aW9uIGNvZGUgYWxpa2UgaW5zdGVhZCBvZiBlbWl0dGluZyBnZW5lcmljIG9iamVjdCBkZWZpbml0aW9ucy5cclxuXHJcbiAgICBpZiAodmFsdWVzKVxyXG4gICAgICAgIGZvciAodmFyIGtleXMgPSBPYmplY3Qua2V5cyh2YWx1ZXMpLCBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyArK2kpXHJcbiAgICAgICAgICAgIHRoaXMudmFsdWVzQnlJZFsgdGhpcy52YWx1ZXNba2V5c1tpXV0gPSB2YWx1ZXNba2V5c1tpXV0gXSA9IGtleXNbaV07XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGVzIGFuIGVudW0gZnJvbSBKU09OLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBFbnVtIG5hbWVcclxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywqPn0ganNvbiBKU09OIG9iamVjdFxyXG4gKiBAcmV0dXJucyB7RW51bX0gQ3JlYXRlZCBlbnVtXHJcbiAqIEB0aHJvd3Mge1R5cGVFcnJvcn0gSWYgYXJndW1lbnRzIGFyZSBpbnZhbGlkXHJcbiAqL1xyXG5FbnVtLmZyb21KU09OID0gZnVuY3Rpb24gZnJvbUpTT04obmFtZSwganNvbikge1xyXG4gICAgcmV0dXJuIG5ldyBFbnVtKG5hbWUsIGpzb24udmFsdWVzLCBqc29uLm9wdGlvbnMpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEBvdmVycmlkZVxyXG4gKi9cclxuRW51bS5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gdG9KU09OKCkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBvcHRpb25zIDogdGhpcy5vcHRpb25zLFxyXG4gICAgICAgIHZhbHVlcyAgOiB0aGlzLnZhbHVlc1xyXG4gICAgfTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBBZGRzIGEgdmFsdWUgdG8gdGhpcyBlbnVtLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBWYWx1ZSBuYW1lXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBpZCBWYWx1ZSBpZFxyXG4gKiBAcGFyYW0gez9zdHJpbmd9IGNvbW1lbnQgQ29tbWVudCwgaWYgYW55XHJcbiAqIEByZXR1cm5zIHtFbnVtfSBgdGhpc2BcclxuICogQHRocm93cyB7VHlwZUVycm9yfSBJZiBhcmd1bWVudHMgYXJlIGludmFsaWRcclxuICogQHRocm93cyB7RXJyb3J9IElmIHRoZXJlIGlzIGFscmVhZHkgYSB2YWx1ZSB3aXRoIHRoaXMgbmFtZSBvciBpZFxyXG4gKi9cclxuRW51bS5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24obmFtZSwgaWQsIGNvbW1lbnQpIHtcclxuICAgIC8vIHV0aWxpemVkIGJ5IHRoZSBwYXJzZXIgYnV0IG5vdCBieSAuZnJvbUpTT05cclxuXHJcbiAgICBpZiAoIXV0aWwuaXNTdHJpbmcobmFtZSkpXHJcbiAgICAgICAgdGhyb3cgVHlwZUVycm9yKFwibmFtZSBtdXN0IGJlIGEgc3RyaW5nXCIpO1xyXG5cclxuICAgIGlmICghdXRpbC5pc0ludGVnZXIoaWQpKVxyXG4gICAgICAgIHRocm93IFR5cGVFcnJvcihcImlkIG11c3QgYmUgYW4gaW50ZWdlclwiKTtcclxuXHJcbiAgICBpZiAodGhpcy52YWx1ZXNbbmFtZV0gIT09IHVuZGVmaW5lZClcclxuICAgICAgICB0aHJvdyBFcnJvcihcImR1cGxpY2F0ZSBuYW1lXCIpO1xyXG5cclxuICAgIGlmICh0aGlzLnZhbHVlc0J5SWRbaWRdICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICBpZiAoISh0aGlzLm9wdGlvbnMgJiYgdGhpcy5vcHRpb25zLmFsbG93X2FsaWFzKSlcclxuICAgICAgICAgICAgdGhyb3cgRXJyb3IoXCJkdXBsaWNhdGUgaWRcIik7XHJcbiAgICAgICAgdGhpcy52YWx1ZXNbbmFtZV0gPSBpZDtcclxuICAgIH0gZWxzZVxyXG4gICAgICAgIHRoaXMudmFsdWVzQnlJZFt0aGlzLnZhbHVlc1tuYW1lXSA9IGlkXSA9IG5hbWU7XHJcblxyXG4gICAgdGhpcy5jb21tZW50c1tuYW1lXSA9IGNvbW1lbnQgfHwgbnVsbDtcclxuICAgIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJlbW92ZXMgYSB2YWx1ZSBmcm9tIHRoaXMgZW51bVxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBWYWx1ZSBuYW1lXHJcbiAqIEByZXR1cm5zIHtFbnVtfSBgdGhpc2BcclxuICogQHRocm93cyB7VHlwZUVycm9yfSBJZiBhcmd1bWVudHMgYXJlIGludmFsaWRcclxuICogQHRocm93cyB7RXJyb3J9IElmIGBuYW1lYCBpcyBub3QgYSBuYW1lIG9mIHRoaXMgZW51bVxyXG4gKi9cclxuRW51bS5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24obmFtZSkge1xyXG5cclxuICAgIGlmICghdXRpbC5pc1N0cmluZyhuYW1lKSlcclxuICAgICAgICB0aHJvdyBUeXBlRXJyb3IoXCJuYW1lIG11c3QgYmUgYSBzdHJpbmdcIik7XHJcblxyXG4gICAgdmFyIHZhbCA9IHRoaXMudmFsdWVzW25hbWVdO1xyXG4gICAgaWYgKHZhbCA9PT0gdW5kZWZpbmVkKVxyXG4gICAgICAgIHRocm93IEVycm9yKFwibmFtZSBkb2VzIG5vdCBleGlzdFwiKTtcclxuXHJcbiAgICBkZWxldGUgdGhpcy52YWx1ZXNCeUlkW3ZhbF07XHJcbiAgICBkZWxldGUgdGhpcy52YWx1ZXNbbmFtZV07XHJcbiAgICBkZWxldGUgdGhpcy5jb21tZW50c1tuYW1lXTtcclxuXHJcbiAgICByZXR1cm4gdGhpcztcclxufTtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbm1vZHVsZS5leHBvcnRzID0gRmllbGQ7XHJcblxyXG4vLyBleHRlbmRzIFJlZmxlY3Rpb25PYmplY3RcclxudmFyIFJlZmxlY3Rpb25PYmplY3QgPSByZXF1aXJlKFwiLi9vYmplY3RcIik7XHJcbigoRmllbGQucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShSZWZsZWN0aW9uT2JqZWN0LnByb3RvdHlwZSkpLmNvbnN0cnVjdG9yID0gRmllbGQpLmNsYXNzTmFtZSA9IFwiRmllbGRcIjtcclxuXHJcbnZhciBFbnVtICA9IHJlcXVpcmUoXCIuL2VudW1cIiksXHJcbiAgICB0eXBlcyA9IHJlcXVpcmUoXCIuL3R5cGVzXCIpLFxyXG4gICAgdXRpbCAgPSByZXF1aXJlKFwiLi91dGlsXCIpO1xyXG5cclxudmFyIFR5cGU7IC8vIGN5Y2xpY1xyXG5cclxuLyoqXHJcbiAqIENvbnN0cnVjdHMgYSBuZXcgbWVzc2FnZSBmaWVsZCBpbnN0YW5jZS4gTm90ZSB0aGF0IHtAbGluayBNYXBGaWVsZHxtYXAgZmllbGRzfSBoYXZlIHRoZWlyIG93biBjbGFzcy5cclxuICogQGNsYXNzZGVzYyBSZWZsZWN0ZWQgbWVzc2FnZSBmaWVsZC5cclxuICogQGV4dGVuZHMgUmVmbGVjdGlvbk9iamVjdFxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgVW5pcXVlIG5hbWUgd2l0aGluIGl0cyBuYW1lc3BhY2VcclxuICogQHBhcmFtIHtudW1iZXJ9IGlkIFVuaXF1ZSBpZCB3aXRoaW4gaXRzIG5hbWVzcGFjZVxyXG4gKiBAcGFyYW0ge3N0cmluZ30gdHlwZSBWYWx1ZSB0eXBlXHJcbiAqIEBwYXJhbSB7c3RyaW5nfE9iamVjdC48c3RyaW5nLCo+fSBbcnVsZT1cIm9wdGlvbmFsXCJdIEZpZWxkIHJ1bGVcclxuICogQHBhcmFtIHtzdHJpbmd8T2JqZWN0LjxzdHJpbmcsKj59IFtleHRlbmRdIEV4dGVuZGVkIHR5cGUgaWYgZGlmZmVyZW50IGZyb20gcGFyZW50XHJcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsKj59IFtvcHRpb25zXSBEZWNsYXJlZCBvcHRpb25zXHJcbiAqL1xyXG5mdW5jdGlvbiBGaWVsZChuYW1lLCBpZCwgdHlwZSwgcnVsZSwgZXh0ZW5kLCBvcHRpb25zKSB7XHJcblxyXG4gICAgaWYgKHV0aWwuaXNPYmplY3QocnVsZSkpIHtcclxuICAgICAgICBvcHRpb25zID0gcnVsZTtcclxuICAgICAgICBydWxlID0gZXh0ZW5kID0gdW5kZWZpbmVkO1xyXG4gICAgfSBlbHNlIGlmICh1dGlsLmlzT2JqZWN0KGV4dGVuZCkpIHtcclxuICAgICAgICBvcHRpb25zID0gZXh0ZW5kO1xyXG4gICAgICAgIGV4dGVuZCA9IHVuZGVmaW5lZDtcclxuICAgIH1cclxuXHJcbiAgICBSZWZsZWN0aW9uT2JqZWN0LmNhbGwodGhpcywgbmFtZSwgb3B0aW9ucyk7XHJcblxyXG4gICAgaWYgKCF1dGlsLmlzSW50ZWdlcihpZCkgfHwgaWQgPCAwKVxyXG4gICAgICAgIHRocm93IFR5cGVFcnJvcihcImlkIG11c3QgYmUgYSBub24tbmVnYXRpdmUgaW50ZWdlclwiKTtcclxuXHJcbiAgICBpZiAoIXV0aWwuaXNTdHJpbmcodHlwZSkpXHJcbiAgICAgICAgdGhyb3cgVHlwZUVycm9yKFwidHlwZSBtdXN0IGJlIGEgc3RyaW5nXCIpO1xyXG5cclxuICAgIGlmIChydWxlICE9PSB1bmRlZmluZWQgJiYgIS9ecmVxdWlyZWR8b3B0aW9uYWx8cmVwZWF0ZWQkLy50ZXN0KHJ1bGUgPSBydWxlLnRvU3RyaW5nKCkudG9Mb3dlckNhc2UoKSkpXHJcbiAgICAgICAgdGhyb3cgVHlwZUVycm9yKFwicnVsZSBtdXN0IGJlIGEgc3RyaW5nIHJ1bGVcIik7XHJcblxyXG4gICAgaWYgKGV4dGVuZCAhPT0gdW5kZWZpbmVkICYmICF1dGlsLmlzU3RyaW5nKGV4dGVuZCkpXHJcbiAgICAgICAgdGhyb3cgVHlwZUVycm9yKFwiZXh0ZW5kIG11c3QgYmUgYSBzdHJpbmdcIik7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGaWVsZCBydWxlLCBpZiBhbnkuXHJcbiAgICAgKiBAdHlwZSB7c3RyaW5nfHVuZGVmaW5lZH1cclxuICAgICAqL1xyXG4gICAgdGhpcy5ydWxlID0gcnVsZSAmJiBydWxlICE9PSBcIm9wdGlvbmFsXCIgPyBydWxlIDogdW5kZWZpbmVkOyAvLyB0b0pTT05cclxuXHJcbiAgICAvKipcclxuICAgICAqIEZpZWxkIHR5cGUuXHJcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxyXG4gICAgICovXHJcbiAgICB0aGlzLnR5cGUgPSB0eXBlOyAvLyB0b0pTT05cclxuXHJcbiAgICAvKipcclxuICAgICAqIFVuaXF1ZSBmaWVsZCBpZC5cclxuICAgICAqIEB0eXBlIHtudW1iZXJ9XHJcbiAgICAgKi9cclxuICAgIHRoaXMuaWQgPSBpZDsgLy8gdG9KU09OLCBtYXJrZXJcclxuXHJcbiAgICAvKipcclxuICAgICAqIEV4dGVuZGVkIHR5cGUgaWYgZGlmZmVyZW50IGZyb20gcGFyZW50LlxyXG4gICAgICogQHR5cGUge3N0cmluZ3x1bmRlZmluZWR9XHJcbiAgICAgKi9cclxuICAgIHRoaXMuZXh0ZW5kID0gZXh0ZW5kIHx8IHVuZGVmaW5lZDsgLy8gdG9KU09OXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBXaGV0aGVyIHRoaXMgZmllbGQgaXMgcmVxdWlyZWQuXHJcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cclxuICAgICAqL1xyXG4gICAgdGhpcy5yZXF1aXJlZCA9IHJ1bGUgPT09IFwicmVxdWlyZWRcIjtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFdoZXRoZXIgdGhpcyBmaWVsZCBpcyBvcHRpb25hbC5cclxuICAgICAqIEB0eXBlIHtib29sZWFufVxyXG4gICAgICovXHJcbiAgICB0aGlzLm9wdGlvbmFsID0gIXRoaXMucmVxdWlyZWQ7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBXaGV0aGVyIHRoaXMgZmllbGQgaXMgcmVwZWF0ZWQuXHJcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cclxuICAgICAqL1xyXG4gICAgdGhpcy5yZXBlYXRlZCA9IHJ1bGUgPT09IFwicmVwZWF0ZWRcIjtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFdoZXRoZXIgdGhpcyBmaWVsZCBpcyBhIG1hcCBvciBub3QuXHJcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cclxuICAgICAqL1xyXG4gICAgdGhpcy5tYXAgPSBmYWxzZTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIE1lc3NhZ2UgdGhpcyBmaWVsZCBiZWxvbmdzIHRvLlxyXG4gICAgICogQHR5cGUgez9UeXBlfVxyXG4gICAgICovXHJcbiAgICB0aGlzLm1lc3NhZ2UgPSBudWxsO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogT25lT2YgdGhpcyBmaWVsZCBiZWxvbmdzIHRvLCBpZiBhbnksXHJcbiAgICAgKiBAdHlwZSB7P09uZU9mfVxyXG4gICAgICovXHJcbiAgICB0aGlzLnBhcnRPZiA9IG51bGw7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgZmllbGQgdHlwZSdzIGRlZmF1bHQgdmFsdWUuXHJcbiAgICAgKiBAdHlwZSB7Kn1cclxuICAgICAqL1xyXG4gICAgdGhpcy50eXBlRGVmYXVsdCA9IG51bGw7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgZmllbGQncyBkZWZhdWx0IHZhbHVlIG9uIHByb3RvdHlwZXMuXHJcbiAgICAgKiBAdHlwZSB7Kn1cclxuICAgICAqL1xyXG4gICAgdGhpcy5kZWZhdWx0VmFsdWUgPSBudWxsO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogV2hldGhlciB0aGlzIGZpZWxkJ3MgdmFsdWUgc2hvdWxkIGJlIHRyZWF0ZWQgYXMgYSBsb25nLlxyXG4gICAgICogQHR5cGUge2Jvb2xlYW59XHJcbiAgICAgKi9cclxuICAgIHRoaXMubG9uZyA9IHV0aWwuTG9uZyA/IHR5cGVzLmxvbmdbdHlwZV0gIT09IHVuZGVmaW5lZCA6IC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovIGZhbHNlO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogV2hldGhlciB0aGlzIGZpZWxkJ3MgdmFsdWUgaXMgYSBidWZmZXIuXHJcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cclxuICAgICAqL1xyXG4gICAgdGhpcy5ieXRlcyA9IHR5cGUgPT09IFwiYnl0ZXNcIjtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlc29sdmVkIHR5cGUgaWYgbm90IGEgYmFzaWMgdHlwZS5cclxuICAgICAqIEB0eXBlIHs/KFR5cGV8RW51bSl9XHJcbiAgICAgKi9cclxuICAgIHRoaXMucmVzb2x2ZWRUeXBlID0gbnVsbDtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFNpc3Rlci1maWVsZCB3aXRoaW4gdGhlIGV4dGVuZGVkIHR5cGUgaWYgYSBkZWNsYXJpbmcgZXh0ZW5zaW9uIGZpZWxkLlxyXG4gICAgICogQHR5cGUgez9GaWVsZH1cclxuICAgICAqL1xyXG4gICAgdGhpcy5leHRlbnNpb25GaWVsZCA9IG51bGw7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTaXN0ZXItZmllbGQgd2l0aGluIHRoZSBkZWNsYXJpbmcgbmFtZXNwYWNlIGlmIGFuIGV4dGVuZGVkIGZpZWxkLlxyXG4gICAgICogQHR5cGUgez9GaWVsZH1cclxuICAgICAqL1xyXG4gICAgdGhpcy5kZWNsYXJpbmdGaWVsZCA9IG51bGw7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBJbnRlcm5hbGx5IHJlbWVtYmVycyB3aGV0aGVyIHRoaXMgZmllbGQgaXMgcGFja2VkLlxyXG4gICAgICogQHR5cGUgez9ib29sZWFufVxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqL1xyXG4gICAgdGhpcy5fcGFja2VkID0gbnVsbDtcclxufVxyXG5cclxuLyoqXHJcbiAqIERldGVybWluZXMgd2hldGhlciB0aGlzIGZpZWxkIGlzIHBhY2tlZC4gT25seSByZWxldmFudCB3aGVuIHJlcGVhdGVkIGFuZCB3b3JraW5nIHdpdGggcHJvdG8yLlxyXG4gKiBAbmFtZSBGaWVsZCNwYWNrZWRcclxuICogQHR5cGUge2Jvb2xlYW59XHJcbiAqIEByZWFkb25seVxyXG4gKi9cclxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEZpZWxkLnByb3RvdHlwZSwgXCJwYWNrZWRcIiwge1xyXG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcclxuICAgICAgICAvLyBkZWZhdWx0cyB0byBwYWNrZWQ9dHJ1ZSBpZiBub3QgZXhwbGljaXR5IHNldCB0byBmYWxzZVxyXG4gICAgICAgIGlmICh0aGlzLl9wYWNrZWQgPT09IG51bGwpXHJcbiAgICAgICAgICAgIHRoaXMuX3BhY2tlZCA9IHRoaXMuZ2V0T3B0aW9uKFwicGFja2VkXCIpICE9PSBmYWxzZTtcclxuICAgICAgICByZXR1cm4gdGhpcy5fcGFja2VkO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbi8qKlxyXG4gKiBAb3ZlcnJpZGVcclxuICovXHJcbkZpZWxkLnByb3RvdHlwZS5zZXRPcHRpb24gPSBmdW5jdGlvbiBzZXRPcHRpb24obmFtZSwgdmFsdWUsIGlmTm90U2V0KSB7XHJcbiAgICBpZiAobmFtZSA9PT0gXCJwYWNrZWRcIikgLy8gY2xlYXIgY2FjaGVkIGJlZm9yZSBzZXR0aW5nXHJcbiAgICAgICAgdGhpcy5fcGFja2VkID0gbnVsbDtcclxuICAgIHJldHVybiBSZWZsZWN0aW9uT2JqZWN0LnByb3RvdHlwZS5zZXRPcHRpb24uY2FsbCh0aGlzLCBuYW1lLCB2YWx1ZSwgaWZOb3RTZXQpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENvbnN0cnVjdHMgYSBmaWVsZCBmcm9tIEpTT04uXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIEZpZWxkIG5hbWVcclxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywqPn0ganNvbiBKU09OIG9iamVjdFxyXG4gKiBAcmV0dXJucyB7RmllbGR9IENyZWF0ZWQgZmllbGRcclxuICogQHRocm93cyB7VHlwZUVycm9yfSBJZiBhcmd1bWVudHMgYXJlIGludmFsaWRcclxuICovXHJcbkZpZWxkLmZyb21KU09OID0gZnVuY3Rpb24gZnJvbUpTT04obmFtZSwganNvbikge1xyXG4gICAgcmV0dXJuIG5ldyBGaWVsZChuYW1lLCBqc29uLmlkLCBqc29uLnR5cGUsIGpzb24ucnVsZSwganNvbi5leHRlbmQsIGpzb24ub3B0aW9ucyk7XHJcbn07XHJcblxyXG4vKipcclxuICogQG92ZXJyaWRlXHJcbiAqL1xyXG5GaWVsZC5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gdG9KU09OKCkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBydWxlICAgIDogdGhpcy5ydWxlICE9PSBcIm9wdGlvbmFsXCIgJiYgdGhpcy5ydWxlIHx8IHVuZGVmaW5lZCxcclxuICAgICAgICB0eXBlICAgIDogdGhpcy50eXBlLFxyXG4gICAgICAgIGlkICAgICAgOiB0aGlzLmlkLFxyXG4gICAgICAgIGV4dGVuZCAgOiB0aGlzLmV4dGVuZCxcclxuICAgICAgICBvcHRpb25zIDogdGhpcy5vcHRpb25zXHJcbiAgICB9O1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJlc29sdmVzIHRoaXMgZmllbGQncyB0eXBlIHJlZmVyZW5jZXMuXHJcbiAqIEByZXR1cm5zIHtGaWVsZH0gYHRoaXNgXHJcbiAqIEB0aHJvd3Mge0Vycm9yfSBJZiBhbnkgcmVmZXJlbmNlIGNhbm5vdCBiZSByZXNvbHZlZFxyXG4gKi9cclxuRmllbGQucHJvdG90eXBlLnJlc29sdmUgPSBmdW5jdGlvbiByZXNvbHZlKCkge1xyXG5cclxuICAgIGlmICh0aGlzLnJlc29sdmVkKVxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG5cclxuICAgIGlmICgodGhpcy50eXBlRGVmYXVsdCA9IHR5cGVzLmRlZmF1bHRzW3RoaXMudHlwZV0pID09PSB1bmRlZmluZWQpIHsgLy8gaWYgbm90IGEgYmFzaWMgdHlwZSwgcmVzb2x2ZSBpdFxyXG5cclxuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cclxuICAgICAgICBpZiAoIVR5cGUpXHJcbiAgICAgICAgICAgIFR5cGUgPSByZXF1aXJlKFwiLi90eXBlXCIpO1xyXG5cclxuICAgICAgICB2YXIgc2NvcGUgPSB0aGlzLmRlY2xhcmluZ0ZpZWxkID8gdGhpcy5kZWNsYXJpbmdGaWVsZC5wYXJlbnQgOiB0aGlzLnBhcmVudDtcclxuICAgICAgICBpZiAodGhpcy5yZXNvbHZlZFR5cGUgPSBzY29wZS5sb29rdXAodGhpcy50eXBlLCBUeXBlKSlcclxuICAgICAgICAgICAgdGhpcy50eXBlRGVmYXVsdCA9IG51bGw7XHJcbiAgICAgICAgZWxzZSBpZiAodGhpcy5yZXNvbHZlZFR5cGUgPSBzY29wZS5sb29rdXAodGhpcy50eXBlLCBFbnVtKSlcclxuICAgICAgICAgICAgdGhpcy50eXBlRGVmYXVsdCA9IHRoaXMucmVzb2x2ZWRUeXBlLnZhbHVlc1tPYmplY3Qua2V5cyh0aGlzLnJlc29sdmVkVHlwZS52YWx1ZXMpWzBdXTsgLy8gZmlyc3QgZGVmaW5lZFxyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgICAgdGhyb3cgRXJyb3IoXCJ1bnJlc29sdmFibGUgZmllbGQgdHlwZTogXCIgKyB0aGlzLnR5cGUgKyBcIiBpbiBcIiArIHNjb3BlKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyB1c2UgZXhwbGljaXRseSBzZXQgZGVmYXVsdCB2YWx1ZSBpZiBwcmVzZW50XHJcbiAgICBpZiAodGhpcy5vcHRpb25zICYmIHRoaXMub3B0aW9uc1tcImRlZmF1bHRcIl0gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIHRoaXMudHlwZURlZmF1bHQgPSB0aGlzLm9wdGlvbnNbXCJkZWZhdWx0XCJdO1xyXG4gICAgICAgIGlmICh0aGlzLnJlc29sdmVkVHlwZSBpbnN0YW5jZW9mIEVudW0gJiYgdHlwZW9mIHRoaXMudHlwZURlZmF1bHQgPT09IFwic3RyaW5nXCIpXHJcbiAgICAgICAgICAgIHRoaXMudHlwZURlZmF1bHQgPSB0aGlzLnJlc29sdmVkVHlwZS52YWx1ZXNbdGhpcy50eXBlRGVmYXVsdF07XHJcbiAgICB9XHJcblxyXG4gICAgLy8gcmVtb3ZlIHVubmVjZXNzYXJ5IHBhY2tlZCBvcHRpb24gKHBhcnNlciBhZGRzIHRoaXMpIGlmIG5vdCByZWZlcmVuY2luZyBhbiBlbnVtXHJcbiAgICBpZiAodGhpcy5vcHRpb25zICYmIHRoaXMub3B0aW9ucy5wYWNrZWQgIT09IHVuZGVmaW5lZCAmJiB0aGlzLnJlc29sdmVkVHlwZSAmJiAhKHRoaXMucmVzb2x2ZWRUeXBlIGluc3RhbmNlb2YgRW51bSkpXHJcbiAgICAgICAgZGVsZXRlIHRoaXMub3B0aW9ucy5wYWNrZWQ7XHJcblxyXG4gICAgLy8gY29udmVydCB0byBpbnRlcm5hbCBkYXRhIHR5cGUgaWYgbmVjZXNzc2FyeVxyXG4gICAgaWYgKHRoaXMubG9uZykge1xyXG4gICAgICAgIHRoaXMudHlwZURlZmF1bHQgPSB1dGlsLkxvbmcuZnJvbU51bWJlcih0aGlzLnR5cGVEZWZhdWx0LCB0aGlzLnR5cGUuY2hhckF0KDApID09PSBcInVcIik7XHJcblxyXG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICovXHJcbiAgICAgICAgaWYgKE9iamVjdC5mcmVlemUpXHJcbiAgICAgICAgICAgIE9iamVjdC5mcmVlemUodGhpcy50eXBlRGVmYXVsdCk7IC8vIGxvbmcgaW5zdGFuY2VzIGFyZSBtZWFudCB0byBiZSBpbW11dGFibGUgYW55d2F5IChpLmUuIHVzZSBzbWFsbCBpbnQgY2FjaGUgdGhhdCBldmVuIHJlcXVpcmVzIGl0KVxyXG5cclxuICAgIH0gZWxzZSBpZiAodGhpcy5ieXRlcyAmJiB0eXBlb2YgdGhpcy50eXBlRGVmYXVsdCA9PT0gXCJzdHJpbmdcIikge1xyXG4gICAgICAgIHZhciBidWY7XHJcbiAgICAgICAgaWYgKHV0aWwuYmFzZTY0LnRlc3QodGhpcy50eXBlRGVmYXVsdCkpXHJcbiAgICAgICAgICAgIHV0aWwuYmFzZTY0LmRlY29kZSh0aGlzLnR5cGVEZWZhdWx0LCBidWYgPSB1dGlsLm5ld0J1ZmZlcih1dGlsLmJhc2U2NC5sZW5ndGgodGhpcy50eXBlRGVmYXVsdCkpLCAwKTtcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgIHV0aWwudXRmOC53cml0ZSh0aGlzLnR5cGVEZWZhdWx0LCBidWYgPSB1dGlsLm5ld0J1ZmZlcih1dGlsLnV0ZjgubGVuZ3RoKHRoaXMudHlwZURlZmF1bHQpKSwgMCk7XHJcbiAgICAgICAgdGhpcy50eXBlRGVmYXVsdCA9IGJ1ZjtcclxuICAgIH1cclxuXHJcbiAgICAvLyB0YWtlIHNwZWNpYWwgY2FyZSBvZiBtYXBzIGFuZCByZXBlYXRlZCBmaWVsZHNcclxuICAgIGlmICh0aGlzLm1hcClcclxuICAgICAgICB0aGlzLmRlZmF1bHRWYWx1ZSA9IHV0aWwuZW1wdHlPYmplY3Q7XHJcbiAgICBlbHNlIGlmICh0aGlzLnJlcGVhdGVkKVxyXG4gICAgICAgIHRoaXMuZGVmYXVsdFZhbHVlID0gdXRpbC5lbXB0eUFycmF5O1xyXG4gICAgZWxzZVxyXG4gICAgICAgIHRoaXMuZGVmYXVsdFZhbHVlID0gdGhpcy50eXBlRGVmYXVsdDtcclxuXHJcbiAgICByZXR1cm4gUmVmbGVjdGlvbk9iamVjdC5wcm90b3R5cGUucmVzb2x2ZS5jYWxsKHRoaXMpO1xyXG59O1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxudmFyIHByb3RvYnVmID0gbW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiLi9pbmRleC1taW5pbWFsXCIpO1xyXG5cclxucHJvdG9idWYuYnVpbGQgPSBcImxpZ2h0XCI7XHJcblxyXG4vKipcclxuICogQSBub2RlLXN0eWxlIGNhbGxiYWNrIGFzIHVzZWQgYnkge0BsaW5rIGxvYWR9IGFuZCB7QGxpbmsgUm9vdCNsb2FkfS5cclxuICogQHR5cGVkZWYgTG9hZENhbGxiYWNrXHJcbiAqIEB0eXBlIHtmdW5jdGlvbn1cclxuICogQHBhcmFtIHs/RXJyb3J9IGVycm9yIEVycm9yLCBpZiBhbnksIG90aGVyd2lzZSBgbnVsbGBcclxuICogQHBhcmFtIHtSb290fSBbcm9vdF0gUm9vdCwgaWYgdGhlcmUgaGFzbid0IGJlZW4gYW4gZXJyb3JcclxuICogQHJldHVybnMge3VuZGVmaW5lZH1cclxuICovXHJcblxyXG4vKipcclxuICogTG9hZHMgb25lIG9yIG11bHRpcGxlIC5wcm90byBvciBwcmVwcm9jZXNzZWQgLmpzb24gZmlsZXMgaW50byBhIGNvbW1vbiByb290IG5hbWVzcGFjZSBhbmQgY2FsbHMgdGhlIGNhbGxiYWNrLlxyXG4gKiBAcGFyYW0ge3N0cmluZ3xzdHJpbmdbXX0gZmlsZW5hbWUgT25lIG9yIG11bHRpcGxlIGZpbGVzIHRvIGxvYWRcclxuICogQHBhcmFtIHtSb290fSByb290IFJvb3QgbmFtZXNwYWNlLCBkZWZhdWx0cyB0byBjcmVhdGUgYSBuZXcgb25lIGlmIG9taXR0ZWQuXHJcbiAqIEBwYXJhbSB7TG9hZENhbGxiYWNrfSBjYWxsYmFjayBDYWxsYmFjayBmdW5jdGlvblxyXG4gKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxyXG4gKiBAc2VlIHtAbGluayBSb290I2xvYWR9XHJcbiAqL1xyXG5mdW5jdGlvbiBsb2FkKGZpbGVuYW1lLCByb290LCBjYWxsYmFjaykge1xyXG4gICAgaWYgKHR5cGVvZiByb290ID09PSBcImZ1bmN0aW9uXCIpIHtcclxuICAgICAgICBjYWxsYmFjayA9IHJvb3Q7XHJcbiAgICAgICAgcm9vdCA9IG5ldyBwcm90b2J1Zi5Sb290KCk7XHJcbiAgICB9IGVsc2UgaWYgKCFyb290KVxyXG4gICAgICAgIHJvb3QgPSBuZXcgcHJvdG9idWYuUm9vdCgpO1xyXG4gICAgcmV0dXJuIHJvb3QubG9hZChmaWxlbmFtZSwgY2FsbGJhY2spO1xyXG59XHJcblxyXG4vKipcclxuICogTG9hZHMgb25lIG9yIG11bHRpcGxlIC5wcm90byBvciBwcmVwcm9jZXNzZWQgLmpzb24gZmlsZXMgaW50byBhIGNvbW1vbiByb290IG5hbWVzcGFjZSBhbmQgY2FsbHMgdGhlIGNhbGxiYWNrLlxyXG4gKiBAbmFtZSBsb2FkXHJcbiAqIEBmdW5jdGlvblxyXG4gKiBAcGFyYW0ge3N0cmluZ3xzdHJpbmdbXX0gZmlsZW5hbWUgT25lIG9yIG11bHRpcGxlIGZpbGVzIHRvIGxvYWRcclxuICogQHBhcmFtIHtMb2FkQ2FsbGJhY2t9IGNhbGxiYWNrIENhbGxiYWNrIGZ1bmN0aW9uXHJcbiAqIEByZXR1cm5zIHt1bmRlZmluZWR9XHJcbiAqIEBzZWUge0BsaW5rIFJvb3QjbG9hZH1cclxuICogQHZhcmlhdGlvbiAyXHJcbiAqL1xyXG4vLyBmdW5jdGlvbiBsb2FkKGZpbGVuYW1lOnN0cmluZywgY2FsbGJhY2s6TG9hZENhbGxiYWNrKTp1bmRlZmluZWRcclxuXHJcbi8qKlxyXG4gKiBMb2FkcyBvbmUgb3IgbXVsdGlwbGUgLnByb3RvIG9yIHByZXByb2Nlc3NlZCAuanNvbiBmaWxlcyBpbnRvIGEgY29tbW9uIHJvb3QgbmFtZXNwYWNlIGFuZCByZXR1cm5zIGEgcHJvbWlzZS5cclxuICogQG5hbWUgbG9hZFxyXG4gKiBAZnVuY3Rpb25cclxuICogQHBhcmFtIHtzdHJpbmd8c3RyaW5nW119IGZpbGVuYW1lIE9uZSBvciBtdWx0aXBsZSBmaWxlcyB0byBsb2FkXHJcbiAqIEBwYXJhbSB7Um9vdH0gW3Jvb3RdIFJvb3QgbmFtZXNwYWNlLCBkZWZhdWx0cyB0byBjcmVhdGUgYSBuZXcgb25lIGlmIG9taXR0ZWQuXHJcbiAqIEByZXR1cm5zIHtQcm9taXNlPFJvb3Q+fSBQcm9taXNlXHJcbiAqIEBzZWUge0BsaW5rIFJvb3QjbG9hZH1cclxuICogQHZhcmlhdGlvbiAzXHJcbiAqL1xyXG4vLyBmdW5jdGlvbiBsb2FkKGZpbGVuYW1lOnN0cmluZywgW3Jvb3Q6Um9vdF0pOlByb21pc2U8Um9vdD5cclxuXHJcbnByb3RvYnVmLmxvYWQgPSBsb2FkO1xyXG5cclxuLyoqXHJcbiAqIFN5bmNocm9ub3VzbHkgbG9hZHMgb25lIG9yIG11bHRpcGxlIC5wcm90byBvciBwcmVwcm9jZXNzZWQgLmpzb24gZmlsZXMgaW50byBhIGNvbW1vbiByb290IG5hbWVzcGFjZSAobm9kZSBvbmx5KS5cclxuICogQHBhcmFtIHtzdHJpbmd8c3RyaW5nW119IGZpbGVuYW1lIE9uZSBvciBtdWx0aXBsZSBmaWxlcyB0byBsb2FkXHJcbiAqIEBwYXJhbSB7Um9vdH0gW3Jvb3RdIFJvb3QgbmFtZXNwYWNlLCBkZWZhdWx0cyB0byBjcmVhdGUgYSBuZXcgb25lIGlmIG9taXR0ZWQuXHJcbiAqIEByZXR1cm5zIHtSb290fSBSb290IG5hbWVzcGFjZVxyXG4gKiBAdGhyb3dzIHtFcnJvcn0gSWYgc3luY2hyb25vdXMgZmV0Y2hpbmcgaXMgbm90IHN1cHBvcnRlZCAoaS5lLiBpbiBicm93c2Vycykgb3IgaWYgYSBmaWxlJ3Mgc3ludGF4IGlzIGludmFsaWRcclxuICogQHNlZSB7QGxpbmsgUm9vdCNsb2FkU3luY31cclxuICovXHJcbmZ1bmN0aW9uIGxvYWRTeW5jKGZpbGVuYW1lLCByb290KSB7XHJcbiAgICBpZiAoIXJvb3QpXHJcbiAgICAgICAgcm9vdCA9IG5ldyBwcm90b2J1Zi5Sb290KCk7XHJcbiAgICByZXR1cm4gcm9vdC5sb2FkU3luYyhmaWxlbmFtZSk7XHJcbn1cclxuXHJcbnByb3RvYnVmLmxvYWRTeW5jID0gbG9hZFN5bmM7XHJcblxyXG4vLyBTZXJpYWxpemF0aW9uXHJcbnByb3RvYnVmLmVuY29kZXIgICAgICAgICAgPSByZXF1aXJlKFwiLi9lbmNvZGVyXCIpO1xyXG5wcm90b2J1Zi5kZWNvZGVyICAgICAgICAgID0gcmVxdWlyZShcIi4vZGVjb2RlclwiKTtcclxucHJvdG9idWYudmVyaWZpZXIgICAgICAgICA9IHJlcXVpcmUoXCIuL3ZlcmlmaWVyXCIpO1xyXG5wcm90b2J1Zi5jb252ZXJ0ZXIgICAgICAgID0gcmVxdWlyZShcIi4vY29udmVydGVyXCIpO1xyXG5cclxuLy8gUmVmbGVjdGlvblxyXG5wcm90b2J1Zi5SZWZsZWN0aW9uT2JqZWN0ID0gcmVxdWlyZShcIi4vb2JqZWN0XCIpO1xyXG5wcm90b2J1Zi5OYW1lc3BhY2UgICAgICAgID0gcmVxdWlyZShcIi4vbmFtZXNwYWNlXCIpO1xyXG5wcm90b2J1Zi5Sb290ICAgICAgICAgICAgID0gcmVxdWlyZShcIi4vcm9vdFwiKTtcclxucHJvdG9idWYuRW51bSAgICAgICAgICAgICA9IHJlcXVpcmUoXCIuL2VudW1cIik7XHJcbnByb3RvYnVmLlR5cGUgICAgICAgICAgICAgPSByZXF1aXJlKFwiLi90eXBlXCIpO1xyXG5wcm90b2J1Zi5GaWVsZCAgICAgICAgICAgID0gcmVxdWlyZShcIi4vZmllbGRcIik7XHJcbnByb3RvYnVmLk9uZU9mICAgICAgICAgICAgPSByZXF1aXJlKFwiLi9vbmVvZlwiKTtcclxucHJvdG9idWYuTWFwRmllbGQgICAgICAgICA9IHJlcXVpcmUoXCIuL21hcGZpZWxkXCIpO1xyXG5wcm90b2J1Zi5TZXJ2aWNlICAgICAgICAgID0gcmVxdWlyZShcIi4vc2VydmljZVwiKTtcclxucHJvdG9idWYuTWV0aG9kICAgICAgICAgICA9IHJlcXVpcmUoXCIuL21ldGhvZFwiKTtcclxuXHJcbi8vIFJ1bnRpbWVcclxucHJvdG9idWYuQ2xhc3MgICAgICAgICAgICA9IHJlcXVpcmUoXCIuL2NsYXNzXCIpO1xyXG5wcm90b2J1Zi5NZXNzYWdlICAgICAgICAgID0gcmVxdWlyZShcIi4vbWVzc2FnZVwiKTtcclxuXHJcbi8vIFV0aWxpdHlcclxucHJvdG9idWYudHlwZXMgICAgICAgICAgICA9IHJlcXVpcmUoXCIuL3R5cGVzXCIpO1xyXG5wcm90b2J1Zi51dGlsICAgICAgICAgICAgID0gcmVxdWlyZShcIi4vdXRpbFwiKTtcclxuXHJcbi8vIENvbmZpZ3VyZSByZWZsZWN0aW9uXHJcbnByb3RvYnVmLlJlZmxlY3Rpb25PYmplY3QuX2NvbmZpZ3VyZShwcm90b2J1Zi5Sb290KTtcclxucHJvdG9idWYuTmFtZXNwYWNlLl9jb25maWd1cmUocHJvdG9idWYuVHlwZSwgcHJvdG9idWYuU2VydmljZSk7XHJcbnByb3RvYnVmLlJvb3QuX2NvbmZpZ3VyZShwcm90b2J1Zi5UeXBlKTtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbnZhciBwcm90b2J1ZiA9IGV4cG9ydHM7XHJcblxyXG4vKipcclxuICogQnVpbGQgdHlwZSwgb25lIG9mIGBcImZ1bGxcImAsIGBcImxpZ2h0XCJgIG9yIGBcIm1pbmltYWxcImAuXHJcbiAqIEBuYW1lIGJ1aWxkXHJcbiAqIEB0eXBlIHtzdHJpbmd9XHJcbiAqL1xyXG5wcm90b2J1Zi5idWlsZCA9IFwibWluaW1hbFwiO1xyXG5cclxuLyoqXHJcbiAqIE5hbWVkIHJvb3RzLlxyXG4gKiBUaGlzIGlzIHdoZXJlIHBianMgc3RvcmVzIGdlbmVyYXRlZCBzdHJ1Y3R1cmVzICh0aGUgb3B0aW9uIGAtciwgLS1yb290YCBzcGVjaWZpZXMgYSBuYW1lKS5cclxuICogQ2FuIGFsc28gYmUgdXNlZCBtYW51YWxseSB0byBtYWtlIHJvb3RzIGF2YWlsYWJsZSBhY2Nyb3NzIG1vZHVsZXMuXHJcbiAqIEBuYW1lIHJvb3RzXHJcbiAqIEB0eXBlIHtPYmplY3QuPHN0cmluZyxSb290Pn1cclxuICogQGV4YW1wbGVcclxuICogLy8gcGJqcyAtciBteXJvb3QgLW8gY29tcGlsZWQuanMgLi4uXHJcbiAqIFxyXG4gKiAvLyBpbiBhbm90aGVyIG1vZHVsZTpcclxuICogcmVxdWlyZShcIi4vY29tcGlsZWQuanNcIik7XHJcbiAqIFxyXG4gKiAvLyBpbiBhbnkgc3Vic2VxdWVudCBtb2R1bGU6XHJcbiAqIHZhciByb290ID0gcHJvdG9idWYucm9vdHNbXCJteXJvb3RcIl07XHJcbiAqL1xyXG5wcm90b2J1Zi5yb290cyA9IHt9O1xyXG5cclxuLy8gU2VyaWFsaXphdGlvblxyXG5wcm90b2J1Zi5Xcml0ZXIgICAgICAgPSByZXF1aXJlKFwiLi93cml0ZXJcIik7XHJcbnByb3RvYnVmLkJ1ZmZlcldyaXRlciA9IHJlcXVpcmUoXCIuL3dyaXRlcl9idWZmZXJcIik7XHJcbnByb3RvYnVmLlJlYWRlciAgICAgICA9IHJlcXVpcmUoXCIuL3JlYWRlclwiKTtcclxucHJvdG9idWYuQnVmZmVyUmVhZGVyID0gcmVxdWlyZShcIi4vcmVhZGVyX2J1ZmZlclwiKTtcclxuXHJcbi8vIFV0aWxpdHlcclxucHJvdG9idWYudXRpbCAgICAgICAgID0gcmVxdWlyZShcIi4vdXRpbC9taW5pbWFsXCIpO1xyXG5wcm90b2J1Zi5ycGMgICAgICAgICAgPSByZXF1aXJlKFwiLi9ycGNcIik7XHJcbnByb3RvYnVmLmNvbmZpZ3VyZSAgICA9IGNvbmZpZ3VyZTtcclxuXHJcbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbi8qKlxyXG4gKiBSZWNvbmZpZ3VyZXMgdGhlIGxpYnJhcnkgYWNjb3JkaW5nIHRvIHRoZSBlbnZpcm9ubWVudC5cclxuICogQHJldHVybnMge3VuZGVmaW5lZH1cclxuICovXHJcbmZ1bmN0aW9uIGNvbmZpZ3VyZSgpIHtcclxuICAgIHByb3RvYnVmLlJlYWRlci5fY29uZmlndXJlKHByb3RvYnVmLkJ1ZmZlclJlYWRlcik7XHJcbiAgICBwcm90b2J1Zi51dGlsLl9jb25maWd1cmUoKTtcclxufVxyXG5cclxuLy8gQ29uZmlndXJlIHNlcmlhbGl6YXRpb25cclxucHJvdG9idWYuV3JpdGVyLl9jb25maWd1cmUocHJvdG9idWYuQnVmZmVyV3JpdGVyKTtcclxuY29uZmlndXJlKCk7XHJcbiIsIlwidXNlIHN0cmljdFwiO1xyXG52YXIgcHJvdG9idWYgPSBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCIuL2luZGV4LWxpZ2h0XCIpO1xyXG5cclxucHJvdG9idWYuYnVpbGQgPSBcImZ1bGxcIjtcclxuXHJcbi8vIFBhcnNlclxyXG5wcm90b2J1Zi50b2tlbml6ZSAgICAgICAgID0gcmVxdWlyZShcIi4vdG9rZW5pemVcIik7XHJcbnByb3RvYnVmLnBhcnNlICAgICAgICAgICAgPSByZXF1aXJlKFwiLi9wYXJzZVwiKTtcclxucHJvdG9idWYuY29tbW9uICAgICAgICAgICA9IHJlcXVpcmUoXCIuL2NvbW1vblwiKTtcclxuXHJcbi8vIENvbmZpZ3VyZSBwYXJzZXJcclxucHJvdG9idWYuUm9vdC5fY29uZmlndXJlKHByb3RvYnVmLlR5cGUsIHByb3RvYnVmLnBhcnNlLCBwcm90b2J1Zi5jb21tb24pO1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxubW9kdWxlLmV4cG9ydHMgPSBNYXBGaWVsZDtcclxuXHJcbi8vIGV4dGVuZHMgRmllbGRcclxudmFyIEZpZWxkID0gcmVxdWlyZShcIi4vZmllbGRcIik7XHJcbigoTWFwRmllbGQucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShGaWVsZC5wcm90b3R5cGUpKS5jb25zdHJ1Y3RvciA9IE1hcEZpZWxkKS5jbGFzc05hbWUgPSBcIk1hcEZpZWxkXCI7XHJcblxyXG52YXIgdHlwZXMgICA9IHJlcXVpcmUoXCIuL3R5cGVzXCIpLFxyXG4gICAgdXRpbCAgICA9IHJlcXVpcmUoXCIuL3V0aWxcIik7XHJcblxyXG4vKipcclxuICogQ29uc3RydWN0cyBhIG5ldyBtYXAgZmllbGQgaW5zdGFuY2UuXHJcbiAqIEBjbGFzc2Rlc2MgUmVmbGVjdGVkIG1hcCBmaWVsZC5cclxuICogQGV4dGVuZHMgRmllbGRcclxuICogQGNvbnN0cnVjdG9yXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIFVuaXF1ZSBuYW1lIHdpdGhpbiBpdHMgbmFtZXNwYWNlXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBpZCBVbmlxdWUgaWQgd2l0aGluIGl0cyBuYW1lc3BhY2VcclxuICogQHBhcmFtIHtzdHJpbmd9IGtleVR5cGUgS2V5IHR5cGVcclxuICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgVmFsdWUgdHlwZVxyXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCo+fSBbb3B0aW9uc10gRGVjbGFyZWQgb3B0aW9uc1xyXG4gKi9cclxuZnVuY3Rpb24gTWFwRmllbGQobmFtZSwgaWQsIGtleVR5cGUsIHR5cGUsIG9wdGlvbnMpIHtcclxuICAgIEZpZWxkLmNhbGwodGhpcywgbmFtZSwgaWQsIHR5cGUsIG9wdGlvbnMpO1xyXG5cclxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICBpZiAoIXV0aWwuaXNTdHJpbmcoa2V5VHlwZSkpXHJcbiAgICAgICAgdGhyb3cgVHlwZUVycm9yKFwia2V5VHlwZSBtdXN0IGJlIGEgc3RyaW5nXCIpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogS2V5IHR5cGUuXHJcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxyXG4gICAgICovXHJcbiAgICB0aGlzLmtleVR5cGUgPSBrZXlUeXBlOyAvLyB0b0pTT04sIG1hcmtlclxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVzb2x2ZWQga2V5IHR5cGUgaWYgbm90IGEgYmFzaWMgdHlwZS5cclxuICAgICAqIEB0eXBlIHs/UmVmbGVjdGlvbk9iamVjdH1cclxuICAgICAqL1xyXG4gICAgdGhpcy5yZXNvbHZlZEtleVR5cGUgPSBudWxsO1xyXG5cclxuICAgIC8vIE92ZXJyaWRlcyBGaWVsZCNtYXBcclxuICAgIHRoaXMubWFwID0gdHJ1ZTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvbnN0cnVjdHMgYSBtYXAgZmllbGQgZnJvbSBKU09OLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBGaWVsZCBuYW1lXHJcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsKj59IGpzb24gSlNPTiBvYmplY3RcclxuICogQHJldHVybnMge01hcEZpZWxkfSBDcmVhdGVkIG1hcCBmaWVsZFxyXG4gKiBAdGhyb3dzIHtUeXBlRXJyb3J9IElmIGFyZ3VtZW50cyBhcmUgaW52YWxpZFxyXG4gKi9cclxuTWFwRmllbGQuZnJvbUpTT04gPSBmdW5jdGlvbiBmcm9tSlNPTihuYW1lLCBqc29uKSB7XHJcbiAgICByZXR1cm4gbmV3IE1hcEZpZWxkKG5hbWUsIGpzb24uaWQsIGpzb24ua2V5VHlwZSwganNvbi50eXBlLCBqc29uLm9wdGlvbnMpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEBvdmVycmlkZVxyXG4gKi9cclxuTWFwRmllbGQucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uIHRvSlNPTigpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAga2V5VHlwZSA6IHRoaXMua2V5VHlwZSxcclxuICAgICAgICB0eXBlICAgIDogdGhpcy50eXBlLFxyXG4gICAgICAgIGlkICAgICAgOiB0aGlzLmlkLFxyXG4gICAgICAgIGV4dGVuZCAgOiB0aGlzLmV4dGVuZCxcclxuICAgICAgICBvcHRpb25zIDogdGhpcy5vcHRpb25zXHJcbiAgICB9O1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEBvdmVycmlkZVxyXG4gKi9cclxuTWFwRmllbGQucHJvdG90eXBlLnJlc29sdmUgPSBmdW5jdGlvbiByZXNvbHZlKCkge1xyXG4gICAgaWYgKHRoaXMucmVzb2x2ZWQpXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcblxyXG4gICAgLy8gQmVzaWRlcyBhIHZhbHVlIHR5cGUsIG1hcCBmaWVsZHMgaGF2ZSBhIGtleSB0eXBlIHRoYXQgbWF5IGJlIFwiYW55IHNjYWxhciB0eXBlIGV4Y2VwdCBmb3IgZmxvYXRpbmcgcG9pbnQgdHlwZXMgYW5kIGJ5dGVzXCJcclxuICAgIGlmICh0eXBlcy5tYXBLZXlbdGhpcy5rZXlUeXBlXSA9PT0gdW5kZWZpbmVkKVxyXG4gICAgICAgIHRocm93IEVycm9yKFwiaW52YWxpZCBrZXkgdHlwZTogXCIgKyB0aGlzLmtleVR5cGUpO1xyXG5cclxuICAgIHJldHVybiBGaWVsZC5wcm90b3R5cGUucmVzb2x2ZS5jYWxsKHRoaXMpO1xyXG59O1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxubW9kdWxlLmV4cG9ydHMgPSBNZXNzYWdlO1xyXG5cclxudmFyIHV0aWwgPSByZXF1aXJlKFwiLi91dGlsXCIpO1xyXG5cclxuLyoqXHJcbiAqIENvbnN0cnVjdHMgYSBuZXcgbWVzc2FnZSBpbnN0YW5jZS5cclxuICpcclxuICogVGhpcyBmdW5jdGlvbiBzaG91bGQgYWxzbyBiZSBjYWxsZWQgZnJvbSB5b3VyIGN1c3RvbSBjb25zdHJ1Y3RvcnMsIGkuZS4gYE1lc3NhZ2UuY2FsbCh0aGlzLCBwcm9wZXJ0aWVzKWAuXHJcbiAqIEBjbGFzc2Rlc2MgQWJzdHJhY3QgcnVudGltZSBtZXNzYWdlLlxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywqPn0gW3Byb3BlcnRpZXNdIFByb3BlcnRpZXMgdG8gc2V0XHJcbiAqIEBzZWUge0BsaW5rIENsYXNzLmNyZWF0ZX1cclxuICovXHJcbmZ1bmN0aW9uIE1lc3NhZ2UocHJvcGVydGllcykge1xyXG4gICAgaWYgKHByb3BlcnRpZXMpXHJcbiAgICAgICAgZm9yICh2YXIga2V5cyA9IE9iamVjdC5rZXlzKHByb3BlcnRpZXMpLCBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyArK2kpXHJcbiAgICAgICAgICAgIHRoaXNba2V5c1tpXV0gPSBwcm9wZXJ0aWVzW2tleXNbaV1dO1xyXG59XHJcblxyXG4vKipcclxuICogUmVmZXJlbmNlIHRvIHRoZSByZWZsZWN0ZWQgdHlwZS5cclxuICogQG5hbWUgTWVzc2FnZS4kdHlwZVxyXG4gKiBAdHlwZSB7VHlwZX1cclxuICogQHJlYWRvbmx5XHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIFJlZmVyZW5jZSB0byB0aGUgcmVmbGVjdGVkIHR5cGUuXHJcbiAqIEBuYW1lIE1lc3NhZ2UjJHR5cGVcclxuICogQHR5cGUge1R5cGV9XHJcbiAqIEByZWFkb25seVxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBFbmNvZGVzIGEgbWVzc2FnZSBvZiB0aGlzIHR5cGUuXHJcbiAqIEBwYXJhbSB7TWVzc2FnZXxPYmplY3R9IG1lc3NhZ2UgTWVzc2FnZSB0byBlbmNvZGVcclxuICogQHBhcmFtIHtXcml0ZXJ9IFt3cml0ZXJdIFdyaXRlciB0byB1c2VcclxuICogQHJldHVybnMge1dyaXRlcn0gV3JpdGVyXHJcbiAqL1xyXG5NZXNzYWdlLmVuY29kZSA9IGZ1bmN0aW9uIGVuY29kZShtZXNzYWdlLCB3cml0ZXIpIHtcclxuICAgIHJldHVybiB0aGlzLiR0eXBlLmVuY29kZShtZXNzYWdlLCB3cml0ZXIpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEVuY29kZXMgYSBtZXNzYWdlIG9mIHRoaXMgdHlwZSBwcmVjZWVkZWQgYnkgaXRzIGxlbmd0aCBhcyBhIHZhcmludC5cclxuICogQHBhcmFtIHtNZXNzYWdlfE9iamVjdH0gbWVzc2FnZSBNZXNzYWdlIHRvIGVuY29kZVxyXG4gKiBAcGFyYW0ge1dyaXRlcn0gW3dyaXRlcl0gV3JpdGVyIHRvIHVzZVxyXG4gKiBAcmV0dXJucyB7V3JpdGVyfSBXcml0ZXJcclxuICovXHJcbk1lc3NhZ2UuZW5jb2RlRGVsaW1pdGVkID0gZnVuY3Rpb24gZW5jb2RlRGVsaW1pdGVkKG1lc3NhZ2UsIHdyaXRlcikge1xyXG4gICAgcmV0dXJuIHRoaXMuJHR5cGUuZW5jb2RlRGVsaW1pdGVkKG1lc3NhZ2UsIHdyaXRlcik7XHJcbn07XHJcblxyXG4vKipcclxuICogRGVjb2RlcyBhIG1lc3NhZ2Ugb2YgdGhpcyB0eXBlLlxyXG4gKiBAbmFtZSBNZXNzYWdlLmRlY29kZVxyXG4gKiBAZnVuY3Rpb25cclxuICogQHBhcmFtIHtSZWFkZXJ8VWludDhBcnJheX0gcmVhZGVyIFJlYWRlciBvciBidWZmZXIgdG8gZGVjb2RlXHJcbiAqIEByZXR1cm5zIHtNZXNzYWdlfSBEZWNvZGVkIG1lc3NhZ2VcclxuICovXHJcbk1lc3NhZ2UuZGVjb2RlID0gZnVuY3Rpb24gZGVjb2RlKHJlYWRlcikge1xyXG4gICAgcmV0dXJuIHRoaXMuJHR5cGUuZGVjb2RlKHJlYWRlcik7XHJcbn07XHJcblxyXG4vKipcclxuICogRGVjb2RlcyBhIG1lc3NhZ2Ugb2YgdGhpcyB0eXBlIHByZWNlZWRlZCBieSBpdHMgbGVuZ3RoIGFzIGEgdmFyaW50LlxyXG4gKiBAbmFtZSBNZXNzYWdlLmRlY29kZURlbGltaXRlZFxyXG4gKiBAZnVuY3Rpb25cclxuICogQHBhcmFtIHtSZWFkZXJ8VWludDhBcnJheX0gcmVhZGVyIFJlYWRlciBvciBidWZmZXIgdG8gZGVjb2RlXHJcbiAqIEByZXR1cm5zIHtNZXNzYWdlfSBEZWNvZGVkIG1lc3NhZ2VcclxuICovXHJcbk1lc3NhZ2UuZGVjb2RlRGVsaW1pdGVkID0gZnVuY3Rpb24gZGVjb2RlRGVsaW1pdGVkKHJlYWRlcikge1xyXG4gICAgcmV0dXJuIHRoaXMuJHR5cGUuZGVjb2RlRGVsaW1pdGVkKHJlYWRlcik7XHJcbn07XHJcblxyXG4vKipcclxuICogVmVyaWZpZXMgYSBtZXNzYWdlIG9mIHRoaXMgdHlwZS5cclxuICogQG5hbWUgTWVzc2FnZS52ZXJpZnlcclxuICogQGZ1bmN0aW9uXHJcbiAqIEBwYXJhbSB7TWVzc2FnZXxPYmplY3R9IG1lc3NhZ2UgTWVzc2FnZSBvciBwbGFpbiBvYmplY3QgdG8gdmVyaWZ5XHJcbiAqIEByZXR1cm5zIHs/c3RyaW5nfSBgbnVsbGAgaWYgdmFsaWQsIG90aGVyd2lzZSB0aGUgcmVhc29uIHdoeSBpdCBpcyBub3RcclxuICovXHJcbk1lc3NhZ2UudmVyaWZ5ID0gZnVuY3Rpb24gdmVyaWZ5KG1lc3NhZ2UpIHtcclxuICAgIHJldHVybiB0aGlzLiR0eXBlLnZlcmlmeShtZXNzYWdlKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDcmVhdGVzIGEgbmV3IG1lc3NhZ2Ugb2YgdGhpcyB0eXBlIGZyb20gYSBwbGFpbiBvYmplY3QuIEFsc28gY29udmVydHMgdmFsdWVzIHRvIHRoZWlyIHJlc3BlY3RpdmUgaW50ZXJuYWwgdHlwZXMuXHJcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsKj59IG9iamVjdCBQbGFpbiBvYmplY3RcclxuICogQHJldHVybnMge01lc3NhZ2V9IE1lc3NhZ2UgaW5zdGFuY2VcclxuICovXHJcbk1lc3NhZ2UuZnJvbU9iamVjdCA9IGZ1bmN0aW9uIGZyb21PYmplY3Qob2JqZWN0KSB7XHJcbiAgICByZXR1cm4gdGhpcy4kdHlwZS5mcm9tT2JqZWN0KG9iamVjdCk7XHJcbn07XHJcblxyXG4vKipcclxuICogQ3JlYXRlcyBhIG5ldyBtZXNzYWdlIG9mIHRoaXMgdHlwZSBmcm9tIGEgcGxhaW4gb2JqZWN0LiBBbHNvIGNvbnZlcnRzIHZhbHVlcyB0byB0aGVpciByZXNwZWN0aXZlIGludGVybmFsIHR5cGVzLlxyXG4gKiBUaGlzIGlzIGFuIGFsaWFzIG9mIHtAbGluayBNZXNzYWdlLmZyb21PYmplY3R9LlxyXG4gKiBAZnVuY3Rpb25cclxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywqPn0gb2JqZWN0IFBsYWluIG9iamVjdFxyXG4gKiBAcmV0dXJucyB7TWVzc2FnZX0gTWVzc2FnZSBpbnN0YW5jZVxyXG4gKi9cclxuTWVzc2FnZS5mcm9tID0gTWVzc2FnZS5mcm9tT2JqZWN0O1xyXG5cclxuLyoqXHJcbiAqIENyZWF0ZXMgYSBwbGFpbiBvYmplY3QgZnJvbSBhIG1lc3NhZ2Ugb2YgdGhpcyB0eXBlLiBBbHNvIGNvbnZlcnRzIHZhbHVlcyB0byBvdGhlciB0eXBlcyBpZiBzcGVjaWZpZWQuXHJcbiAqIEBwYXJhbSB7TWVzc2FnZX0gbWVzc2FnZSBNZXNzYWdlIGluc3RhbmNlXHJcbiAqIEBwYXJhbSB7Q29udmVyc2lvbk9wdGlvbnN9IFtvcHRpb25zXSBDb252ZXJzaW9uIG9wdGlvbnNcclxuICogQHJldHVybnMge09iamVjdC48c3RyaW5nLCo+fSBQbGFpbiBvYmplY3RcclxuICovXHJcbk1lc3NhZ2UudG9PYmplY3QgPSBmdW5jdGlvbiB0b09iamVjdChtZXNzYWdlLCBvcHRpb25zKSB7XHJcbiAgICByZXR1cm4gdGhpcy4kdHlwZS50b09iamVjdChtZXNzYWdlLCBvcHRpb25zKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDcmVhdGVzIGEgcGxhaW4gb2JqZWN0IGZyb20gdGhpcyBtZXNzYWdlLiBBbHNvIGNvbnZlcnRzIHZhbHVlcyB0byBvdGhlciB0eXBlcyBpZiBzcGVjaWZpZWQuXHJcbiAqIEBwYXJhbSB7Q29udmVyc2lvbk9wdGlvbnN9IFtvcHRpb25zXSBDb252ZXJzaW9uIG9wdGlvbnNcclxuICogQHJldHVybnMge09iamVjdC48c3RyaW5nLCo+fSBQbGFpbiBvYmplY3RcclxuICovXHJcbk1lc3NhZ2UucHJvdG90eXBlLnRvT2JqZWN0ID0gZnVuY3Rpb24gdG9PYmplY3Qob3B0aW9ucykge1xyXG4gICAgcmV0dXJuIHRoaXMuJHR5cGUudG9PYmplY3QodGhpcywgb3B0aW9ucyk7XHJcbn07XHJcblxyXG4vKipcclxuICogQ29udmVydHMgdGhpcyBtZXNzYWdlIHRvIEpTT04uXHJcbiAqIEByZXR1cm5zIHtPYmplY3QuPHN0cmluZywqPn0gSlNPTiBvYmplY3RcclxuICovXHJcbk1lc3NhZ2UucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uIHRvSlNPTigpIHtcclxuICAgIHJldHVybiB0aGlzLiR0eXBlLnRvT2JqZWN0KHRoaXMsIHV0aWwudG9KU09OT3B0aW9ucyk7XHJcbn07XHJcbiIsIlwidXNlIHN0cmljdFwiO1xyXG5tb2R1bGUuZXhwb3J0cyA9IE1ldGhvZDtcclxuXHJcbi8vIGV4dGVuZHMgUmVmbGVjdGlvbk9iamVjdFxyXG52YXIgUmVmbGVjdGlvbk9iamVjdCA9IHJlcXVpcmUoXCIuL29iamVjdFwiKTtcclxuKChNZXRob2QucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShSZWZsZWN0aW9uT2JqZWN0LnByb3RvdHlwZSkpLmNvbnN0cnVjdG9yID0gTWV0aG9kKS5jbGFzc05hbWUgPSBcIk1ldGhvZFwiO1xyXG5cclxudmFyIHV0aWwgPSByZXF1aXJlKFwiLi91dGlsXCIpO1xyXG5cclxuLyoqXHJcbiAqIENvbnN0cnVjdHMgYSBuZXcgc2VydmljZSBtZXRob2QgaW5zdGFuY2UuXHJcbiAqIEBjbGFzc2Rlc2MgUmVmbGVjdGVkIHNlcnZpY2UgbWV0aG9kLlxyXG4gKiBAZXh0ZW5kcyBSZWZsZWN0aW9uT2JqZWN0XHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBNZXRob2QgbmFtZVxyXG4gKiBAcGFyYW0ge3N0cmluZ3x1bmRlZmluZWR9IHR5cGUgTWV0aG9kIHR5cGUsIHVzdWFsbHkgYFwicnBjXCJgXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSByZXF1ZXN0VHlwZSBSZXF1ZXN0IG1lc3NhZ2UgdHlwZVxyXG4gKiBAcGFyYW0ge3N0cmluZ30gcmVzcG9uc2VUeXBlIFJlc3BvbnNlIG1lc3NhZ2UgdHlwZVxyXG4gKiBAcGFyYW0ge2Jvb2xlYW58T2JqZWN0LjxzdHJpbmcsKj59IFtyZXF1ZXN0U3RyZWFtXSBXaGV0aGVyIHRoZSByZXF1ZXN0IGlzIHN0cmVhbWVkXHJcbiAqIEBwYXJhbSB7Ym9vbGVhbnxPYmplY3QuPHN0cmluZywqPn0gW3Jlc3BvbnNlU3RyZWFtXSBXaGV0aGVyIHRoZSByZXNwb25zZSBpcyBzdHJlYW1lZFxyXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCo+fSBbb3B0aW9uc10gRGVjbGFyZWQgb3B0aW9uc1xyXG4gKi9cclxuZnVuY3Rpb24gTWV0aG9kKG5hbWUsIHR5cGUsIHJlcXVlc3RUeXBlLCByZXNwb25zZVR5cGUsIHJlcXVlc3RTdHJlYW0sIHJlc3BvbnNlU3RyZWFtLCBvcHRpb25zKSB7XHJcblxyXG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgIGlmICh1dGlsLmlzT2JqZWN0KHJlcXVlc3RTdHJlYW0pKSB7XHJcbiAgICAgICAgb3B0aW9ucyA9IHJlcXVlc3RTdHJlYW07XHJcbiAgICAgICAgcmVxdWVzdFN0cmVhbSA9IHJlc3BvbnNlU3RyZWFtID0gdW5kZWZpbmVkO1xyXG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgIH0gZWxzZSBpZiAodXRpbC5pc09iamVjdChyZXNwb25zZVN0cmVhbSkpIHtcclxuICAgICAgICBvcHRpb25zID0gcmVzcG9uc2VTdHJlYW07XHJcbiAgICAgICAgcmVzcG9uc2VTdHJlYW0gPSB1bmRlZmluZWQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgIGlmICghKHR5cGUgPT09IHVuZGVmaW5lZCB8fCB1dGlsLmlzU3RyaW5nKHR5cGUpKSlcclxuICAgICAgICB0aHJvdyBUeXBlRXJyb3IoXCJ0eXBlIG11c3QgYmUgYSBzdHJpbmdcIik7XHJcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgaWYgKCF1dGlsLmlzU3RyaW5nKHJlcXVlc3RUeXBlKSlcclxuICAgICAgICB0aHJvdyBUeXBlRXJyb3IoXCJyZXF1ZXN0VHlwZSBtdXN0IGJlIGEgc3RyaW5nXCIpO1xyXG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgIGlmICghdXRpbC5pc1N0cmluZyhyZXNwb25zZVR5cGUpKVxyXG4gICAgICAgIHRocm93IFR5cGVFcnJvcihcInJlc3BvbnNlVHlwZSBtdXN0IGJlIGEgc3RyaW5nXCIpO1xyXG5cclxuICAgIFJlZmxlY3Rpb25PYmplY3QuY2FsbCh0aGlzLCBuYW1lLCBvcHRpb25zKTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIE1ldGhvZCB0eXBlLlxyXG4gICAgICogQHR5cGUge3N0cmluZ31cclxuICAgICAqL1xyXG4gICAgdGhpcy50eXBlID0gdHlwZSB8fCBcInJwY1wiOyAvLyB0b0pTT05cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlcXVlc3QgdHlwZS5cclxuICAgICAqIEB0eXBlIHtzdHJpbmd9XHJcbiAgICAgKi9cclxuICAgIHRoaXMucmVxdWVzdFR5cGUgPSByZXF1ZXN0VHlwZTsgLy8gdG9KU09OLCBtYXJrZXJcclxuXHJcbiAgICAvKipcclxuICAgICAqIFdoZXRoZXIgcmVxdWVzdHMgYXJlIHN0cmVhbWVkIG9yIG5vdC5cclxuICAgICAqIEB0eXBlIHtib29sZWFufHVuZGVmaW5lZH1cclxuICAgICAqL1xyXG4gICAgdGhpcy5yZXF1ZXN0U3RyZWFtID0gcmVxdWVzdFN0cmVhbSA/IHRydWUgOiB1bmRlZmluZWQ7IC8vIHRvSlNPTlxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVzcG9uc2UgdHlwZS5cclxuICAgICAqIEB0eXBlIHtzdHJpbmd9XHJcbiAgICAgKi9cclxuICAgIHRoaXMucmVzcG9uc2VUeXBlID0gcmVzcG9uc2VUeXBlOyAvLyB0b0pTT05cclxuXHJcbiAgICAvKipcclxuICAgICAqIFdoZXRoZXIgcmVzcG9uc2VzIGFyZSBzdHJlYW1lZCBvciBub3QuXHJcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbnx1bmRlZmluZWR9XHJcbiAgICAgKi9cclxuICAgIHRoaXMucmVzcG9uc2VTdHJlYW0gPSByZXNwb25zZVN0cmVhbSA/IHRydWUgOiB1bmRlZmluZWQ7IC8vIHRvSlNPTlxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVzb2x2ZWQgcmVxdWVzdCB0eXBlLlxyXG4gICAgICogQHR5cGUgez9UeXBlfVxyXG4gICAgICovXHJcbiAgICB0aGlzLnJlc29sdmVkUmVxdWVzdFR5cGUgPSBudWxsO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVzb2x2ZWQgcmVzcG9uc2UgdHlwZS5cclxuICAgICAqIEB0eXBlIHs/VHlwZX1cclxuICAgICAqL1xyXG4gICAgdGhpcy5yZXNvbHZlZFJlc3BvbnNlVHlwZSA9IG51bGw7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb25zdHJ1Y3RzIGEgc2VydmljZSBtZXRob2QgZnJvbSBKU09OLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBNZXRob2QgbmFtZVxyXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCo+fSBqc29uIEpTT04gb2JqZWN0XHJcbiAqIEByZXR1cm5zIHtNZXRob2R9IENyZWF0ZWQgbWV0aG9kXHJcbiAqIEB0aHJvd3Mge1R5cGVFcnJvcn0gSWYgYXJndW1lbnRzIGFyZSBpbnZhbGlkXHJcbiAqL1xyXG5NZXRob2QuZnJvbUpTT04gPSBmdW5jdGlvbiBmcm9tSlNPTihuYW1lLCBqc29uKSB7XHJcbiAgICByZXR1cm4gbmV3IE1ldGhvZChuYW1lLCBqc29uLnR5cGUsIGpzb24ucmVxdWVzdFR5cGUsIGpzb24ucmVzcG9uc2VUeXBlLCBqc29uLnJlcXVlc3RTdHJlYW0sIGpzb24ucmVzcG9uc2VTdHJlYW0sIGpzb24ub3B0aW9ucyk7XHJcbn07XHJcblxyXG4vKipcclxuICogQG92ZXJyaWRlXHJcbiAqL1xyXG5NZXRob2QucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uIHRvSlNPTigpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgdHlwZSAgICAgICAgICAgOiB0aGlzLnR5cGUgIT09IFwicnBjXCIgJiYgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi8gdGhpcy50eXBlIHx8IHVuZGVmaW5lZCxcclxuICAgICAgICByZXF1ZXN0VHlwZSAgICA6IHRoaXMucmVxdWVzdFR5cGUsXHJcbiAgICAgICAgcmVxdWVzdFN0cmVhbSAgOiB0aGlzLnJlcXVlc3RTdHJlYW0sXHJcbiAgICAgICAgcmVzcG9uc2VUeXBlICAgOiB0aGlzLnJlc3BvbnNlVHlwZSxcclxuICAgICAgICByZXNwb25zZVN0cmVhbSA6IHRoaXMucmVzcG9uc2VTdHJlYW0sXHJcbiAgICAgICAgb3B0aW9ucyAgICAgICAgOiB0aGlzLm9wdGlvbnNcclxuICAgIH07XHJcbn07XHJcblxyXG4vKipcclxuICogQG92ZXJyaWRlXHJcbiAqL1xyXG5NZXRob2QucHJvdG90eXBlLnJlc29sdmUgPSBmdW5jdGlvbiByZXNvbHZlKCkge1xyXG5cclxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xyXG4gICAgaWYgKHRoaXMucmVzb2x2ZWQpXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcblxyXG4gICAgdGhpcy5yZXNvbHZlZFJlcXVlc3RUeXBlID0gdGhpcy5wYXJlbnQubG9va3VwVHlwZSh0aGlzLnJlcXVlc3RUeXBlKTtcclxuICAgIHRoaXMucmVzb2x2ZWRSZXNwb25zZVR5cGUgPSB0aGlzLnBhcmVudC5sb29rdXBUeXBlKHRoaXMucmVzcG9uc2VUeXBlKTtcclxuXHJcbiAgICByZXR1cm4gUmVmbGVjdGlvbk9iamVjdC5wcm90b3R5cGUucmVzb2x2ZS5jYWxsKHRoaXMpO1xyXG59O1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxubW9kdWxlLmV4cG9ydHMgPSBOYW1lc3BhY2U7XHJcblxyXG4vLyBleHRlbmRzIFJlZmxlY3Rpb25PYmplY3RcclxudmFyIFJlZmxlY3Rpb25PYmplY3QgPSByZXF1aXJlKFwiLi9vYmplY3RcIik7XHJcbigoTmFtZXNwYWNlLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoUmVmbGVjdGlvbk9iamVjdC5wcm90b3R5cGUpKS5jb25zdHJ1Y3RvciA9IE5hbWVzcGFjZSkuY2xhc3NOYW1lID0gXCJOYW1lc3BhY2VcIjtcclxuXHJcbnZhciBFbnVtICAgICA9IHJlcXVpcmUoXCIuL2VudW1cIiksXHJcbiAgICBGaWVsZCAgICA9IHJlcXVpcmUoXCIuL2ZpZWxkXCIpLFxyXG4gICAgdXRpbCAgICAgPSByZXF1aXJlKFwiLi91dGlsXCIpO1xyXG5cclxudmFyIFR5cGUsICAgIC8vIGN5Y2xpY1xyXG4gICAgU2VydmljZTsgLy8gXCJcclxuXHJcbi8qKlxyXG4gKiBDb25zdHJ1Y3RzIGEgbmV3IG5hbWVzcGFjZSBpbnN0YW5jZS5cclxuICogQG5hbWUgTmFtZXNwYWNlXHJcbiAqIEBjbGFzc2Rlc2MgUmVmbGVjdGVkIG5hbWVzcGFjZS5cclxuICogQGV4dGVuZHMgTmFtZXNwYWNlQmFzZVxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgTmFtZXNwYWNlIG5hbWVcclxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywqPn0gW29wdGlvbnNdIERlY2xhcmVkIG9wdGlvbnNcclxuICovXHJcblxyXG4vKipcclxuICogQ29uc3RydWN0cyBhIG5hbWVzcGFjZSBmcm9tIEpTT04uXHJcbiAqIEBtZW1iZXJvZiBOYW1lc3BhY2VcclxuICogQGZ1bmN0aW9uXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIE5hbWVzcGFjZSBuYW1lXHJcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsKj59IGpzb24gSlNPTiBvYmplY3RcclxuICogQHJldHVybnMge05hbWVzcGFjZX0gQ3JlYXRlZCBuYW1lc3BhY2VcclxuICogQHRocm93cyB7VHlwZUVycm9yfSBJZiBhcmd1bWVudHMgYXJlIGludmFsaWRcclxuICovXHJcbk5hbWVzcGFjZS5mcm9tSlNPTiA9IGZ1bmN0aW9uIGZyb21KU09OKG5hbWUsIGpzb24pIHtcclxuICAgIHJldHVybiBuZXcgTmFtZXNwYWNlKG5hbWUsIGpzb24ub3B0aW9ucykuYWRkSlNPTihqc29uLm5lc3RlZCk7XHJcbn07XHJcblxyXG4vKipcclxuICogQ29udmVydHMgYW4gYXJyYXkgb2YgcmVmbGVjdGlvbiBvYmplY3RzIHRvIEpTT04uXHJcbiAqIEBtZW1iZXJvZiBOYW1lc3BhY2VcclxuICogQHBhcmFtIHtSZWZsZWN0aW9uT2JqZWN0W119IGFycmF5IE9iamVjdCBhcnJheVxyXG4gKiBAcmV0dXJucyB7T2JqZWN0LjxzdHJpbmcsKj58dW5kZWZpbmVkfSBKU09OIG9iamVjdCBvciBgdW5kZWZpbmVkYCB3aGVuIGFycmF5IGlzIGVtcHR5XHJcbiAqL1xyXG5mdW5jdGlvbiBhcnJheVRvSlNPTihhcnJheSkge1xyXG4gICAgaWYgKCEoYXJyYXkgJiYgYXJyYXkubGVuZ3RoKSlcclxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgdmFyIG9iaiA9IHt9O1xyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7ICsraSlcclxuICAgICAgICBvYmpbYXJyYXlbaV0ubmFtZV0gPSBhcnJheVtpXS50b0pTT04oKTtcclxuICAgIHJldHVybiBvYmo7XHJcbn1cclxuXHJcbk5hbWVzcGFjZS5hcnJheVRvSlNPTiA9IGFycmF5VG9KU09OO1xyXG5cclxuLyoqXHJcbiAqIE5vdCBhbiBhY3R1YWwgY29uc3RydWN0b3IuIFVzZSB7QGxpbmsgTmFtZXNwYWNlfSBpbnN0ZWFkLlxyXG4gKiBAY2xhc3NkZXNjIEJhc2UgY2xhc3Mgb2YgYWxsIHJlZmxlY3Rpb24gb2JqZWN0cyBjb250YWluaW5nIG5lc3RlZCBvYmplY3RzLiBUaGlzIGlzIG5vdCBhbiBhY3R1YWwgY2xhc3MgYnV0IGhlcmUgZm9yIHRoZSBzYWtlIG9mIGhhdmluZyBjb25zaXN0ZW50IHR5cGUgZGVmaW5pdGlvbnMuXHJcbiAqIEBleHBvcnRzIE5hbWVzcGFjZUJhc2VcclxuICogQGV4dGVuZHMgUmVmbGVjdGlvbk9iamVjdFxyXG4gKiBAYWJzdHJhY3RcclxuICogQGNvbnN0cnVjdG9yXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIE5hbWVzcGFjZSBuYW1lXHJcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsKj59IFtvcHRpb25zXSBEZWNsYXJlZCBvcHRpb25zXHJcbiAqIEBzZWUge0BsaW5rIE5hbWVzcGFjZX1cclxuICovXHJcbmZ1bmN0aW9uIE5hbWVzcGFjZShuYW1lLCBvcHRpb25zKSB7XHJcbiAgICBSZWZsZWN0aW9uT2JqZWN0LmNhbGwodGhpcywgbmFtZSwgb3B0aW9ucyk7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBOZXN0ZWQgb2JqZWN0cyBieSBuYW1lLlxyXG4gICAgICogQHR5cGUge09iamVjdC48c3RyaW5nLFJlZmxlY3Rpb25PYmplY3Q+fHVuZGVmaW5lZH1cclxuICAgICAqL1xyXG4gICAgdGhpcy5uZXN0ZWQgPSB1bmRlZmluZWQ7IC8vIHRvSlNPTlxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2FjaGVkIG5lc3RlZCBvYmplY3RzIGFzIGFuIGFycmF5LlxyXG4gICAgICogQHR5cGUgez9SZWZsZWN0aW9uT2JqZWN0W119XHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICovXHJcbiAgICB0aGlzLl9uZXN0ZWRBcnJheSA9IG51bGw7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNsZWFyQ2FjaGUobmFtZXNwYWNlKSB7XHJcbiAgICBuYW1lc3BhY2UuX25lc3RlZEFycmF5ID0gbnVsbDtcclxuICAgIHJldHVybiBuYW1lc3BhY2U7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBOZXN0ZWQgb2JqZWN0cyBvZiB0aGlzIG5hbWVzcGFjZSBhcyBhbiBhcnJheSBmb3IgaXRlcmF0aW9uLlxyXG4gKiBAbmFtZSBOYW1lc3BhY2VCYXNlI25lc3RlZEFycmF5XHJcbiAqIEB0eXBlIHtSZWZsZWN0aW9uT2JqZWN0W119XHJcbiAqIEByZWFkb25seVxyXG4gKi9cclxuT2JqZWN0LmRlZmluZVByb3BlcnR5KE5hbWVzcGFjZS5wcm90b3R5cGUsIFwibmVzdGVkQXJyYXlcIiwge1xyXG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fbmVzdGVkQXJyYXkgfHwgKHRoaXMuX25lc3RlZEFycmF5ID0gdXRpbC50b0FycmF5KHRoaXMubmVzdGVkKSk7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuLyoqXHJcbiAqIEBvdmVycmlkZVxyXG4gKi9cclxuTmFtZXNwYWNlLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbiB0b0pTT04oKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIG9wdGlvbnMgOiB0aGlzLm9wdGlvbnMsXHJcbiAgICAgICAgbmVzdGVkICA6IGFycmF5VG9KU09OKHRoaXMubmVzdGVkQXJyYXkpXHJcbiAgICB9O1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEFkZHMgbmVzdGVkIGVsZW1lbnRzIHRvIHRoaXMgbmFtZXNwYWNlIGZyb20gSlNPTi5cclxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywqPn0gbmVzdGVkSnNvbiBOZXN0ZWQgSlNPTlxyXG4gKiBAcmV0dXJucyB7TmFtZXNwYWNlfSBgdGhpc2BcclxuICovXHJcbk5hbWVzcGFjZS5wcm90b3R5cGUuYWRkSlNPTiA9IGZ1bmN0aW9uIGFkZEpTT04obmVzdGVkSnNvbikge1xyXG4gICAgdmFyIG5zID0gdGhpcztcclxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICovXHJcbiAgICBpZiAobmVzdGVkSnNvbikge1xyXG4gICAgICAgIGZvciAodmFyIG5hbWVzID0gT2JqZWN0LmtleXMobmVzdGVkSnNvbiksIGkgPSAwLCBuZXN0ZWQ7IGkgPCBuYW1lcy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICBuZXN0ZWQgPSBuZXN0ZWRKc29uW25hbWVzW2ldXTtcclxuICAgICAgICAgICAgbnMuYWRkKCAvLyBtb3N0IHRvIGxlYXN0IGxpa2VseVxyXG4gICAgICAgICAgICAgICAgKCBuZXN0ZWQuZmllbGRzICE9PSB1bmRlZmluZWRcclxuICAgICAgICAgICAgICAgID8gVHlwZS5mcm9tSlNPTlxyXG4gICAgICAgICAgICAgICAgOiBuZXN0ZWQudmFsdWVzICE9PSB1bmRlZmluZWRcclxuICAgICAgICAgICAgICAgID8gRW51bS5mcm9tSlNPTlxyXG4gICAgICAgICAgICAgICAgOiBuZXN0ZWQubWV0aG9kcyAhPT0gdW5kZWZpbmVkXHJcbiAgICAgICAgICAgICAgICA/IFNlcnZpY2UuZnJvbUpTT05cclxuICAgICAgICAgICAgICAgIDogbmVzdGVkLmlkICE9PSB1bmRlZmluZWRcclxuICAgICAgICAgICAgICAgID8gRmllbGQuZnJvbUpTT05cclxuICAgICAgICAgICAgICAgIDogTmFtZXNwYWNlLmZyb21KU09OICkobmFtZXNbaV0sIG5lc3RlZClcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcztcclxufTtcclxuXHJcbi8qKlxyXG4gKiBHZXRzIHRoZSBuZXN0ZWQgb2JqZWN0IG9mIHRoZSBzcGVjaWZpZWQgbmFtZS5cclxuICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgTmVzdGVkIG9iamVjdCBuYW1lXHJcbiAqIEByZXR1cm5zIHs/UmVmbGVjdGlvbk9iamVjdH0gVGhlIHJlZmxlY3Rpb24gb2JqZWN0IG9yIGBudWxsYCBpZiBpdCBkb2Vzbid0IGV4aXN0XHJcbiAqL1xyXG5OYW1lc3BhY2UucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIGdldChuYW1lKSB7XHJcbiAgICByZXR1cm4gdGhpcy5uZXN0ZWQgJiYgdGhpcy5uZXN0ZWRbbmFtZV1cclxuICAgICAgICB8fCBudWxsO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEdldHMgdGhlIHZhbHVlcyBvZiB0aGUgbmVzdGVkIHtAbGluayBFbnVtfGVudW19IG9mIHRoZSBzcGVjaWZpZWQgbmFtZS5cclxuICogVGhpcyBtZXRob2RzIGRpZmZlcnMgZnJvbSB7QGxpbmsgTmFtZXNwYWNlI2dldHxnZXR9IGluIHRoYXQgaXQgcmV0dXJucyBhbiBlbnVtJ3MgdmFsdWVzIGRpcmVjdGx5IGFuZCB0aHJvd3MgaW5zdGVhZCBvZiByZXR1cm5pbmcgYG51bGxgLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBOZXN0ZWQgZW51bSBuYW1lXHJcbiAqIEByZXR1cm5zIHtPYmplY3QuPHN0cmluZyxudW1iZXI+fSBFbnVtIHZhbHVlc1xyXG4gKiBAdGhyb3dzIHtFcnJvcn0gSWYgdGhlcmUgaXMgbm8gc3VjaCBlbnVtXHJcbiAqL1xyXG5OYW1lc3BhY2UucHJvdG90eXBlLmdldEVudW0gPSBmdW5jdGlvbiBnZXRFbnVtKG5hbWUpIHtcclxuICAgIGlmICh0aGlzLm5lc3RlZCAmJiB0aGlzLm5lc3RlZFtuYW1lXSBpbnN0YW5jZW9mIEVudW0pXHJcbiAgICAgICAgcmV0dXJuIHRoaXMubmVzdGVkW25hbWVdLnZhbHVlcztcclxuICAgIHRocm93IEVycm9yKFwibm8gc3VjaCBlbnVtXCIpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEFkZHMgYSBuZXN0ZWQgb2JqZWN0IHRvIHRoaXMgbmFtZXNwYWNlLlxyXG4gKiBAcGFyYW0ge1JlZmxlY3Rpb25PYmplY3R9IG9iamVjdCBOZXN0ZWQgb2JqZWN0IHRvIGFkZFxyXG4gKiBAcmV0dXJucyB7TmFtZXNwYWNlfSBgdGhpc2BcclxuICogQHRocm93cyB7VHlwZUVycm9yfSBJZiBhcmd1bWVudHMgYXJlIGludmFsaWRcclxuICogQHRocm93cyB7RXJyb3J9IElmIHRoZXJlIGlzIGFscmVhZHkgYSBuZXN0ZWQgb2JqZWN0IHdpdGggdGhpcyBuYW1lXHJcbiAqL1xyXG5OYW1lc3BhY2UucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uIGFkZChvYmplY3QpIHtcclxuXHJcbiAgICBpZiAoIShvYmplY3QgaW5zdGFuY2VvZiBGaWVsZCAmJiBvYmplY3QuZXh0ZW5kICE9PSB1bmRlZmluZWQgfHwgb2JqZWN0IGluc3RhbmNlb2YgVHlwZSB8fCBvYmplY3QgaW5zdGFuY2VvZiBFbnVtIHx8IG9iamVjdCBpbnN0YW5jZW9mIFNlcnZpY2UgfHwgb2JqZWN0IGluc3RhbmNlb2YgTmFtZXNwYWNlKSlcclxuICAgICAgICB0aHJvdyBUeXBlRXJyb3IoXCJvYmplY3QgbXVzdCBiZSBhIHZhbGlkIG5lc3RlZCBvYmplY3RcIik7XHJcblxyXG4gICAgaWYgKCF0aGlzLm5lc3RlZClcclxuICAgICAgICB0aGlzLm5lc3RlZCA9IHt9O1xyXG4gICAgZWxzZSB7XHJcbiAgICAgICAgdmFyIHByZXYgPSB0aGlzLmdldChvYmplY3QubmFtZSk7XHJcbiAgICAgICAgaWYgKHByZXYpIHtcclxuICAgICAgICAgICAgaWYgKHByZXYgaW5zdGFuY2VvZiBOYW1lc3BhY2UgJiYgb2JqZWN0IGluc3RhbmNlb2YgTmFtZXNwYWNlICYmICEocHJldiBpbnN0YW5jZW9mIFR5cGUgfHwgcHJldiBpbnN0YW5jZW9mIFNlcnZpY2UpKSB7XHJcbiAgICAgICAgICAgICAgICAvLyByZXBsYWNlIHBsYWluIG5hbWVzcGFjZSBidXQga2VlcCBleGlzdGluZyBuZXN0ZWQgZWxlbWVudHMgYW5kIG9wdGlvbnNcclxuICAgICAgICAgICAgICAgIHZhciBuZXN0ZWQgPSBwcmV2Lm5lc3RlZEFycmF5O1xyXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBuZXN0ZWQubGVuZ3RoOyArK2kpXHJcbiAgICAgICAgICAgICAgICAgICAgb2JqZWN0LmFkZChuZXN0ZWRbaV0pO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5yZW1vdmUocHJldik7XHJcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMubmVzdGVkKVxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubmVzdGVkID0ge307XHJcbiAgICAgICAgICAgICAgICBvYmplY3Quc2V0T3B0aW9ucyhwcmV2Lm9wdGlvbnMsIHRydWUpO1xyXG5cclxuICAgICAgICAgICAgfSBlbHNlXHJcbiAgICAgICAgICAgICAgICB0aHJvdyBFcnJvcihcImR1cGxpY2F0ZSBuYW1lICdcIiArIG9iamVjdC5uYW1lICsgXCInIGluIFwiICsgdGhpcyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgdGhpcy5uZXN0ZWRbb2JqZWN0Lm5hbWVdID0gb2JqZWN0O1xyXG4gICAgb2JqZWN0Lm9uQWRkKHRoaXMpO1xyXG4gICAgcmV0dXJuIGNsZWFyQ2FjaGUodGhpcyk7XHJcbn07XHJcblxyXG4vKipcclxuICogUmVtb3ZlcyBhIG5lc3RlZCBvYmplY3QgZnJvbSB0aGlzIG5hbWVzcGFjZS5cclxuICogQHBhcmFtIHtSZWZsZWN0aW9uT2JqZWN0fSBvYmplY3QgTmVzdGVkIG9iamVjdCB0byByZW1vdmVcclxuICogQHJldHVybnMge05hbWVzcGFjZX0gYHRoaXNgXHJcbiAqIEB0aHJvd3Mge1R5cGVFcnJvcn0gSWYgYXJndW1lbnRzIGFyZSBpbnZhbGlkXHJcbiAqIEB0aHJvd3Mge0Vycm9yfSBJZiBgb2JqZWN0YCBpcyBub3QgYSBtZW1iZXIgb2YgdGhpcyBuYW1lc3BhY2VcclxuICovXHJcbk5hbWVzcGFjZS5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24gcmVtb3ZlKG9iamVjdCkge1xyXG5cclxuICAgIGlmICghKG9iamVjdCBpbnN0YW5jZW9mIFJlZmxlY3Rpb25PYmplY3QpKVxyXG4gICAgICAgIHRocm93IFR5cGVFcnJvcihcIm9iamVjdCBtdXN0IGJlIGEgUmVmbGVjdGlvbk9iamVjdFwiKTtcclxuICAgIGlmIChvYmplY3QucGFyZW50ICE9PSB0aGlzKVxyXG4gICAgICAgIHRocm93IEVycm9yKG9iamVjdCArIFwiIGlzIG5vdCBhIG1lbWJlciBvZiBcIiArIHRoaXMpO1xyXG5cclxuICAgIGRlbGV0ZSB0aGlzLm5lc3RlZFtvYmplY3QubmFtZV07XHJcbiAgICBpZiAoIU9iamVjdC5rZXlzKHRoaXMubmVzdGVkKS5sZW5ndGgpXHJcbiAgICAgICAgdGhpcy5uZXN0ZWQgPSB1bmRlZmluZWQ7XHJcblxyXG4gICAgb2JqZWN0Lm9uUmVtb3ZlKHRoaXMpO1xyXG4gICAgcmV0dXJuIGNsZWFyQ2FjaGUodGhpcyk7XHJcbn07XHJcblxyXG4vKipcclxuICogRGVmaW5lcyBhZGRpdGlhbCBuYW1lc3BhY2VzIHdpdGhpbiB0aGlzIG9uZSBpZiBub3QgeWV0IGV4aXN0aW5nLlxyXG4gKiBAcGFyYW0ge3N0cmluZ3xzdHJpbmdbXX0gcGF0aCBQYXRoIHRvIGNyZWF0ZVxyXG4gKiBAcGFyYW0geyp9IFtqc29uXSBOZXN0ZWQgdHlwZXMgdG8gY3JlYXRlIGZyb20gSlNPTlxyXG4gKiBAcmV0dXJucyB7TmFtZXNwYWNlfSBQb2ludGVyIHRvIHRoZSBsYXN0IG5hbWVzcGFjZSBjcmVhdGVkIG9yIGB0aGlzYCBpZiBwYXRoIGlzIGVtcHR5XHJcbiAqL1xyXG5OYW1lc3BhY2UucHJvdG90eXBlLmRlZmluZSA9IGZ1bmN0aW9uIGRlZmluZShwYXRoLCBqc29uKSB7XHJcblxyXG4gICAgaWYgKHV0aWwuaXNTdHJpbmcocGF0aCkpXHJcbiAgICAgICAgcGF0aCA9IHBhdGguc3BsaXQoXCIuXCIpO1xyXG4gICAgZWxzZSBpZiAoIUFycmF5LmlzQXJyYXkocGF0aCkpXHJcbiAgICAgICAgdGhyb3cgVHlwZUVycm9yKFwiaWxsZWdhbCBwYXRoXCIpO1xyXG4gICAgaWYgKHBhdGggJiYgcGF0aC5sZW5ndGggJiYgcGF0aFswXSA9PT0gXCJcIilcclxuICAgICAgICB0aHJvdyBFcnJvcihcInBhdGggbXVzdCBiZSByZWxhdGl2ZVwiKTtcclxuXHJcbiAgICB2YXIgcHRyID0gdGhpcztcclxuICAgIHdoaWxlIChwYXRoLmxlbmd0aCA+IDApIHtcclxuICAgICAgICB2YXIgcGFydCA9IHBhdGguc2hpZnQoKTtcclxuICAgICAgICBpZiAocHRyLm5lc3RlZCAmJiBwdHIubmVzdGVkW3BhcnRdKSB7XHJcbiAgICAgICAgICAgIHB0ciA9IHB0ci5uZXN0ZWRbcGFydF07XHJcbiAgICAgICAgICAgIGlmICghKHB0ciBpbnN0YW5jZW9mIE5hbWVzcGFjZSkpXHJcbiAgICAgICAgICAgICAgICB0aHJvdyBFcnJvcihcInBhdGggY29uZmxpY3RzIHdpdGggbm9uLW5hbWVzcGFjZSBvYmplY3RzXCIpO1xyXG4gICAgICAgIH0gZWxzZVxyXG4gICAgICAgICAgICBwdHIuYWRkKHB0ciA9IG5ldyBOYW1lc3BhY2UocGFydCkpO1xyXG4gICAgfVxyXG4gICAgaWYgKGpzb24pXHJcbiAgICAgICAgcHRyLmFkZEpTT04oanNvbik7XHJcbiAgICByZXR1cm4gcHRyO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJlc29sdmVzIHRoaXMgbmFtZXNwYWNlJ3MgYW5kIGFsbCBpdHMgbmVzdGVkIG9iamVjdHMnIHR5cGUgcmVmZXJlbmNlcy4gVXNlZnVsIHRvIHZhbGlkYXRlIGEgcmVmbGVjdGlvbiB0cmVlLCBidXQgY29tZXMgYXQgYSBjb3N0LlxyXG4gKiBAcmV0dXJucyB7TmFtZXNwYWNlfSBgdGhpc2BcclxuICovXHJcbk5hbWVzcGFjZS5wcm90b3R5cGUucmVzb2x2ZUFsbCA9IGZ1bmN0aW9uIHJlc29sdmVBbGwoKSB7XHJcbiAgICB2YXIgbmVzdGVkID0gdGhpcy5uZXN0ZWRBcnJheSwgaSA9IDA7XHJcbiAgICB3aGlsZSAoaSA8IG5lc3RlZC5sZW5ndGgpXHJcbiAgICAgICAgaWYgKG5lc3RlZFtpXSBpbnN0YW5jZW9mIE5hbWVzcGFjZSlcclxuICAgICAgICAgICAgbmVzdGVkW2krK10ucmVzb2x2ZUFsbCgpO1xyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgICAgbmVzdGVkW2krK10ucmVzb2x2ZSgpO1xyXG4gICAgcmV0dXJuIHRoaXMucmVzb2x2ZSgpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIExvb2tzIHVwIHRoZSByZWZsZWN0aW9uIG9iamVjdCBhdCB0aGUgc3BlY2lmaWVkIHBhdGgsIHJlbGF0aXZlIHRvIHRoaXMgbmFtZXNwYWNlLlxyXG4gKiBAcGFyYW0ge3N0cmluZ3xzdHJpbmdbXX0gcGF0aCBQYXRoIHRvIGxvb2sgdXBcclxuICogQHBhcmFtIHtmdW5jdGlvbihuZXc6IFJlZmxlY3Rpb25PYmplY3QpfSBmaWx0ZXJUeXBlIEZpbHRlciB0eXBlLCBvbmUgb2YgYHByb3RvYnVmLlR5cGVgLCBgcHJvdG9idWYuRW51bWAsIGBwcm90b2J1Zi5TZXJ2aWNlYCBldGMuXHJcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW3BhcmVudEFscmVhZHlDaGVja2VkPWZhbHNlXSBJZiBrbm93biwgd2hldGhlciB0aGUgcGFyZW50IGhhcyBhbHJlYWR5IGJlZW4gY2hlY2tlZFxyXG4gKiBAcmV0dXJucyB7P1JlZmxlY3Rpb25PYmplY3R9IExvb2tlZCB1cCBvYmplY3Qgb3IgYG51bGxgIGlmIG5vbmUgY291bGQgYmUgZm91bmRcclxuICovXHJcbk5hbWVzcGFjZS5wcm90b3R5cGUubG9va3VwID0gZnVuY3Rpb24gbG9va3VwKHBhdGgsIGZpbHRlclR5cGUsIHBhcmVudEFscmVhZHlDaGVja2VkKSB7XHJcblxyXG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgIGlmICh0eXBlb2YgZmlsdGVyVHlwZSA9PT0gXCJib29sZWFuXCIpIHtcclxuICAgICAgICBwYXJlbnRBbHJlYWR5Q2hlY2tlZCA9IGZpbHRlclR5cGU7XHJcbiAgICAgICAgZmlsdGVyVHlwZSA9IHVuZGVmaW5lZDtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodXRpbC5pc1N0cmluZyhwYXRoKSAmJiBwYXRoLmxlbmd0aCkge1xyXG4gICAgICAgIGlmIChwYXRoID09PSBcIi5cIilcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMucm9vdDtcclxuICAgICAgICBwYXRoID0gcGF0aC5zcGxpdChcIi5cIik7XHJcbiAgICB9IGVsc2UgaWYgKCFwYXRoLmxlbmd0aClcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuXHJcbiAgICAvLyBTdGFydCBhdCByb290IGlmIHBhdGggaXMgYWJzb2x1dGVcclxuICAgIGlmIChwYXRoWzBdID09PSBcIlwiKVxyXG4gICAgICAgIHJldHVybiB0aGlzLnJvb3QubG9va3VwKHBhdGguc2xpY2UoMSksIGZpbHRlclR5cGUpO1xyXG4gICAgLy8gVGVzdCBpZiB0aGUgZmlyc3QgcGFydCBtYXRjaGVzIGFueSBuZXN0ZWQgb2JqZWN0LCBhbmQgaWYgc28sIHRyYXZlcnNlIGlmIHBhdGggY29udGFpbnMgbW9yZVxyXG4gICAgdmFyIGZvdW5kID0gdGhpcy5nZXQocGF0aFswXSk7XHJcbiAgICBpZiAoZm91bmQpIHtcclxuICAgICAgICBpZiAocGF0aC5sZW5ndGggPT09IDEpIHtcclxuICAgICAgICAgICAgaWYgKCFmaWx0ZXJUeXBlIHx8IGZvdW5kIGluc3RhbmNlb2YgZmlsdGVyVHlwZSlcclxuICAgICAgICAgICAgICAgIHJldHVybiBmb3VuZDtcclxuICAgICAgICB9IGVsc2UgaWYgKGZvdW5kIGluc3RhbmNlb2YgTmFtZXNwYWNlICYmIChmb3VuZCA9IGZvdW5kLmxvb2t1cChwYXRoLnNsaWNlKDEpLCBmaWx0ZXJUeXBlLCB0cnVlKSkpXHJcbiAgICAgICAgICAgIHJldHVybiBmb3VuZDtcclxuICAgIH1cclxuICAgIC8vIElmIHRoZXJlIGhhc24ndCBiZWVuIGEgbWF0Y2gsIHRyeSBhZ2FpbiBhdCB0aGUgcGFyZW50XHJcbiAgICBpZiAodGhpcy5wYXJlbnQgPT09IG51bGwgfHwgcGFyZW50QWxyZWFkeUNoZWNrZWQpXHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICByZXR1cm4gdGhpcy5wYXJlbnQubG9va3VwKHBhdGgsIGZpbHRlclR5cGUpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIExvb2tzIHVwIHRoZSByZWZsZWN0aW9uIG9iamVjdCBhdCB0aGUgc3BlY2lmaWVkIHBhdGgsIHJlbGF0aXZlIHRvIHRoaXMgbmFtZXNwYWNlLlxyXG4gKiBAbmFtZSBOYW1lc3BhY2VCYXNlI2xvb2t1cFxyXG4gKiBAZnVuY3Rpb25cclxuICogQHBhcmFtIHtzdHJpbmd8c3RyaW5nW119IHBhdGggUGF0aCB0byBsb29rIHVwXHJcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW3BhcmVudEFscmVhZHlDaGVja2VkPWZhbHNlXSBXaGV0aGVyIHRoZSBwYXJlbnQgaGFzIGFscmVhZHkgYmVlbiBjaGVja2VkXHJcbiAqIEByZXR1cm5zIHs/UmVmbGVjdGlvbk9iamVjdH0gTG9va2VkIHVwIG9iamVjdCBvciBgbnVsbGAgaWYgbm9uZSBjb3VsZCBiZSBmb3VuZFxyXG4gKiBAdmFyaWF0aW9uIDJcclxuICovXHJcbi8vIGxvb2t1cChwYXRoOiBzdHJpbmcsIFtwYXJlbnRBbHJlYWR5Q2hlY2tlZDogYm9vbGVhbl0pXHJcblxyXG4vKipcclxuICogTG9va3MgdXAgdGhlIHtAbGluayBUeXBlfHR5cGV9IGF0IHRoZSBzcGVjaWZpZWQgcGF0aCwgcmVsYXRpdmUgdG8gdGhpcyBuYW1lc3BhY2UuXHJcbiAqIEJlc2lkZXMgaXRzIHNpZ25hdHVyZSwgdGhpcyBtZXRob2RzIGRpZmZlcnMgZnJvbSB7QGxpbmsgTmFtZXNwYWNlI2xvb2t1cHxsb29rdXB9IGluIHRoYXQgaXQgdGhyb3dzIGluc3RlYWQgb2YgcmV0dXJuaW5nIGBudWxsYC5cclxuICogQHBhcmFtIHtzdHJpbmd8c3RyaW5nW119IHBhdGggUGF0aCB0byBsb29rIHVwXHJcbiAqIEByZXR1cm5zIHtUeXBlfSBMb29rZWQgdXAgdHlwZVxyXG4gKiBAdGhyb3dzIHtFcnJvcn0gSWYgYHBhdGhgIGRvZXMgbm90IHBvaW50IHRvIGEgdHlwZVxyXG4gKi9cclxuTmFtZXNwYWNlLnByb3RvdHlwZS5sb29rdXBUeXBlID0gZnVuY3Rpb24gbG9va3VwVHlwZShwYXRoKSB7XHJcbiAgICB2YXIgZm91bmQgPSB0aGlzLmxvb2t1cChwYXRoLCBUeXBlKTtcclxuICAgIGlmICghZm91bmQpXHJcbiAgICAgICAgdGhyb3cgRXJyb3IoXCJubyBzdWNoIHR5cGVcIik7XHJcbiAgICByZXR1cm4gZm91bmQ7XHJcbn07XHJcblxyXG4vKipcclxuICogTG9va3MgdXAgdGhlIHtAbGluayBTZXJ2aWNlfHNlcnZpY2V9IGF0IHRoZSBzcGVjaWZpZWQgcGF0aCwgcmVsYXRpdmUgdG8gdGhpcyBuYW1lc3BhY2UuXHJcbiAqIEJlc2lkZXMgaXRzIHNpZ25hdHVyZSwgdGhpcyBtZXRob2RzIGRpZmZlcnMgZnJvbSB7QGxpbmsgTmFtZXNwYWNlI2xvb2t1cHxsb29rdXB9IGluIHRoYXQgaXQgdGhyb3dzIGluc3RlYWQgb2YgcmV0dXJuaW5nIGBudWxsYC5cclxuICogQHBhcmFtIHtzdHJpbmd8c3RyaW5nW119IHBhdGggUGF0aCB0byBsb29rIHVwXHJcbiAqIEByZXR1cm5zIHtTZXJ2aWNlfSBMb29rZWQgdXAgc2VydmljZVxyXG4gKiBAdGhyb3dzIHtFcnJvcn0gSWYgYHBhdGhgIGRvZXMgbm90IHBvaW50IHRvIGEgc2VydmljZVxyXG4gKi9cclxuTmFtZXNwYWNlLnByb3RvdHlwZS5sb29rdXBTZXJ2aWNlID0gZnVuY3Rpb24gbG9va3VwU2VydmljZShwYXRoKSB7XHJcbiAgICB2YXIgZm91bmQgPSB0aGlzLmxvb2t1cChwYXRoLCBTZXJ2aWNlKTtcclxuICAgIGlmICghZm91bmQpXHJcbiAgICAgICAgdGhyb3cgRXJyb3IoXCJubyBzdWNoIHNlcnZpY2VcIik7XHJcbiAgICByZXR1cm4gZm91bmQ7XHJcbn07XHJcblxyXG4vKipcclxuICogTG9va3MgdXAgdGhlIHZhbHVlcyBvZiB0aGUge0BsaW5rIEVudW18ZW51bX0gYXQgdGhlIHNwZWNpZmllZCBwYXRoLCByZWxhdGl2ZSB0byB0aGlzIG5hbWVzcGFjZS5cclxuICogQmVzaWRlcyBpdHMgc2lnbmF0dXJlLCB0aGlzIG1ldGhvZHMgZGlmZmVycyBmcm9tIHtAbGluayBOYW1lc3BhY2UjbG9va3VwfGxvb2t1cH0gaW4gdGhhdCBpdCByZXR1cm5zIHRoZSBlbnVtJ3MgdmFsdWVzIGRpcmVjdGx5IGFuZCB0aHJvd3MgaW5zdGVhZCBvZiByZXR1cm5pbmcgYG51bGxgLlxyXG4gKiBAcGFyYW0ge3N0cmluZ3xzdHJpbmdbXX0gcGF0aCBQYXRoIHRvIGxvb2sgdXBcclxuICogQHJldHVybnMge09iamVjdC48c3RyaW5nLG51bWJlcj59IEVudW0gdmFsdWVzXHJcbiAqIEB0aHJvd3Mge0Vycm9yfSBJZiBgcGF0aGAgZG9lcyBub3QgcG9pbnQgdG8gYW4gZW51bVxyXG4gKi9cclxuTmFtZXNwYWNlLnByb3RvdHlwZS5sb29rdXBFbnVtID0gZnVuY3Rpb24gbG9va3VwRW51bShwYXRoKSB7XHJcbiAgICB2YXIgZm91bmQgPSB0aGlzLmxvb2t1cChwYXRoLCBFbnVtKTtcclxuICAgIGlmICghZm91bmQpXHJcbiAgICAgICAgdGhyb3cgRXJyb3IoXCJubyBzdWNoIGVudW1cIik7XHJcbiAgICByZXR1cm4gZm91bmQudmFsdWVzO1xyXG59O1xyXG5cclxuTmFtZXNwYWNlLl9jb25maWd1cmUgPSBmdW5jdGlvbihUeXBlXywgU2VydmljZV8pIHtcclxuICAgIFR5cGUgICAgPSBUeXBlXztcclxuICAgIFNlcnZpY2UgPSBTZXJ2aWNlXztcclxufTtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbm1vZHVsZS5leHBvcnRzID0gUmVmbGVjdGlvbk9iamVjdDtcclxuXHJcblJlZmxlY3Rpb25PYmplY3QuY2xhc3NOYW1lID0gXCJSZWZsZWN0aW9uT2JqZWN0XCI7XHJcblxyXG52YXIgdXRpbCA9IHJlcXVpcmUoXCIuL3V0aWxcIik7XHJcblxyXG52YXIgUm9vdDsgLy8gY3ljbGljXHJcblxyXG4vKipcclxuICogQ29uc3RydWN0cyBhIG5ldyByZWZsZWN0aW9uIG9iamVjdCBpbnN0YW5jZS5cclxuICogQGNsYXNzZGVzYyBCYXNlIGNsYXNzIG9mIGFsbCByZWZsZWN0aW9uIG9iamVjdHMuXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBPYmplY3QgbmFtZVxyXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCo+fSBbb3B0aW9uc10gRGVjbGFyZWQgb3B0aW9uc1xyXG4gKiBAYWJzdHJhY3RcclxuICovXHJcbmZ1bmN0aW9uIFJlZmxlY3Rpb25PYmplY3QobmFtZSwgb3B0aW9ucykge1xyXG5cclxuICAgIGlmICghdXRpbC5pc1N0cmluZyhuYW1lKSlcclxuICAgICAgICB0aHJvdyBUeXBlRXJyb3IoXCJuYW1lIG11c3QgYmUgYSBzdHJpbmdcIik7XHJcblxyXG4gICAgaWYgKG9wdGlvbnMgJiYgIXV0aWwuaXNPYmplY3Qob3B0aW9ucykpXHJcbiAgICAgICAgdGhyb3cgVHlwZUVycm9yKFwib3B0aW9ucyBtdXN0IGJlIGFuIG9iamVjdFwiKTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIE9wdGlvbnMuXHJcbiAgICAgKiBAdHlwZSB7T2JqZWN0LjxzdHJpbmcsKj58dW5kZWZpbmVkfVxyXG4gICAgICovXHJcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zOyAvLyB0b0pTT05cclxuXHJcbiAgICAvKipcclxuICAgICAqIFVuaXF1ZSBuYW1lIHdpdGhpbiBpdHMgbmFtZXNwYWNlLlxyXG4gICAgICogQHR5cGUge3N0cmluZ31cclxuICAgICAqL1xyXG4gICAgdGhpcy5uYW1lID0gbmFtZTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFBhcmVudCBuYW1lc3BhY2UuXHJcbiAgICAgKiBAdHlwZSB7P05hbWVzcGFjZX1cclxuICAgICAqL1xyXG4gICAgdGhpcy5wYXJlbnQgPSBudWxsO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogV2hldGhlciBhbHJlYWR5IHJlc29sdmVkIG9yIG5vdC5cclxuICAgICAqIEB0eXBlIHtib29sZWFufVxyXG4gICAgICovXHJcbiAgICB0aGlzLnJlc29sdmVkID0gZmFsc2U7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDb21tZW50IHRleHQsIGlmIGFueS5cclxuICAgICAqIEB0eXBlIHs/c3RyaW5nfVxyXG4gICAgICovXHJcbiAgICB0aGlzLmNvbW1lbnQgPSBudWxsO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogRGVmaW5pbmcgZmlsZSBuYW1lLlxyXG4gICAgICogQHR5cGUgez9zdHJpbmd9XHJcbiAgICAgKi9cclxuICAgIHRoaXMuZmlsZW5hbWUgPSBudWxsO1xyXG59XHJcblxyXG5PYmplY3QuZGVmaW5lUHJvcGVydGllcyhSZWZsZWN0aW9uT2JqZWN0LnByb3RvdHlwZSwge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVmZXJlbmNlIHRvIHRoZSByb290IG5hbWVzcGFjZS5cclxuICAgICAqIEBuYW1lIFJlZmxlY3Rpb25PYmplY3Qjcm9vdFxyXG4gICAgICogQHR5cGUge1Jvb3R9XHJcbiAgICAgKiBAcmVhZG9ubHlcclxuICAgICAqL1xyXG4gICAgcm9vdDoge1xyXG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHZhciBwdHIgPSB0aGlzO1xyXG4gICAgICAgICAgICB3aGlsZSAocHRyLnBhcmVudCAhPT0gbnVsbClcclxuICAgICAgICAgICAgICAgIHB0ciA9IHB0ci5wYXJlbnQ7XHJcbiAgICAgICAgICAgIHJldHVybiBwdHI7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEZ1bGwgbmFtZSBpbmNsdWRpbmcgbGVhZGluZyBkb3QuXHJcbiAgICAgKiBAbmFtZSBSZWZsZWN0aW9uT2JqZWN0I2Z1bGxOYW1lXHJcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxyXG4gICAgICogQHJlYWRvbmx5XHJcbiAgICAgKi9cclxuICAgIGZ1bGxOYW1lOiB7XHJcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgdmFyIHBhdGggPSBbIHRoaXMubmFtZSBdLFxyXG4gICAgICAgICAgICAgICAgcHRyID0gdGhpcy5wYXJlbnQ7XHJcbiAgICAgICAgICAgIHdoaWxlIChwdHIpIHtcclxuICAgICAgICAgICAgICAgIHBhdGgudW5zaGlmdChwdHIubmFtZSk7XHJcbiAgICAgICAgICAgICAgICBwdHIgPSBwdHIucGFyZW50O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBwYXRoLmpvaW4oXCIuXCIpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufSk7XHJcblxyXG4vKipcclxuICogQ29udmVydHMgdGhpcyByZWZsZWN0aW9uIG9iamVjdCB0byBpdHMgSlNPTiByZXByZXNlbnRhdGlvbi5cclxuICogQHJldHVybnMge09iamVjdC48c3RyaW5nLCo+fSBKU09OIG9iamVjdFxyXG4gKiBAYWJzdHJhY3RcclxuICovXHJcblJlZmxlY3Rpb25PYmplY3QucHJvdG90eXBlLnRvSlNPTiA9IC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovIGZ1bmN0aW9uIHRvSlNPTigpIHtcclxuICAgIHRocm93IEVycm9yKCk7IC8vIG5vdCBpbXBsZW1lbnRlZCwgc2hvdWxkbid0IGhhcHBlblxyXG59O1xyXG5cclxuLyoqXHJcbiAqIENhbGxlZCB3aGVuIHRoaXMgb2JqZWN0IGlzIGFkZGVkIHRvIGEgcGFyZW50LlxyXG4gKiBAcGFyYW0ge1JlZmxlY3Rpb25PYmplY3R9IHBhcmVudCBQYXJlbnQgYWRkZWQgdG9cclxuICogQHJldHVybnMge3VuZGVmaW5lZH1cclxuICovXHJcblJlZmxlY3Rpb25PYmplY3QucHJvdG90eXBlLm9uQWRkID0gZnVuY3Rpb24gb25BZGQocGFyZW50KSB7XHJcbiAgICBpZiAodGhpcy5wYXJlbnQgJiYgdGhpcy5wYXJlbnQgIT09IHBhcmVudClcclxuICAgICAgICB0aGlzLnBhcmVudC5yZW1vdmUodGhpcyk7XHJcbiAgICB0aGlzLnBhcmVudCA9IHBhcmVudDtcclxuICAgIHRoaXMucmVzb2x2ZWQgPSBmYWxzZTtcclxuICAgIHZhciByb290ID0gcGFyZW50LnJvb3Q7XHJcbiAgICBpZiAocm9vdCBpbnN0YW5jZW9mIFJvb3QpXHJcbiAgICAgICAgcm9vdC5faGFuZGxlQWRkKHRoaXMpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENhbGxlZCB3aGVuIHRoaXMgb2JqZWN0IGlzIHJlbW92ZWQgZnJvbSBhIHBhcmVudC5cclxuICogQHBhcmFtIHtSZWZsZWN0aW9uT2JqZWN0fSBwYXJlbnQgUGFyZW50IHJlbW92ZWQgZnJvbVxyXG4gKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxyXG4gKi9cclxuUmVmbGVjdGlvbk9iamVjdC5wcm90b3R5cGUub25SZW1vdmUgPSBmdW5jdGlvbiBvblJlbW92ZShwYXJlbnQpIHtcclxuICAgIHZhciByb290ID0gcGFyZW50LnJvb3Q7XHJcbiAgICBpZiAocm9vdCBpbnN0YW5jZW9mIFJvb3QpXHJcbiAgICAgICAgcm9vdC5faGFuZGxlUmVtb3ZlKHRoaXMpO1xyXG4gICAgdGhpcy5wYXJlbnQgPSBudWxsO1xyXG4gICAgdGhpcy5yZXNvbHZlZCA9IGZhbHNlO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJlc29sdmVzIHRoaXMgb2JqZWN0cyB0eXBlIHJlZmVyZW5jZXMuXHJcbiAqIEByZXR1cm5zIHtSZWZsZWN0aW9uT2JqZWN0fSBgdGhpc2BcclxuICovXHJcblJlZmxlY3Rpb25PYmplY3QucHJvdG90eXBlLnJlc29sdmUgPSBmdW5jdGlvbiByZXNvbHZlKCkge1xyXG4gICAgaWYgKHRoaXMucmVzb2x2ZWQpXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICBpZiAodGhpcy5yb290IGluc3RhbmNlb2YgUm9vdClcclxuICAgICAgICB0aGlzLnJlc29sdmVkID0gdHJ1ZTsgLy8gb25seSBpZiBwYXJ0IG9mIGEgcm9vdFxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG4vKipcclxuICogR2V0cyBhbiBvcHRpb24gdmFsdWUuXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIE9wdGlvbiBuYW1lXHJcbiAqIEByZXR1cm5zIHsqfSBPcHRpb24gdmFsdWUgb3IgYHVuZGVmaW5lZGAgaWYgbm90IHNldFxyXG4gKi9cclxuUmVmbGVjdGlvbk9iamVjdC5wcm90b3R5cGUuZ2V0T3B0aW9uID0gZnVuY3Rpb24gZ2V0T3B0aW9uKG5hbWUpIHtcclxuICAgIGlmICh0aGlzLm9wdGlvbnMpXHJcbiAgICAgICAgcmV0dXJuIHRoaXMub3B0aW9uc1tuYW1lXTtcclxuICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbn07XHJcblxyXG4vKipcclxuICogU2V0cyBhbiBvcHRpb24uXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIE9wdGlvbiBuYW1lXHJcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgT3B0aW9uIHZhbHVlXHJcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW2lmTm90U2V0XSBTZXRzIHRoZSBvcHRpb24gb25seSBpZiBpdCBpc24ndCBjdXJyZW50bHkgc2V0XHJcbiAqIEByZXR1cm5zIHtSZWZsZWN0aW9uT2JqZWN0fSBgdGhpc2BcclxuICovXHJcblJlZmxlY3Rpb25PYmplY3QucHJvdG90eXBlLnNldE9wdGlvbiA9IGZ1bmN0aW9uIHNldE9wdGlvbihuYW1lLCB2YWx1ZSwgaWZOb3RTZXQpIHtcclxuICAgIGlmICghaWZOb3RTZXQgfHwgIXRoaXMub3B0aW9ucyB8fCB0aGlzLm9wdGlvbnNbbmFtZV0gPT09IHVuZGVmaW5lZClcclxuICAgICAgICAodGhpcy5vcHRpb25zIHx8ICh0aGlzLm9wdGlvbnMgPSB7fSkpW25hbWVdID0gdmFsdWU7XHJcbiAgICByZXR1cm4gdGhpcztcclxufTtcclxuXHJcbi8qKlxyXG4gKiBTZXRzIG11bHRpcGxlIG9wdGlvbnMuXHJcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsKj59IG9wdGlvbnMgT3B0aW9ucyB0byBzZXRcclxuICogQHBhcmFtIHtib29sZWFufSBbaWZOb3RTZXRdIFNldHMgYW4gb3B0aW9uIG9ubHkgaWYgaXQgaXNuJ3QgY3VycmVudGx5IHNldFxyXG4gKiBAcmV0dXJucyB7UmVmbGVjdGlvbk9iamVjdH0gYHRoaXNgXHJcbiAqL1xyXG5SZWZsZWN0aW9uT2JqZWN0LnByb3RvdHlwZS5zZXRPcHRpb25zID0gZnVuY3Rpb24gc2V0T3B0aW9ucyhvcHRpb25zLCBpZk5vdFNldCkge1xyXG4gICAgaWYgKG9wdGlvbnMpXHJcbiAgICAgICAgZm9yICh2YXIga2V5cyA9IE9iamVjdC5rZXlzKG9wdGlvbnMpLCBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyArK2kpXHJcbiAgICAgICAgICAgIHRoaXMuc2V0T3B0aW9uKGtleXNbaV0sIG9wdGlvbnNba2V5c1tpXV0sIGlmTm90U2V0KTtcclxuICAgIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENvbnZlcnRzIHRoaXMgaW5zdGFuY2UgdG8gaXRzIHN0cmluZyByZXByZXNlbnRhdGlvbi5cclxuICogQHJldHVybnMge3N0cmluZ30gQ2xhc3MgbmFtZVssIHNwYWNlLCBmdWxsIG5hbWVdXHJcbiAqL1xyXG5SZWZsZWN0aW9uT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIHRvU3RyaW5nKCkge1xyXG4gICAgdmFyIGNsYXNzTmFtZSA9IHRoaXMuY29uc3RydWN0b3IuY2xhc3NOYW1lLFxyXG4gICAgICAgIGZ1bGxOYW1lICA9IHRoaXMuZnVsbE5hbWU7XHJcbiAgICBpZiAoZnVsbE5hbWUubGVuZ3RoKVxyXG4gICAgICAgIHJldHVybiBjbGFzc05hbWUgKyBcIiBcIiArIGZ1bGxOYW1lO1xyXG4gICAgcmV0dXJuIGNsYXNzTmFtZTtcclxufTtcclxuXHJcblJlZmxlY3Rpb25PYmplY3QuX2NvbmZpZ3VyZSA9IGZ1bmN0aW9uKFJvb3RfKSB7XHJcbiAgICBSb290ID0gUm9vdF87XHJcbn07XHJcbiIsIlwidXNlIHN0cmljdFwiO1xyXG5tb2R1bGUuZXhwb3J0cyA9IE9uZU9mO1xyXG5cclxuLy8gZXh0ZW5kcyBSZWZsZWN0aW9uT2JqZWN0XHJcbnZhciBSZWZsZWN0aW9uT2JqZWN0ID0gcmVxdWlyZShcIi4vb2JqZWN0XCIpO1xyXG4oKE9uZU9mLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoUmVmbGVjdGlvbk9iamVjdC5wcm90b3R5cGUpKS5jb25zdHJ1Y3RvciA9IE9uZU9mKS5jbGFzc05hbWUgPSBcIk9uZU9mXCI7XHJcblxyXG52YXIgRmllbGQgPSByZXF1aXJlKFwiLi9maWVsZFwiKTtcclxuXHJcbi8qKlxyXG4gKiBDb25zdHJ1Y3RzIGEgbmV3IG9uZW9mIGluc3RhbmNlLlxyXG4gKiBAY2xhc3NkZXNjIFJlZmxlY3RlZCBvbmVvZi5cclxuICogQGV4dGVuZHMgUmVmbGVjdGlvbk9iamVjdFxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgT25lb2YgbmFtZVxyXG4gKiBAcGFyYW0ge3N0cmluZ1tdfE9iamVjdH0gW2ZpZWxkTmFtZXNdIEZpZWxkIG5hbWVzXHJcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsKj59IFtvcHRpb25zXSBEZWNsYXJlZCBvcHRpb25zXHJcbiAqL1xyXG5mdW5jdGlvbiBPbmVPZihuYW1lLCBmaWVsZE5hbWVzLCBvcHRpb25zKSB7XHJcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoZmllbGROYW1lcykpIHtcclxuICAgICAgICBvcHRpb25zID0gZmllbGROYW1lcztcclxuICAgICAgICBmaWVsZE5hbWVzID0gdW5kZWZpbmVkO1xyXG4gICAgfVxyXG4gICAgUmVmbGVjdGlvbk9iamVjdC5jYWxsKHRoaXMsIG5hbWUsIG9wdGlvbnMpO1xyXG5cclxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICBpZiAoIShmaWVsZE5hbWVzID09PSB1bmRlZmluZWQgfHwgQXJyYXkuaXNBcnJheShmaWVsZE5hbWVzKSkpXHJcbiAgICAgICAgdGhyb3cgVHlwZUVycm9yKFwiZmllbGROYW1lcyBtdXN0IGJlIGFuIEFycmF5XCIpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogRmllbGQgbmFtZXMgdGhhdCBiZWxvbmcgdG8gdGhpcyBvbmVvZi5cclxuICAgICAqIEB0eXBlIHtzdHJpbmdbXX1cclxuICAgICAqL1xyXG4gICAgdGhpcy5vbmVvZiA9IGZpZWxkTmFtZXMgfHwgW107IC8vIHRvSlNPTiwgbWFya2VyXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGaWVsZHMgdGhhdCBiZWxvbmcgdG8gdGhpcyBvbmVvZiBhcyBhbiBhcnJheSBmb3IgaXRlcmF0aW9uLlxyXG4gICAgICogQHR5cGUge0ZpZWxkW119XHJcbiAgICAgKiBAcmVhZG9ubHlcclxuICAgICAqL1xyXG4gICAgdGhpcy5maWVsZHNBcnJheSA9IFtdOyAvLyBkZWNsYXJlZCByZWFkb25seSBmb3IgY29uZm9ybWFuY2UsIHBvc3NpYmx5IG5vdCB5ZXQgYWRkZWQgdG8gcGFyZW50XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb25zdHJ1Y3RzIGEgb25lb2YgZnJvbSBKU09OLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBPbmVvZiBuYW1lXHJcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsKj59IGpzb24gSlNPTiBvYmplY3RcclxuICogQHJldHVybnMge01hcEZpZWxkfSBDcmVhdGVkIG9uZW9mXHJcbiAqIEB0aHJvd3Mge1R5cGVFcnJvcn0gSWYgYXJndW1lbnRzIGFyZSBpbnZhbGlkXHJcbiAqL1xyXG5PbmVPZi5mcm9tSlNPTiA9IGZ1bmN0aW9uIGZyb21KU09OKG5hbWUsIGpzb24pIHtcclxuICAgIHJldHVybiBuZXcgT25lT2YobmFtZSwganNvbi5vbmVvZiwganNvbi5vcHRpb25zKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBAb3ZlcnJpZGVcclxuICovXHJcbk9uZU9mLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbiB0b0pTT04oKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIG9uZW9mICAgOiB0aGlzLm9uZW9mLFxyXG4gICAgICAgIG9wdGlvbnMgOiB0aGlzLm9wdGlvbnNcclxuICAgIH07XHJcbn07XHJcblxyXG4vKipcclxuICogQWRkcyB0aGUgZmllbGRzIG9mIHRoZSBzcGVjaWZpZWQgb25lb2YgdG8gdGhlIHBhcmVudCBpZiBub3QgYWxyZWFkeSBkb25lIHNvLlxyXG4gKiBAcGFyYW0ge09uZU9mfSBvbmVvZiBUaGUgb25lb2ZcclxuICogQHJldHVybnMge3VuZGVmaW5lZH1cclxuICogQGlubmVyXHJcbiAqIEBpZ25vcmVcclxuICovXHJcbmZ1bmN0aW9uIGFkZEZpZWxkc1RvUGFyZW50KG9uZW9mKSB7XHJcbiAgICBpZiAob25lb2YucGFyZW50KVxyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb25lb2YuZmllbGRzQXJyYXkubGVuZ3RoOyArK2kpXHJcbiAgICAgICAgICAgIGlmICghb25lb2YuZmllbGRzQXJyYXlbaV0ucGFyZW50KVxyXG4gICAgICAgICAgICAgICAgb25lb2YucGFyZW50LmFkZChvbmVvZi5maWVsZHNBcnJheVtpXSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBZGRzIGEgZmllbGQgdG8gdGhpcyBvbmVvZiBhbmQgcmVtb3ZlcyBpdCBmcm9tIGl0cyBjdXJyZW50IHBhcmVudCwgaWYgYW55LlxyXG4gKiBAcGFyYW0ge0ZpZWxkfSBmaWVsZCBGaWVsZCB0byBhZGRcclxuICogQHJldHVybnMge09uZU9mfSBgdGhpc2BcclxuICovXHJcbk9uZU9mLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiBhZGQoZmllbGQpIHtcclxuXHJcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgaWYgKCEoZmllbGQgaW5zdGFuY2VvZiBGaWVsZCkpXHJcbiAgICAgICAgdGhyb3cgVHlwZUVycm9yKFwiZmllbGQgbXVzdCBiZSBhIEZpZWxkXCIpO1xyXG4gICAgaWYgKGZpZWxkLnBhcmVudCAmJiBmaWVsZC5wYXJlbnQgIT09IHRoaXMucGFyZW50KVxyXG4gICAgICAgIGZpZWxkLnBhcmVudC5yZW1vdmUoZmllbGQpO1xyXG4gICAgdGhpcy5vbmVvZi5wdXNoKGZpZWxkLm5hbWUpO1xyXG4gICAgdGhpcy5maWVsZHNBcnJheS5wdXNoKGZpZWxkKTtcclxuICAgIGZpZWxkLnBhcnRPZiA9IHRoaXM7IC8vIGZpZWxkLnBhcmVudCByZW1haW5zIG51bGxcclxuICAgIGFkZEZpZWxkc1RvUGFyZW50KHRoaXMpO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG4vKipcclxuICogUmVtb3ZlcyBhIGZpZWxkIGZyb20gdGhpcyBvbmVvZiBhbmQgcHV0cyBpdCBiYWNrIHRvIHRoZSBvbmVvZidzIHBhcmVudC5cclxuICogQHBhcmFtIHtGaWVsZH0gZmllbGQgRmllbGQgdG8gcmVtb3ZlXHJcbiAqIEByZXR1cm5zIHtPbmVPZn0gYHRoaXNgXHJcbiAqL1xyXG5PbmVPZi5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24gcmVtb3ZlKGZpZWxkKSB7XHJcblxyXG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgIGlmICghKGZpZWxkIGluc3RhbmNlb2YgRmllbGQpKVxyXG4gICAgICAgIHRocm93IFR5cGVFcnJvcihcImZpZWxkIG11c3QgYmUgYSBGaWVsZFwiKTtcclxuXHJcbiAgICB2YXIgaW5kZXggPSB0aGlzLmZpZWxkc0FycmF5LmluZGV4T2YoZmllbGQpO1xyXG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgIGlmIChpbmRleCA8IDApXHJcbiAgICAgICAgdGhyb3cgRXJyb3IoZmllbGQgKyBcIiBpcyBub3QgYSBtZW1iZXIgb2YgXCIgKyB0aGlzKTtcclxuXHJcbiAgICB0aGlzLmZpZWxkc0FycmF5LnNwbGljZShpbmRleCwgMSk7XHJcbiAgICBpbmRleCA9IHRoaXMub25lb2YuaW5kZXhPZihmaWVsZC5uYW1lKTtcclxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICovXHJcbiAgICBpZiAoaW5kZXggPiAtMSkgLy8gdGhlb3JldGljYWxcclxuICAgICAgICB0aGlzLm9uZW9mLnNwbGljZShpbmRleCwgMSk7XHJcbiAgICBmaWVsZC5wYXJ0T2YgPSBudWxsO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG4vKipcclxuICogQG92ZXJyaWRlXHJcbiAqL1xyXG5PbmVPZi5wcm90b3R5cGUub25BZGQgPSBmdW5jdGlvbiBvbkFkZChwYXJlbnQpIHtcclxuICAgIFJlZmxlY3Rpb25PYmplY3QucHJvdG90eXBlLm9uQWRkLmNhbGwodGhpcywgcGFyZW50KTtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuICAgIC8vIENvbGxlY3QgcHJlc2VudCBmaWVsZHNcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5vbmVvZi5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgIHZhciBmaWVsZCA9IHBhcmVudC5nZXQodGhpcy5vbmVvZltpXSk7XHJcbiAgICAgICAgaWYgKGZpZWxkICYmICFmaWVsZC5wYXJ0T2YpIHtcclxuICAgICAgICAgICAgZmllbGQucGFydE9mID0gc2VsZjtcclxuICAgICAgICAgICAgc2VsZi5maWVsZHNBcnJheS5wdXNoKGZpZWxkKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICAvLyBBZGQgbm90IHlldCBwcmVzZW50IGZpZWxkc1xyXG4gICAgYWRkRmllbGRzVG9QYXJlbnQodGhpcyk7XHJcbn07XHJcblxyXG4vKipcclxuICogQG92ZXJyaWRlXHJcbiAqL1xyXG5PbmVPZi5wcm90b3R5cGUub25SZW1vdmUgPSBmdW5jdGlvbiBvblJlbW92ZShwYXJlbnQpIHtcclxuICAgIGZvciAodmFyIGkgPSAwLCBmaWVsZDsgaSA8IHRoaXMuZmllbGRzQXJyYXkubGVuZ3RoOyArK2kpXHJcbiAgICAgICAgaWYgKChmaWVsZCA9IHRoaXMuZmllbGRzQXJyYXlbaV0pLnBhcmVudClcclxuICAgICAgICAgICAgZmllbGQucGFyZW50LnJlbW92ZShmaWVsZCk7XHJcbiAgICBSZWZsZWN0aW9uT2JqZWN0LnByb3RvdHlwZS5vblJlbW92ZS5jYWxsKHRoaXMsIHBhcmVudCk7XHJcbn07XHJcbiIsIlwidXNlIHN0cmljdFwiO1xyXG5tb2R1bGUuZXhwb3J0cyA9IHBhcnNlO1xyXG5cclxucGFyc2UuZmlsZW5hbWUgPSBudWxsO1xyXG5wYXJzZS5kZWZhdWx0cyA9IHsga2VlcENhc2U6IGZhbHNlIH07XHJcblxyXG52YXIgdG9rZW5pemUgID0gcmVxdWlyZShcIi4vdG9rZW5pemVcIiksXHJcbiAgICBSb290ICAgICAgPSByZXF1aXJlKFwiLi9yb290XCIpLFxyXG4gICAgVHlwZSAgICAgID0gcmVxdWlyZShcIi4vdHlwZVwiKSxcclxuICAgIEZpZWxkICAgICA9IHJlcXVpcmUoXCIuL2ZpZWxkXCIpLFxyXG4gICAgTWFwRmllbGQgID0gcmVxdWlyZShcIi4vbWFwZmllbGRcIiksXHJcbiAgICBPbmVPZiAgICAgPSByZXF1aXJlKFwiLi9vbmVvZlwiKSxcclxuICAgIEVudW0gICAgICA9IHJlcXVpcmUoXCIuL2VudW1cIiksXHJcbiAgICBTZXJ2aWNlICAgPSByZXF1aXJlKFwiLi9zZXJ2aWNlXCIpLFxyXG4gICAgTWV0aG9kICAgID0gcmVxdWlyZShcIi4vbWV0aG9kXCIpLFxyXG4gICAgdHlwZXMgICAgID0gcmVxdWlyZShcIi4vdHlwZXNcIiksXHJcbiAgICB1dGlsICAgICAgPSByZXF1aXJlKFwiLi91dGlsXCIpO1xyXG5cclxuZnVuY3Rpb24gaXNOYW1lKHRva2VuKSB7XHJcbiAgICByZXR1cm4gL15bYS16QS1aX11bYS16QS1aXzAtOV0qJC8udGVzdCh0b2tlbik7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGlzVHlwZVJlZih0b2tlbikge1xyXG4gICAgcmV0dXJuIC9eKD86XFwuP1thLXpBLVpfXVthLXpBLVpfMC05XSopKyQvLnRlc3QodG9rZW4pO1xyXG59XHJcblxyXG5mdW5jdGlvbiBpc0ZxVHlwZVJlZih0b2tlbikge1xyXG4gICAgcmV0dXJuIC9eKD86XFwuW2EtekEtWl1bYS16QS1aXzAtOV0qKSskLy50ZXN0KHRva2VuKTtcclxufVxyXG5cclxuZnVuY3Rpb24gbG93ZXIodG9rZW4pIHtcclxuICAgIHJldHVybiB0b2tlbiA9PT0gbnVsbCA/IG51bGwgOiB0b2tlbi50b0xvd2VyQ2FzZSgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBjYW1lbENhc2Uoc3RyKSB7XHJcbiAgICByZXR1cm4gc3RyLnN1YnN0cmluZygwLDEpXHJcbiAgICAgICAgICsgc3RyLnN1YnN0cmluZygxKVxyXG4gICAgICAgICAgICAgICAucmVwbGFjZSgvXyhbYS16XSkoPz1bYS16XXwkKS9nLCBmdW5jdGlvbigkMCwgJDEpIHsgcmV0dXJuICQxLnRvVXBwZXJDYXNlKCk7IH0pO1xyXG59XHJcblxyXG4vKipcclxuICogUmVzdWx0IG9iamVjdCByZXR1cm5lZCBmcm9tIHtAbGluayBwYXJzZX0uXHJcbiAqIEB0eXBlZGVmIFBhcnNlclJlc3VsdFxyXG4gKiBAdHlwZSB7T2JqZWN0LjxzdHJpbmcsKj59XHJcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfHVuZGVmaW5lZH0gcGFja2FnZSBQYWNrYWdlIG5hbWUsIGlmIGRlY2xhcmVkXHJcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nW118dW5kZWZpbmVkfSBpbXBvcnRzIEltcG9ydHMsIGlmIGFueVxyXG4gKiBAcHJvcGVydHkge3N0cmluZ1tdfHVuZGVmaW5lZH0gd2Vha0ltcG9ydHMgV2VhayBpbXBvcnRzLCBpZiBhbnlcclxuICogQHByb3BlcnR5IHtzdHJpbmd8dW5kZWZpbmVkfSBzeW50YXggU3ludGF4LCBpZiBzcGVjaWZpZWQgKGVpdGhlciBgXCJwcm90bzJcImAgb3IgYFwicHJvdG8zXCJgKVxyXG4gKiBAcHJvcGVydHkge1Jvb3R9IHJvb3QgUG9wdWxhdGVkIHJvb3QgaW5zdGFuY2VcclxuICovXHJcblxyXG4vKipcclxuICogT3B0aW9ucyBtb2RpZnlpbmcgdGhlIGJlaGF2aW9yIG9mIHtAbGluayBwYXJzZX0uXHJcbiAqIEB0eXBlZGVmIFBhcnNlT3B0aW9uc1xyXG4gKiBAdHlwZSB7T2JqZWN0LjxzdHJpbmcsKj59XHJcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gW2tlZXBDYXNlPWZhbHNlXSBLZWVwcyBmaWVsZCBjYXNpbmcgaW5zdGVhZCBvZiBjb252ZXJ0aW5nIHRvIGNhbWVsIGNhc2VcclxuICovXHJcblxyXG4vKipcclxuICogUGFyc2VzIHRoZSBnaXZlbiAucHJvdG8gc291cmNlIGFuZCByZXR1cm5zIGFuIG9iamVjdCB3aXRoIHRoZSBwYXJzZWQgY29udGVudHMuXHJcbiAqIEBmdW5jdGlvblxyXG4gKiBAcGFyYW0ge3N0cmluZ30gc291cmNlIFNvdXJjZSBjb250ZW50c1xyXG4gKiBAcGFyYW0ge1Jvb3R9IHJvb3QgUm9vdCB0byBwb3B1bGF0ZVxyXG4gKiBAcGFyYW0ge1BhcnNlT3B0aW9uc30gW29wdGlvbnNdIFBhcnNlIG9wdGlvbnMuIERlZmF1bHRzIHRvIHtAbGluayBwYXJzZS5kZWZhdWx0c30gd2hlbiBvbWl0dGVkLlxyXG4gKiBAcmV0dXJucyB7UGFyc2VyUmVzdWx0fSBQYXJzZXIgcmVzdWx0XHJcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBmaWxlbmFtZT1udWxsIEN1cnJlbnRseSBwcm9jZXNzaW5nIGZpbGUgbmFtZSBmb3IgZXJyb3IgcmVwb3J0aW5nLCBpZiBrbm93blxyXG4gKiBAcHJvcGVydHkge1BhcnNlT3B0aW9uc30gZGVmYXVsdHMgRGVmYXVsdCB7QGxpbmsgUGFyc2VPcHRpb25zfVxyXG4gKi9cclxuZnVuY3Rpb24gcGFyc2Uoc291cmNlLCByb290LCBvcHRpb25zKSB7XHJcbiAgICAvKiBlc2xpbnQtZGlzYWJsZSBjYWxsYmFjay1yZXR1cm4gKi9cclxuICAgIGlmICghKHJvb3QgaW5zdGFuY2VvZiBSb290KSkge1xyXG4gICAgICAgIG9wdGlvbnMgPSByb290O1xyXG4gICAgICAgIHJvb3QgPSBuZXcgUm9vdCgpO1xyXG4gICAgfVxyXG4gICAgaWYgKCFvcHRpb25zKVxyXG4gICAgICAgIG9wdGlvbnMgPSBwYXJzZS5kZWZhdWx0cztcclxuXHJcbiAgICB2YXIgdG4gPSB0b2tlbml6ZShzb3VyY2UpLFxyXG4gICAgICAgIG5leHQgPSB0bi5uZXh0LFxyXG4gICAgICAgIHB1c2ggPSB0bi5wdXNoLFxyXG4gICAgICAgIHBlZWsgPSB0bi5wZWVrLFxyXG4gICAgICAgIHNraXAgPSB0bi5za2lwLFxyXG4gICAgICAgIGNtbnQgPSB0bi5jbW50O1xyXG5cclxuICAgIHZhciBoZWFkID0gdHJ1ZSxcclxuICAgICAgICBwa2csXHJcbiAgICAgICAgaW1wb3J0cyxcclxuICAgICAgICB3ZWFrSW1wb3J0cyxcclxuICAgICAgICBzeW50YXgsXHJcbiAgICAgICAgaXNQcm90bzMgPSBmYWxzZTtcclxuXHJcbiAgICB2YXIgcHRyID0gcm9vdDtcclxuXHJcbiAgICB2YXIgYXBwbHlDYXNlID0gb3B0aW9ucy5rZWVwQ2FzZSA/IGZ1bmN0aW9uKG5hbWUpIHsgcmV0dXJuIG5hbWU7IH0gOiBjYW1lbENhc2U7XHJcblxyXG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgIGZ1bmN0aW9uIGlsbGVnYWwodG9rZW4sIG5hbWUsIGluc2lkZVRyeUNhdGNoKSB7XHJcbiAgICAgICAgdmFyIGZpbGVuYW1lID0gcGFyc2UuZmlsZW5hbWU7XHJcbiAgICAgICAgaWYgKCFpbnNpZGVUcnlDYXRjaClcclxuICAgICAgICAgICAgcGFyc2UuZmlsZW5hbWUgPSBudWxsO1xyXG4gICAgICAgIHJldHVybiBFcnJvcihcImlsbGVnYWwgXCIgKyAobmFtZSB8fCBcInRva2VuXCIpICsgXCIgJ1wiICsgdG9rZW4gKyBcIicgKFwiICsgKGZpbGVuYW1lID8gZmlsZW5hbWUgKyBcIiwgXCIgOiBcIlwiKSArIFwibGluZSBcIiArIHRuLmxpbmUoKSArIFwiKVwiKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiByZWFkU3RyaW5nKCkge1xyXG4gICAgICAgIHZhciB2YWx1ZXMgPSBbXSxcclxuICAgICAgICAgICAgdG9rZW47XHJcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgICAgICBkbyB7XHJcbiAgICAgICAgICAgIGlmICgodG9rZW4gPSBuZXh0KCkpICE9PSBcIlxcXCJcIiAmJiB0b2tlbiAhPT0gXCInXCIpXHJcbiAgICAgICAgICAgICAgICB0aHJvdyBpbGxlZ2FsKHRva2VuKTtcclxuICAgICAgICAgICAgdmFsdWVzLnB1c2gobmV4dCgpKTtcclxuICAgICAgICAgICAgc2tpcCh0b2tlbik7XHJcbiAgICAgICAgICAgIHRva2VuID0gcGVlaygpO1xyXG4gICAgICAgIH0gd2hpbGUgKHRva2VuID09PSBcIlxcXCJcIiB8fCB0b2tlbiA9PT0gXCInXCIpO1xyXG4gICAgICAgIHJldHVybiB2YWx1ZXMuam9pbihcIlwiKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiByZWFkVmFsdWUoYWNjZXB0VHlwZVJlZikge1xyXG4gICAgICAgIHZhciB0b2tlbiA9IG5leHQoKTtcclxuICAgICAgICBzd2l0Y2ggKGxvd2VyKHRva2VuKSkge1xyXG4gICAgICAgICAgICBjYXNlIFwiJ1wiOlxyXG4gICAgICAgICAgICBjYXNlIFwiXFxcIlwiOlxyXG4gICAgICAgICAgICAgICAgcHVzaCh0b2tlbik7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVhZFN0cmluZygpO1xyXG4gICAgICAgICAgICBjYXNlIFwidHJ1ZVwiOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIGNhc2UgXCJmYWxzZVwiOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICByZXR1cm4gcGFyc2VOdW1iZXIodG9rZW4sIC8qIGluc2lkZVRyeUNhdGNoICovIHRydWUpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIGVsc2UgKi9cclxuICAgICAgICAgICAgaWYgKGFjY2VwdFR5cGVSZWYgJiYgaXNUeXBlUmVmKHRva2VuKSlcclxuICAgICAgICAgICAgICAgIHJldHVybiB0b2tlbjtcclxuICAgICAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgICAgICAgICAgdGhyb3cgaWxsZWdhbCh0b2tlbiwgXCJ2YWx1ZVwiKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gcmVhZFJhbmdlcyh0YXJnZXQsIGFjY2VwdFN0cmluZ3MpIHtcclxuICAgICAgICB2YXIgdG9rZW4sIHN0YXJ0O1xyXG4gICAgICAgIGRvIHtcclxuICAgICAgICAgICAgaWYgKGFjY2VwdFN0cmluZ3MgJiYgKCh0b2tlbiA9IHBlZWsoKSkgPT09IFwiXFxcIlwiIHx8IHRva2VuID09PSBcIidcIikpXHJcbiAgICAgICAgICAgICAgICB0YXJnZXQucHVzaChyZWFkU3RyaW5nKCkpO1xyXG4gICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgICB0YXJnZXQucHVzaChbIHN0YXJ0ID0gcGFyc2VJZChuZXh0KCkpLCBza2lwKFwidG9cIiwgdHJ1ZSkgPyBwYXJzZUlkKG5leHQoKSkgOiBzdGFydCBdKTtcclxuICAgICAgICB9IHdoaWxlIChza2lwKFwiLFwiLCB0cnVlKSk7XHJcbiAgICAgICAgc2tpcChcIjtcIik7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gcGFyc2VOdW1iZXIodG9rZW4sIGluc2lkZVRyeUNhdGNoKSB7XHJcbiAgICAgICAgdmFyIHNpZ24gPSAxO1xyXG4gICAgICAgIGlmICh0b2tlbi5jaGFyQXQoMCkgPT09IFwiLVwiKSB7XHJcbiAgICAgICAgICAgIHNpZ24gPSAtMTtcclxuICAgICAgICAgICAgdG9rZW4gPSB0b2tlbi5zdWJzdHJpbmcoMSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciB0b2tlbkxvd2VyID0gbG93ZXIodG9rZW4pO1xyXG4gICAgICAgIHN3aXRjaCAodG9rZW5Mb3dlcikge1xyXG4gICAgICAgICAgICBjYXNlIFwiaW5mXCI6IHJldHVybiBzaWduICogSW5maW5pdHk7XHJcbiAgICAgICAgICAgIGNhc2UgXCJuYW5cIjogcmV0dXJuIE5hTjtcclxuICAgICAgICAgICAgY2FzZSBcIjBcIjogcmV0dXJuIDA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICgvXlsxLTldWzAtOV0qJC8udGVzdCh0b2tlbikpXHJcbiAgICAgICAgICAgIHJldHVybiBzaWduICogcGFyc2VJbnQodG9rZW4sIDEwKTtcclxuICAgICAgICBpZiAoL14wW3hdWzAtOWEtZl0rJC8udGVzdCh0b2tlbkxvd2VyKSlcclxuICAgICAgICAgICAgcmV0dXJuIHNpZ24gKiBwYXJzZUludCh0b2tlbiwgMTYpO1xyXG4gICAgICAgIGlmICgvXjBbMC03XSskLy50ZXN0KHRva2VuKSlcclxuICAgICAgICAgICAgcmV0dXJuIHNpZ24gKiBwYXJzZUludCh0b2tlbiwgOCk7XHJcbiAgICAgICAgaWYgKC9eKD8hZSlbMC05XSooPzpcXC5bMC05XSopPyg/OltlXVsrLV0/WzAtOV0rKT8kLy50ZXN0KHRva2VuTG93ZXIpKVxyXG4gICAgICAgICAgICByZXR1cm4gc2lnbiAqIHBhcnNlRmxvYXQodG9rZW4pO1xyXG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICAgICAgdGhyb3cgaWxsZWdhbCh0b2tlbiwgXCJudW1iZXJcIiwgaW5zaWRlVHJ5Q2F0Y2gpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHBhcnNlSWQodG9rZW4sIGFjY2VwdE5lZ2F0aXZlKSB7XHJcbiAgICAgICAgdmFyIHRva2VuTG93ZXIgPSBsb3dlcih0b2tlbik7XHJcbiAgICAgICAgc3dpdGNoICh0b2tlbkxvd2VyKSB7XHJcbiAgICAgICAgICAgIGNhc2UgXCJtYXhcIjogcmV0dXJuIDUzNjg3MDkxMTtcclxuICAgICAgICAgICAgY2FzZSBcIjBcIjogcmV0dXJuIDA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICAgICAgaWYgKHRva2VuLmNoYXJBdCgwKSA9PT0gXCItXCIgJiYgIWFjY2VwdE5lZ2F0aXZlKVxyXG4gICAgICAgICAgICB0aHJvdyBpbGxlZ2FsKHRva2VuLCBcImlkXCIpO1xyXG4gICAgICAgIGlmICgvXi0/WzEtOV1bMC05XSokLy50ZXN0KHRva2VuKSlcclxuICAgICAgICAgICAgcmV0dXJuIHBhcnNlSW50KHRva2VuLCAxMCk7XHJcbiAgICAgICAgaWYgKC9eLT8wW3hdWzAtOWEtZl0rJC8udGVzdCh0b2tlbkxvd2VyKSlcclxuICAgICAgICAgICAgcmV0dXJuIHBhcnNlSW50KHRva2VuLCAxNik7XHJcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIGVsc2UgKi9cclxuICAgICAgICBpZiAoL14tPzBbMC03XSskLy50ZXN0KHRva2VuKSlcclxuICAgICAgICAgICAgcmV0dXJuIHBhcnNlSW50KHRva2VuLCA4KTtcclxuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgICAgIHRocm93IGlsbGVnYWwodG9rZW4sIFwiaWRcIik7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gcGFyc2VQYWNrYWdlKCkge1xyXG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICAgICAgaWYgKHBrZyAhPT0gdW5kZWZpbmVkKVxyXG4gICAgICAgICAgICB0aHJvdyBpbGxlZ2FsKFwicGFja2FnZVwiKTtcclxuICAgICAgICBwa2cgPSBuZXh0KCk7XHJcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgICAgICBpZiAoIWlzVHlwZVJlZihwa2cpKVxyXG4gICAgICAgICAgICB0aHJvdyBpbGxlZ2FsKHBrZywgXCJuYW1lXCIpO1xyXG4gICAgICAgIHB0ciA9IHB0ci5kZWZpbmUocGtnKTtcclxuICAgICAgICBza2lwKFwiO1wiKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBwYXJzZUltcG9ydCgpIHtcclxuICAgICAgICB2YXIgdG9rZW4gPSBwZWVrKCk7XHJcbiAgICAgICAgdmFyIHdoaWNoSW1wb3J0cztcclxuICAgICAgICBzd2l0Y2ggKHRva2VuKSB7XHJcbiAgICAgICAgICAgIGNhc2UgXCJ3ZWFrXCI6XHJcbiAgICAgICAgICAgICAgICB3aGljaEltcG9ydHMgPSB3ZWFrSW1wb3J0cyB8fCAod2Vha0ltcG9ydHMgPSBbXSk7XHJcbiAgICAgICAgICAgICAgICBuZXh0KCk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBcInB1YmxpY1wiOlxyXG4gICAgICAgICAgICAgICAgbmV4dCgpO1xyXG4gICAgICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1mYWxsdGhyb3VnaFxyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgd2hpY2hJbXBvcnRzID0gaW1wb3J0cyB8fCAoaW1wb3J0cyA9IFtdKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0b2tlbiA9IHJlYWRTdHJpbmcoKTtcclxuICAgICAgICBza2lwKFwiO1wiKTtcclxuICAgICAgICB3aGljaEltcG9ydHMucHVzaCh0b2tlbik7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gcGFyc2VTeW50YXgoKSB7XHJcbiAgICAgICAgc2tpcChcIj1cIik7XHJcbiAgICAgICAgc3ludGF4ID0gbG93ZXIocmVhZFN0cmluZygpKTtcclxuICAgICAgICBpc1Byb3RvMyA9IHN5bnRheCA9PT0gXCJwcm90bzNcIjtcclxuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgICAgIGlmICghaXNQcm90bzMgJiYgc3ludGF4ICE9PSBcInByb3RvMlwiKVxyXG4gICAgICAgICAgICB0aHJvdyBpbGxlZ2FsKHN5bnRheCwgXCJzeW50YXhcIik7XHJcbiAgICAgICAgc2tpcChcIjtcIik7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gcGFyc2VDb21tb24ocGFyZW50LCB0b2tlbikge1xyXG4gICAgICAgIHN3aXRjaCAodG9rZW4pIHtcclxuXHJcbiAgICAgICAgICAgIGNhc2UgXCJvcHRpb25cIjpcclxuICAgICAgICAgICAgICAgIHBhcnNlT3B0aW9uKHBhcmVudCwgdG9rZW4pO1xyXG4gICAgICAgICAgICAgICAgc2tpcChcIjtcIik7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuXHJcbiAgICAgICAgICAgIGNhc2UgXCJtZXNzYWdlXCI6XHJcbiAgICAgICAgICAgICAgICBwYXJzZVR5cGUocGFyZW50LCB0b2tlbik7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuXHJcbiAgICAgICAgICAgIGNhc2UgXCJlbnVtXCI6XHJcbiAgICAgICAgICAgICAgICBwYXJzZUVudW0ocGFyZW50LCB0b2tlbik7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuXHJcbiAgICAgICAgICAgIGNhc2UgXCJzZXJ2aWNlXCI6XHJcbiAgICAgICAgICAgICAgICBwYXJzZVNlcnZpY2UocGFyZW50LCB0b2tlbik7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuXHJcbiAgICAgICAgICAgIGNhc2UgXCJleHRlbmRcIjpcclxuICAgICAgICAgICAgICAgIHBhcnNlRXh0ZW5zaW9uKHBhcmVudCwgdG9rZW4pO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBwYXJzZVR5cGUocGFyZW50LCB0b2tlbikge1xyXG4gICAgICAgIHZhciBuYW1lID0gbmV4dCgpO1xyXG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICAgICAgaWYgKCFpc05hbWUobmFtZSkpXHJcbiAgICAgICAgICAgIHRocm93IGlsbGVnYWwobmFtZSwgXCJ0eXBlIG5hbWVcIik7XHJcbiAgICAgICAgdmFyIHR5cGUgPSBuZXcgVHlwZShuYW1lKTtcclxuICAgICAgICB0eXBlLmNvbW1lbnQgPSBjbW50KCk7XHJcbiAgICAgICAgdHlwZS5maWxlbmFtZSA9IHBhcnNlLmZpbGVuYW1lO1xyXG4gICAgICAgIGlmIChza2lwKFwie1wiLCB0cnVlKSkge1xyXG4gICAgICAgICAgICB3aGlsZSAoKHRva2VuID0gbmV4dCgpKSAhPT0gXCJ9XCIpIHtcclxuICAgICAgICAgICAgICAgIHZhciB0b2tlbkxvd2VyID0gbG93ZXIodG9rZW4pO1xyXG4gICAgICAgICAgICAgICAgaWYgKHBhcnNlQ29tbW9uKHR5cGUsIHRva2VuKSlcclxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIHN3aXRjaCAodG9rZW5Mb3dlcikge1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBjYXNlIFwibWFwXCI6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnNlTWFwRmllbGQodHlwZSwgdG9rZW5Mb3dlcik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBjYXNlIFwicmVxdWlyZWRcIjpcclxuICAgICAgICAgICAgICAgICAgICBjYXNlIFwib3B0aW9uYWxcIjpcclxuICAgICAgICAgICAgICAgICAgICBjYXNlIFwicmVwZWF0ZWRcIjpcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGFyc2VGaWVsZCh0eXBlLCB0b2tlbkxvd2VyKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJvbmVvZlwiOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJzZU9uZU9mKHR5cGUsIHRva2VuTG93ZXIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcImV4dGVuc2lvbnNcIjpcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVhZFJhbmdlcyh0eXBlLmV4dGVuc2lvbnMgfHwgKHR5cGUuZXh0ZW5zaW9ucyA9IFtdKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBjYXNlIFwicmVzZXJ2ZWRcIjpcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVhZFJhbmdlcyh0eXBlLnJlc2VydmVkIHx8ICh0eXBlLnJlc2VydmVkID0gW10pLCB0cnVlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghaXNQcm90bzMgfHwgIWlzVHlwZVJlZih0b2tlbikpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBpbGxlZ2FsKHRva2VuKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHVzaCh0b2tlbik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnNlRmllbGQodHlwZSwgXCJvcHRpb25hbFwiKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgc2tpcChcIjtcIiwgdHJ1ZSk7XHJcbiAgICAgICAgfSBlbHNlXHJcbiAgICAgICAgICAgIHNraXAoXCI7XCIpO1xyXG4gICAgICAgIHBhcmVudC5hZGQodHlwZSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gcGFyc2VGaWVsZChwYXJlbnQsIHJ1bGUsIGV4dGVuZCkge1xyXG4gICAgICAgIHZhciB0eXBlID0gbmV4dCgpO1xyXG4gICAgICAgIGlmICh0eXBlID09PSBcImdyb3VwXCIpIHtcclxuICAgICAgICAgICAgcGFyc2VHcm91cChwYXJlbnQsIHJ1bGUpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICAgICAgaWYgKCFpc1R5cGVSZWYodHlwZSkpXHJcbiAgICAgICAgICAgIHRocm93IGlsbGVnYWwodHlwZSwgXCJ0eXBlXCIpO1xyXG4gICAgICAgIHZhciBuYW1lID0gbmV4dCgpO1xyXG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICAgICAgaWYgKCFpc05hbWUobmFtZSkpXHJcbiAgICAgICAgICAgIHRocm93IGlsbGVnYWwobmFtZSwgXCJuYW1lXCIpO1xyXG4gICAgICAgIG5hbWUgPSBhcHBseUNhc2UobmFtZSk7XHJcbiAgICAgICAgc2tpcChcIj1cIik7XHJcbiAgICAgICAgdmFyIGZpZWxkID0gbmV3IEZpZWxkKG5hbWUsIHBhcnNlSWQobmV4dCgpKSwgdHlwZSwgcnVsZSwgZXh0ZW5kKSxcclxuICAgICAgICAgICAgdHJhaWxpbmdMaW5lID0gdG4ubGluZSgpO1xyXG4gICAgICAgIGZpZWxkLmNvbW1lbnQgPSBjbW50KCk7XHJcbiAgICAgICAgZmllbGQuZmlsZW5hbWUgPSBwYXJzZS5maWxlbmFtZTtcclxuICAgICAgICBwYXJzZUlubGluZU9wdGlvbnMoZmllbGQpO1xyXG4gICAgICAgIGlmICghZmllbGQuY29tbWVudClcclxuICAgICAgICAgICAgZmllbGQuY29tbWVudCA9IGNtbnQodHJhaWxpbmdMaW5lKTtcclxuICAgICAgICAvLyBKU09OIGRlZmF1bHRzIHRvIHBhY2tlZD10cnVlIGlmIG5vdCBzZXQgc28gd2UgaGF2ZSB0byBzZXQgcGFja2VkPWZhbHNlIGV4cGxpY2l0eSB3aGVuXHJcbiAgICAgICAgLy8gcGFyc2luZyBwcm90bzIgZGVzY3JpcHRvcnMgd2l0aG91dCB0aGUgb3B0aW9uLCB3aGVyZSBhcHBsaWNhYmxlLiBUaGlzIG11c3QgYmUgZG9uZSBmb3JcclxuICAgICAgICAvLyBhbnkgdHlwZSAobm90IGp1c3QgcGFja2FibGUgdHlwZXMpIGJlY2F1c2UgZW51bXMgYWxzbyB1c2UgdmFyaW50IGVuY29kaW5nIGFuZCBpdCBpcyBub3RcclxuICAgICAgICAvLyB5ZXQga25vd24gd2hldGhlciBhIHR5cGUgaXMgYW4gZW51bSBvciBub3QuXHJcbiAgICAgICAgaWYgKCFpc1Byb3RvMyAmJiBmaWVsZC5yZXBlYXRlZClcclxuICAgICAgICAgICAgZmllbGQuc2V0T3B0aW9uKFwicGFja2VkXCIsIGZhbHNlLCAvKiBpZk5vdFNldCAqLyB0cnVlKTtcclxuICAgICAgICBwYXJlbnQuYWRkKGZpZWxkKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBwYXJzZUdyb3VwKHBhcmVudCwgcnVsZSkge1xyXG4gICAgICAgIHZhciBuYW1lID0gbmV4dCgpO1xyXG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICAgICAgaWYgKCFpc05hbWUobmFtZSkpXHJcbiAgICAgICAgICAgIHRocm93IGlsbGVnYWwobmFtZSwgXCJuYW1lXCIpO1xyXG4gICAgICAgIHZhciBmaWVsZE5hbWUgPSB1dGlsLmxjRmlyc3QobmFtZSk7XHJcbiAgICAgICAgaWYgKG5hbWUgPT09IGZpZWxkTmFtZSlcclxuICAgICAgICAgICAgbmFtZSA9IHV0aWwudWNGaXJzdChuYW1lKTtcclxuICAgICAgICBza2lwKFwiPVwiKTtcclxuICAgICAgICB2YXIgaWQgPSBwYXJzZUlkKG5leHQoKSk7XHJcbiAgICAgICAgdmFyIHR5cGUgPSBuZXcgVHlwZShuYW1lKTtcclxuICAgICAgICB0eXBlLmdyb3VwID0gdHJ1ZTtcclxuICAgICAgICB0eXBlLmNvbW1lbnQgPSBjbW50KCk7XHJcbiAgICAgICAgdmFyIGZpZWxkID0gbmV3IEZpZWxkKGZpZWxkTmFtZSwgaWQsIG5hbWUsIHJ1bGUpO1xyXG4gICAgICAgIHR5cGUuZmlsZW5hbWUgPSBmaWVsZC5maWxlbmFtZSA9IHBhcnNlLmZpbGVuYW1lO1xyXG4gICAgICAgIHNraXAoXCJ7XCIpO1xyXG4gICAgICAgIHdoaWxlICgodG9rZW4gPSBuZXh0KCkpICE9PSBcIn1cIikge1xyXG4gICAgICAgICAgICBzd2l0Y2ggKHRva2VuID0gbG93ZXIodG9rZW4pKSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlIFwib3B0aW9uXCI6XHJcbiAgICAgICAgICAgICAgICAgICAgcGFyc2VPcHRpb24odHlwZSwgdG9rZW4pO1xyXG4gICAgICAgICAgICAgICAgICAgIHNraXAoXCI7XCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSBcInJlcXVpcmVkXCI6XHJcbiAgICAgICAgICAgICAgICBjYXNlIFwib3B0aW9uYWxcIjpcclxuICAgICAgICAgICAgICAgIGNhc2UgXCJyZXBlYXRlZFwiOlxyXG4gICAgICAgICAgICAgICAgICAgIHBhcnNlRmllbGQodHlwZSwgdG9rZW4pO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IGlsbGVnYWwodG9rZW4pOyAvLyB0aGVyZSBhcmUgbm8gZ3JvdXBzIHdpdGggcHJvdG8zIHNlbWFudGljc1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHNraXAoXCI7XCIsIHRydWUpO1xyXG4gICAgICAgIHBhcmVudC5hZGQodHlwZSkuYWRkKGZpZWxkKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBwYXJzZU1hcEZpZWxkKHBhcmVudCkge1xyXG4gICAgICAgIHNraXAoXCI8XCIpO1xyXG4gICAgICAgIHZhciBrZXlUeXBlID0gbmV4dCgpO1xyXG5cclxuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgICAgIGlmICh0eXBlcy5tYXBLZXlba2V5VHlwZV0gPT09IHVuZGVmaW5lZClcclxuICAgICAgICAgICAgdGhyb3cgaWxsZWdhbChrZXlUeXBlLCBcInR5cGVcIik7XHJcbiAgICAgICAgc2tpcChcIixcIik7XHJcbiAgICAgICAgdmFyIHZhbHVlVHlwZSA9IG5leHQoKTtcclxuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgICAgIGlmICghaXNUeXBlUmVmKHZhbHVlVHlwZSkpXHJcbiAgICAgICAgICAgIHRocm93IGlsbGVnYWwodmFsdWVUeXBlLCBcInR5cGVcIik7XHJcbiAgICAgICAgc2tpcChcIj5cIik7XHJcbiAgICAgICAgdmFyIG5hbWUgPSBuZXh0KCk7XHJcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgICAgICBpZiAoIWlzTmFtZShuYW1lKSlcclxuICAgICAgICAgICAgdGhyb3cgaWxsZWdhbChuYW1lLCBcIm5hbWVcIik7XHJcblxyXG4gICAgICAgIG5hbWUgPSBhcHBseUNhc2UobmFtZSk7XHJcbiAgICAgICAgc2tpcChcIj1cIik7XHJcbiAgICAgICAgdmFyIGZpZWxkID0gbmV3IE1hcEZpZWxkKG5hbWUsIHBhcnNlSWQobmV4dCgpKSwga2V5VHlwZSwgdmFsdWVUeXBlKSxcclxuICAgICAgICAgICAgdHJhaWxpbmdMaW5lID0gdG4ubGluZSgpO1xyXG4gICAgICAgIGZpZWxkLmNvbW1lbnQgPSBjbW50KCk7XHJcbiAgICAgICAgZmllbGQuZmlsZW5hbWUgPSBwYXJzZS5maWxlbmFtZTtcclxuICAgICAgICBwYXJzZUlubGluZU9wdGlvbnMoZmllbGQpO1xyXG4gICAgICAgIGlmICghZmllbGQuY29tbWVudClcclxuICAgICAgICAgICAgZmllbGQuY29tbWVudCA9IGNtbnQodHJhaWxpbmdMaW5lKTtcclxuICAgICAgICBwYXJlbnQuYWRkKGZpZWxkKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBwYXJzZU9uZU9mKHBhcmVudCwgdG9rZW4pIHtcclxuICAgICAgICB2YXIgbmFtZSA9IG5leHQoKTtcclxuXHJcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgICAgICBpZiAoIWlzTmFtZShuYW1lKSlcclxuICAgICAgICAgICAgdGhyb3cgaWxsZWdhbChuYW1lLCBcIm5hbWVcIik7XHJcblxyXG4gICAgICAgIG5hbWUgPSBhcHBseUNhc2UobmFtZSk7XHJcbiAgICAgICAgdmFyIG9uZW9mID0gbmV3IE9uZU9mKG5hbWUpLFxyXG4gICAgICAgICAgICB0cmFpbGluZ0xpbmUgPSB0bi5saW5lKCk7XHJcbiAgICAgICAgb25lb2YuY29tbWVudCA9IGNtbnQoKTtcclxuICAgICAgICBvbmVvZi5maWxlbmFtZSA9IHBhcnNlLmZpbGVuYW1lO1xyXG4gICAgICAgIGlmIChza2lwKFwie1wiLCB0cnVlKSkge1xyXG4gICAgICAgICAgICB3aGlsZSAoKHRva2VuID0gbmV4dCgpKSAhPT0gXCJ9XCIpIHtcclxuICAgICAgICAgICAgICAgIGlmICh0b2tlbiA9PT0gXCJvcHRpb25cIikge1xyXG4gICAgICAgICAgICAgICAgICAgIHBhcnNlT3B0aW9uKG9uZW9mLCB0b2tlbik7XHJcbiAgICAgICAgICAgICAgICAgICAgc2tpcChcIjtcIik7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHB1c2godG9rZW4pO1xyXG4gICAgICAgICAgICAgICAgICAgIHBhcnNlRmllbGQob25lb2YsIFwib3B0aW9uYWxcIik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgc2tpcChcIjtcIiwgdHJ1ZSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgc2tpcChcIjtcIik7XHJcbiAgICAgICAgICAgIGlmICghb25lb2YuY29tbWVudClcclxuICAgICAgICAgICAgICAgIG9uZW9mLmNvbW1lbnQgPSBjbW50KHRyYWlsaW5nTGluZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHBhcmVudC5hZGQob25lb2YpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHBhcnNlRW51bShwYXJlbnQsIHRva2VuKSB7XHJcbiAgICAgICAgdmFyIG5hbWUgPSBuZXh0KCk7XHJcblxyXG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICAgICAgaWYgKCFpc05hbWUobmFtZSkpXHJcbiAgICAgICAgICAgIHRocm93IGlsbGVnYWwobmFtZSwgXCJuYW1lXCIpO1xyXG5cclxuICAgICAgICB2YXIgZW5tID0gbmV3IEVudW0obmFtZSk7XHJcbiAgICAgICAgZW5tLmNvbW1lbnQgPSBjbW50KCk7XHJcbiAgICAgICAgZW5tLmZpbGVuYW1lID0gcGFyc2UuZmlsZW5hbWU7XHJcbiAgICAgICAgaWYgKHNraXAoXCJ7XCIsIHRydWUpKSB7XHJcbiAgICAgICAgICAgIHdoaWxlICgodG9rZW4gPSBuZXh0KCkpICE9PSBcIn1cIikge1xyXG4gICAgICAgICAgICAgICAgaWYgKGxvd2VyKHRva2VuKSA9PT0gXCJvcHRpb25cIikge1xyXG4gICAgICAgICAgICAgICAgICAgIHBhcnNlT3B0aW9uKGVubSwgdG9rZW4pO1xyXG4gICAgICAgICAgICAgICAgICAgIHNraXAoXCI7XCIpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlXHJcbiAgICAgICAgICAgICAgICAgICAgcGFyc2VFbnVtVmFsdWUoZW5tLCB0b2tlbik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgc2tpcChcIjtcIiwgdHJ1ZSk7XHJcbiAgICAgICAgfSBlbHNlXHJcbiAgICAgICAgICAgIHNraXAoXCI7XCIpO1xyXG4gICAgICAgIHBhcmVudC5hZGQoZW5tKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBwYXJzZUVudW1WYWx1ZShwYXJlbnQsIHRva2VuKSB7XHJcblxyXG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICAgICAgaWYgKCFpc05hbWUodG9rZW4pKVxyXG4gICAgICAgICAgICB0aHJvdyBpbGxlZ2FsKHRva2VuLCBcIm5hbWVcIik7XHJcblxyXG4gICAgICAgIHZhciBuYW1lID0gdG9rZW47XHJcbiAgICAgICAgc2tpcChcIj1cIik7XHJcbiAgICAgICAgdmFyIHZhbHVlID0gcGFyc2VJZChuZXh0KCksIHRydWUpLFxyXG4gICAgICAgICAgICB0cmFpbGluZ0xpbmUgPSB0bi5saW5lKCk7XHJcbiAgICAgICAgcGFyZW50LmFkZChuYW1lLCB2YWx1ZSwgY21udCgpKTtcclxuICAgICAgICBwYXJzZUlubGluZU9wdGlvbnMoe30pOyAvLyBza2lwcyBlbnVtIHZhbHVlIG9wdGlvbnNcclxuICAgICAgICBpZiAoIXBhcmVudC5jb21tZW50c1tuYW1lXSlcclxuICAgICAgICAgICAgcGFyZW50LmNvbW1lbnRzW25hbWVdID0gY21udCh0cmFpbGluZ0xpbmUpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHBhcnNlT3B0aW9uKHBhcmVudCwgdG9rZW4pIHtcclxuICAgICAgICB2YXIgY3VzdG9tID0gc2tpcChcIihcIiwgdHJ1ZSk7XHJcbiAgICAgICAgdmFyIG5hbWUgPSBuZXh0KCk7XHJcblxyXG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICAgICAgaWYgKCFpc1R5cGVSZWYobmFtZSkpXHJcbiAgICAgICAgICAgIHRocm93IGlsbGVnYWwobmFtZSwgXCJuYW1lXCIpO1xyXG5cclxuICAgICAgICBpZiAoY3VzdG9tKSB7XHJcbiAgICAgICAgICAgIHNraXAoXCIpXCIpO1xyXG4gICAgICAgICAgICBuYW1lID0gXCIoXCIgKyBuYW1lICsgXCIpXCI7XHJcbiAgICAgICAgICAgIHRva2VuID0gcGVlaygpO1xyXG4gICAgICAgICAgICBpZiAoaXNGcVR5cGVSZWYodG9rZW4pKSB7XHJcbiAgICAgICAgICAgICAgICBuYW1lICs9IHRva2VuO1xyXG4gICAgICAgICAgICAgICAgbmV4dCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHNraXAoXCI9XCIpO1xyXG4gICAgICAgIHBhcnNlT3B0aW9uVmFsdWUocGFyZW50LCBuYW1lKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBwYXJzZU9wdGlvblZhbHVlKHBhcmVudCwgbmFtZSkge1xyXG4gICAgICAgIGlmIChza2lwKFwie1wiLCB0cnVlKSkgeyAvLyB7IGE6IFwiZm9vXCIgYiB7IGM6IFwiYmFyXCIgfSB9XHJcbiAgICAgICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICAgICAgICAgIGRvIHtcclxuICAgICAgICAgICAgICAgIGlmICghaXNOYW1lKHRva2VuID0gbmV4dCgpKSlcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBpbGxlZ2FsKHRva2VuLCBcIm5hbWVcIik7XHJcbiAgICAgICAgICAgICAgICBpZiAocGVlaygpID09PSBcIntcIilcclxuICAgICAgICAgICAgICAgICAgICBwYXJzZU9wdGlvblZhbHVlKHBhcmVudCwgbmFtZSArIFwiLlwiICsgdG9rZW4pO1xyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2tpcChcIjpcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgc2V0T3B0aW9uKHBhcmVudCwgbmFtZSArIFwiLlwiICsgdG9rZW4sIHJlYWRWYWx1ZSh0cnVlKSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gd2hpbGUgKCFza2lwKFwifVwiLCB0cnVlKSk7XHJcbiAgICAgICAgfSBlbHNlXHJcbiAgICAgICAgICAgIHNldE9wdGlvbihwYXJlbnQsIG5hbWUsIHJlYWRWYWx1ZSh0cnVlKSk7XHJcbiAgICAgICAgLy8gRG9lcyBub3QgZW5mb3JjZSBhIGRlbGltaXRlciB0byBiZSB1bml2ZXJzYWxcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBzZXRPcHRpb24ocGFyZW50LCBuYW1lLCB2YWx1ZSkge1xyXG4gICAgICAgIGlmIChwYXJlbnQuc2V0T3B0aW9uKVxyXG4gICAgICAgICAgICBwYXJlbnQuc2V0T3B0aW9uKG5hbWUsIHZhbHVlKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBwYXJzZUlubGluZU9wdGlvbnMocGFyZW50KSB7XHJcbiAgICAgICAgaWYgKHNraXAoXCJbXCIsIHRydWUpKSB7XHJcbiAgICAgICAgICAgIGRvIHtcclxuICAgICAgICAgICAgICAgIHBhcnNlT3B0aW9uKHBhcmVudCwgXCJvcHRpb25cIik7XHJcbiAgICAgICAgICAgIH0gd2hpbGUgKHNraXAoXCIsXCIsIHRydWUpKTtcclxuICAgICAgICAgICAgc2tpcChcIl1cIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHNraXAoXCI7XCIpO1xyXG4gICAgICAgIHJldHVybiBwYXJlbnQ7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gcGFyc2VTZXJ2aWNlKHBhcmVudCwgdG9rZW4pIHtcclxuICAgICAgICB0b2tlbiA9IG5leHQoKTtcclxuXHJcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgICAgICBpZiAoIWlzTmFtZSh0b2tlbikpXHJcbiAgICAgICAgICAgIHRocm93IGlsbGVnYWwodG9rZW4sIFwic2VydmljZSBuYW1lXCIpO1xyXG5cclxuICAgICAgICB2YXIgbmFtZSA9IHRva2VuO1xyXG4gICAgICAgIHZhciBzZXJ2aWNlID0gbmV3IFNlcnZpY2UobmFtZSk7XHJcbiAgICAgICAgc2VydmljZS5jb21tZW50ID0gY21udCgpO1xyXG4gICAgICAgIHNlcnZpY2UuZmlsZW5hbWUgPSBwYXJzZS5maWxlbmFtZTtcclxuICAgICAgICBpZiAoc2tpcChcIntcIiwgdHJ1ZSkpIHtcclxuICAgICAgICAgICAgd2hpbGUgKCh0b2tlbiA9IG5leHQoKSkgIT09IFwifVwiKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgdG9rZW5Mb3dlciA9IGxvd2VyKHRva2VuKTtcclxuICAgICAgICAgICAgICAgIHN3aXRjaCAodG9rZW5Mb3dlcikge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJvcHRpb25cIjpcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGFyc2VPcHRpb24oc2VydmljZSwgdG9rZW5Mb3dlcik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNraXAoXCI7XCIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBjYXNlIFwicnBjXCI6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnNlTWV0aG9kKHNlcnZpY2UsIHRva2VuTG93ZXIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBpbGxlZ2FsKHRva2VuKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBza2lwKFwiO1wiLCB0cnVlKTtcclxuICAgICAgICB9IGVsc2VcclxuICAgICAgICAgICAgc2tpcChcIjtcIik7XHJcbiAgICAgICAgcGFyZW50LmFkZChzZXJ2aWNlKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBwYXJzZU1ldGhvZChwYXJlbnQsIHRva2VuKSB7XHJcbiAgICAgICAgdmFyIHR5cGUgPSB0b2tlbjtcclxuICAgICAgICB2YXIgbmFtZSA9IG5leHQoKTtcclxuXHJcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgICAgICBpZiAoIWlzTmFtZShuYW1lKSlcclxuICAgICAgICAgICAgdGhyb3cgaWxsZWdhbChuYW1lLCBcIm5hbWVcIik7XHJcbiAgICAgICAgdmFyIHJlcXVlc3RUeXBlLCByZXF1ZXN0U3RyZWFtLFxyXG4gICAgICAgICAgICByZXNwb25zZVR5cGUsIHJlc3BvbnNlU3RyZWFtO1xyXG4gICAgICAgIHNraXAoXCIoXCIpO1xyXG4gICAgICAgIGlmIChza2lwKFwic3RyZWFtXCIsIHRydWUpKVxyXG4gICAgICAgICAgICByZXF1ZXN0U3RyZWFtID0gdHJ1ZTtcclxuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgICAgIGlmICghaXNUeXBlUmVmKHRva2VuID0gbmV4dCgpKSlcclxuICAgICAgICAgICAgdGhyb3cgaWxsZWdhbCh0b2tlbik7XHJcbiAgICAgICAgcmVxdWVzdFR5cGUgPSB0b2tlbjtcclxuICAgICAgICBza2lwKFwiKVwiKTsgc2tpcChcInJldHVybnNcIik7IHNraXAoXCIoXCIpO1xyXG4gICAgICAgIGlmIChza2lwKFwic3RyZWFtXCIsIHRydWUpKVxyXG4gICAgICAgICAgICByZXNwb25zZVN0cmVhbSA9IHRydWU7XHJcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgICAgICBpZiAoIWlzVHlwZVJlZih0b2tlbiA9IG5leHQoKSkpXHJcbiAgICAgICAgICAgIHRocm93IGlsbGVnYWwodG9rZW4pO1xyXG5cclxuICAgICAgICByZXNwb25zZVR5cGUgPSB0b2tlbjtcclxuICAgICAgICBza2lwKFwiKVwiKTtcclxuICAgICAgICB2YXIgbWV0aG9kID0gbmV3IE1ldGhvZChuYW1lLCB0eXBlLCByZXF1ZXN0VHlwZSwgcmVzcG9uc2VUeXBlLCByZXF1ZXN0U3RyZWFtLCByZXNwb25zZVN0cmVhbSksXHJcbiAgICAgICAgICAgIHRyYWlsaW5nTGluZSA9IHRuLmxpbmUoKTtcclxuICAgICAgICBtZXRob2QuY29tbWVudCA9IGNtbnQoKTtcclxuICAgICAgICBtZXRob2QuZmlsZW5hbWUgPSBwYXJzZS5maWxlbmFtZTtcclxuICAgICAgICBpZiAoc2tpcChcIntcIiwgdHJ1ZSkpIHtcclxuICAgICAgICAgICAgd2hpbGUgKCh0b2tlbiA9IG5leHQoKSkgIT09IFwifVwiKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgdG9rZW5Mb3dlciA9IGxvd2VyKHRva2VuKTtcclxuICAgICAgICAgICAgICAgIHN3aXRjaCAodG9rZW5Mb3dlcikge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJvcHRpb25cIjpcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGFyc2VPcHRpb24obWV0aG9kLCB0b2tlbkxvd2VyKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2tpcChcIjtcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IGlsbGVnYWwodG9rZW4pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHNraXAoXCI7XCIsIHRydWUpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHNraXAoXCI7XCIpO1xyXG4gICAgICAgICAgICBpZiAoIW1ldGhvZC5jb21tZW50KVxyXG4gICAgICAgICAgICAgICAgbWV0aG9kLmNvbW1lbnQgPSBjbW50KHRyYWlsaW5nTGluZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHBhcmVudC5hZGQobWV0aG9kKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBwYXJzZUV4dGVuc2lvbihwYXJlbnQsIHRva2VuKSB7XHJcbiAgICAgICAgdmFyIHJlZmVyZW5jZSA9IG5leHQoKTtcclxuXHJcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgICAgICBpZiAoIWlzVHlwZVJlZihyZWZlcmVuY2UpKVxyXG4gICAgICAgICAgICB0aHJvdyBpbGxlZ2FsKHJlZmVyZW5jZSwgXCJyZWZlcmVuY2VcIik7XHJcblxyXG4gICAgICAgIGlmIChza2lwKFwie1wiLCB0cnVlKSkge1xyXG4gICAgICAgICAgICB3aGlsZSAoKHRva2VuID0gbmV4dCgpKSAhPT0gXCJ9XCIpIHtcclxuICAgICAgICAgICAgICAgIHZhciB0b2tlbkxvd2VyID0gbG93ZXIodG9rZW4pO1xyXG4gICAgICAgICAgICAgICAgc3dpdGNoICh0b2tlbkxvd2VyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcInJlcXVpcmVkXCI6XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcInJlcGVhdGVkXCI6XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcIm9wdGlvbmFsXCI6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnNlRmllbGQocGFyZW50LCB0b2tlbkxvd2VyLCByZWZlcmVuY2UpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzUHJvdG8zIHx8ICFpc1R5cGVSZWYodG9rZW4pKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgaWxsZWdhbCh0b2tlbik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHB1c2godG9rZW4pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJzZUZpZWxkKHBhcmVudCwgXCJvcHRpb25hbFwiLCByZWZlcmVuY2UpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBza2lwKFwiO1wiLCB0cnVlKTtcclxuICAgICAgICB9IGVsc2VcclxuICAgICAgICAgICAgc2tpcChcIjtcIik7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHRva2VuO1xyXG4gICAgd2hpbGUgKCh0b2tlbiA9IG5leHQoKSkgIT09IG51bGwpIHtcclxuICAgICAgICB2YXIgdG9rZW5Mb3dlciA9IGxvd2VyKHRva2VuKTtcclxuICAgICAgICBzd2l0Y2ggKHRva2VuTG93ZXIpIHtcclxuXHJcbiAgICAgICAgICAgIGNhc2UgXCJwYWNrYWdlXCI6XHJcbiAgICAgICAgICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgICAgICAgICAgICAgaWYgKCFoZWFkKVxyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IGlsbGVnYWwodG9rZW4pO1xyXG4gICAgICAgICAgICAgICAgcGFyc2VQYWNrYWdlKCk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICAgIGNhc2UgXCJpbXBvcnRcIjpcclxuICAgICAgICAgICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICAgICAgICAgICAgICBpZiAoIWhlYWQpXHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgaWxsZWdhbCh0b2tlbik7XHJcbiAgICAgICAgICAgICAgICBwYXJzZUltcG9ydCgpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgICBjYXNlIFwic3ludGF4XCI6XHJcbiAgICAgICAgICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgICAgICAgICAgICAgaWYgKCFoZWFkKVxyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IGlsbGVnYWwodG9rZW4pO1xyXG4gICAgICAgICAgICAgICAgcGFyc2VTeW50YXgoKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgY2FzZSBcIm9wdGlvblwiOlxyXG4gICAgICAgICAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgICAgICAgICAgICAgIGlmICghaGVhZClcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBpbGxlZ2FsKHRva2VuKTtcclxuICAgICAgICAgICAgICAgIHBhcnNlT3B0aW9uKHB0ciwgdG9rZW4pO1xyXG4gICAgICAgICAgICAgICAgc2tpcChcIjtcIik7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xyXG4gICAgICAgICAgICAgICAgaWYgKHBhcnNlQ29tbW9uKHB0ciwgdG9rZW4pKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaGVhZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgICAgICAgICAgICAgIHRocm93IGlsbGVnYWwodG9rZW4pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwYXJzZS5maWxlbmFtZSA9IG51bGw7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIFwicGFja2FnZVwiICAgICA6IHBrZyxcclxuICAgICAgICBcImltcG9ydHNcIiAgICAgOiBpbXBvcnRzLFxyXG4gICAgICAgICB3ZWFrSW1wb3J0cyAgOiB3ZWFrSW1wb3J0cyxcclxuICAgICAgICAgc3ludGF4ICAgICAgIDogc3ludGF4LFxyXG4gICAgICAgICByb290ICAgICAgICAgOiByb290XHJcbiAgICB9O1xyXG59XHJcblxyXG4vKipcclxuICogUGFyc2VzIHRoZSBnaXZlbiAucHJvdG8gc291cmNlIGFuZCByZXR1cm5zIGFuIG9iamVjdCB3aXRoIHRoZSBwYXJzZWQgY29udGVudHMuXHJcbiAqIEBuYW1lIHBhcnNlXHJcbiAqIEBmdW5jdGlvblxyXG4gKiBAcGFyYW0ge3N0cmluZ30gc291cmNlIFNvdXJjZSBjb250ZW50c1xyXG4gKiBAcGFyYW0ge1BhcnNlT3B0aW9uc30gW29wdGlvbnNdIFBhcnNlIG9wdGlvbnMuIERlZmF1bHRzIHRvIHtAbGluayBwYXJzZS5kZWZhdWx0c30gd2hlbiBvbWl0dGVkLlxyXG4gKiBAcmV0dXJucyB7UGFyc2VyUmVzdWx0fSBQYXJzZXIgcmVzdWx0XHJcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBmaWxlbmFtZT1udWxsIEN1cnJlbnRseSBwcm9jZXNzaW5nIGZpbGUgbmFtZSBmb3IgZXJyb3IgcmVwb3J0aW5nLCBpZiBrbm93blxyXG4gKiBAcHJvcGVydHkge1BhcnNlT3B0aW9uc30gZGVmYXVsdHMgRGVmYXVsdCB7QGxpbmsgUGFyc2VPcHRpb25zfVxyXG4gKiBAdmFyaWF0aW9uIDJcclxuICovXHJcbiIsIlwidXNlIHN0cmljdFwiO1xyXG5tb2R1bGUuZXhwb3J0cyA9IFJlYWRlcjtcclxuXHJcbnZhciB1dGlsICAgICAgPSByZXF1aXJlKFwiLi91dGlsL21pbmltYWxcIik7XHJcblxyXG52YXIgQnVmZmVyUmVhZGVyOyAvLyBjeWNsaWNcclxuXHJcbnZhciBMb25nQml0cyAgPSB1dGlsLkxvbmdCaXRzLFxyXG4gICAgdXRmOCAgICAgID0gdXRpbC51dGY4O1xyXG5cclxuLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuZnVuY3Rpb24gaW5kZXhPdXRPZlJhbmdlKHJlYWRlciwgd3JpdGVMZW5ndGgpIHtcclxuICAgIHJldHVybiBSYW5nZUVycm9yKFwiaW5kZXggb3V0IG9mIHJhbmdlOiBcIiArIHJlYWRlci5wb3MgKyBcIiArIFwiICsgKHdyaXRlTGVuZ3RoIHx8IDEpICsgXCIgPiBcIiArIHJlYWRlci5sZW4pO1xyXG59XHJcblxyXG4vKipcclxuICogQ29uc3RydWN0cyBhIG5ldyByZWFkZXIgaW5zdGFuY2UgdXNpbmcgdGhlIHNwZWNpZmllZCBidWZmZXIuXHJcbiAqIEBjbGFzc2Rlc2MgV2lyZSBmb3JtYXQgcmVhZGVyIHVzaW5nIGBVaW50OEFycmF5YCBpZiBhdmFpbGFibGUsIG90aGVyd2lzZSBgQXJyYXlgLlxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQHBhcmFtIHtVaW50OEFycmF5fSBidWZmZXIgQnVmZmVyIHRvIHJlYWQgZnJvbVxyXG4gKi9cclxuZnVuY3Rpb24gUmVhZGVyKGJ1ZmZlcikge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVhZCBidWZmZXIuXHJcbiAgICAgKiBAdHlwZSB7VWludDhBcnJheX1cclxuICAgICAqL1xyXG4gICAgdGhpcy5idWYgPSBidWZmZXI7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZWFkIGJ1ZmZlciBwb3NpdGlvbi5cclxuICAgICAqIEB0eXBlIHtudW1iZXJ9XHJcbiAgICAgKi9cclxuICAgIHRoaXMucG9zID0gMDtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlYWQgYnVmZmVyIGxlbmd0aC5cclxuICAgICAqIEB0eXBlIHtudW1iZXJ9XHJcbiAgICAgKi9cclxuICAgIHRoaXMubGVuID0gYnVmZmVyLmxlbmd0aDtcclxufVxyXG5cclxuLyoqXHJcbiAqIENyZWF0ZXMgYSBuZXcgcmVhZGVyIHVzaW5nIHRoZSBzcGVjaWZpZWQgYnVmZmVyLlxyXG4gKiBAZnVuY3Rpb25cclxuICogQHBhcmFtIHtVaW50OEFycmF5fEJ1ZmZlcn0gYnVmZmVyIEJ1ZmZlciB0byByZWFkIGZyb21cclxuICogQHJldHVybnMge1JlYWRlcnxCdWZmZXJSZWFkZXJ9IEEge0BsaW5rIEJ1ZmZlclJlYWRlcn0gaWYgYGJ1ZmZlcmAgaXMgYSBCdWZmZXIsIG90aGVyd2lzZSBhIHtAbGluayBSZWFkZXJ9XHJcbiAqL1xyXG5SZWFkZXIuY3JlYXRlID0gdXRpbC5CdWZmZXJcclxuICAgID8gZnVuY3Rpb24gY3JlYXRlX2J1ZmZlcl9zZXR1cChidWZmZXIpIHtcclxuICAgICAgICByZXR1cm4gKFJlYWRlci5jcmVhdGUgPSBmdW5jdGlvbiBjcmVhdGVfYnVmZmVyKGJ1ZmZlcikge1xyXG4gICAgICAgICAgICByZXR1cm4gdXRpbC5CdWZmZXIuaXNCdWZmZXIoYnVmZmVyKVxyXG4gICAgICAgICAgICAgICAgPyBuZXcgQnVmZmVyUmVhZGVyKGJ1ZmZlcilcclxuICAgICAgICAgICAgICAgIDogbmV3IFJlYWRlcihidWZmZXIpO1xyXG4gICAgICAgIH0pKGJ1ZmZlcik7XHJcbiAgICB9XHJcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgOiBmdW5jdGlvbiBjcmVhdGVfYXJyYXkoYnVmZmVyKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBSZWFkZXIoYnVmZmVyKTtcclxuICAgIH07XHJcblxyXG5SZWFkZXIucHJvdG90eXBlLl9zbGljZSA9IHV0aWwuQXJyYXkucHJvdG90eXBlLnN1YmFycmF5IHx8IC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovIHV0aWwuQXJyYXkucHJvdG90eXBlLnNsaWNlO1xyXG5cclxuLyoqXHJcbiAqIFJlYWRzIGEgdmFyaW50IGFzIGFuIHVuc2lnbmVkIDMyIGJpdCB2YWx1ZS5cclxuICogQGZ1bmN0aW9uXHJcbiAqIEByZXR1cm5zIHtudW1iZXJ9IFZhbHVlIHJlYWRcclxuICovXHJcblJlYWRlci5wcm90b3R5cGUudWludDMyID0gKGZ1bmN0aW9uIHJlYWRfdWludDMyX3NldHVwKCkge1xyXG4gICAgdmFyIHZhbHVlID0gNDI5NDk2NzI5NTsgLy8gb3B0aW1pemVyIHR5cGUtaGludCwgdGVuZHMgdG8gZGVvcHQgb3RoZXJ3aXNlICg/ISlcclxuICAgIHJldHVybiBmdW5jdGlvbiByZWFkX3VpbnQzMigpIHtcclxuICAgICAgICB2YWx1ZSA9ICggICAgICAgICB0aGlzLmJ1Zlt0aGlzLnBvc10gJiAxMjcgICAgICAgKSA+Pj4gMDsgaWYgKHRoaXMuYnVmW3RoaXMucG9zKytdIDwgMTI4KSByZXR1cm4gdmFsdWU7XHJcbiAgICAgICAgdmFsdWUgPSAodmFsdWUgfCAodGhpcy5idWZbdGhpcy5wb3NdICYgMTI3KSA8PCAgNykgPj4+IDA7IGlmICh0aGlzLmJ1Zlt0aGlzLnBvcysrXSA8IDEyOCkgcmV0dXJuIHZhbHVlO1xyXG4gICAgICAgIHZhbHVlID0gKHZhbHVlIHwgKHRoaXMuYnVmW3RoaXMucG9zXSAmIDEyNykgPDwgMTQpID4+PiAwOyBpZiAodGhpcy5idWZbdGhpcy5wb3MrK10gPCAxMjgpIHJldHVybiB2YWx1ZTtcclxuICAgICAgICB2YWx1ZSA9ICh2YWx1ZSB8ICh0aGlzLmJ1Zlt0aGlzLnBvc10gJiAxMjcpIDw8IDIxKSA+Pj4gMDsgaWYgKHRoaXMuYnVmW3RoaXMucG9zKytdIDwgMTI4KSByZXR1cm4gdmFsdWU7XHJcbiAgICAgICAgdmFsdWUgPSAodmFsdWUgfCAodGhpcy5idWZbdGhpcy5wb3NdICYgIDE1KSA8PCAyOCkgPj4+IDA7IGlmICh0aGlzLmJ1Zlt0aGlzLnBvcysrXSA8IDEyOCkgcmV0dXJuIHZhbHVlO1xyXG5cclxuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgICAgIGlmICgodGhpcy5wb3MgKz0gNSkgPiB0aGlzLmxlbikge1xyXG4gICAgICAgICAgICB0aGlzLnBvcyA9IHRoaXMubGVuO1xyXG4gICAgICAgICAgICB0aHJvdyBpbmRleE91dE9mUmFuZ2UodGhpcywgMTApO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdmFsdWU7XHJcbiAgICB9O1xyXG59KSgpO1xyXG5cclxuLyoqXHJcbiAqIFJlYWRzIGEgdmFyaW50IGFzIGEgc2lnbmVkIDMyIGJpdCB2YWx1ZS5cclxuICogQHJldHVybnMge251bWJlcn0gVmFsdWUgcmVhZFxyXG4gKi9cclxuUmVhZGVyLnByb3RvdHlwZS5pbnQzMiA9IGZ1bmN0aW9uIHJlYWRfaW50MzIoKSB7XHJcbiAgICByZXR1cm4gdGhpcy51aW50MzIoKSB8IDA7XHJcbn07XHJcblxyXG4vKipcclxuICogUmVhZHMgYSB6aWctemFnIGVuY29kZWQgdmFyaW50IGFzIGEgc2lnbmVkIDMyIGJpdCB2YWx1ZS5cclxuICogQHJldHVybnMge251bWJlcn0gVmFsdWUgcmVhZFxyXG4gKi9cclxuUmVhZGVyLnByb3RvdHlwZS5zaW50MzIgPSBmdW5jdGlvbiByZWFkX3NpbnQzMigpIHtcclxuICAgIHZhciB2YWx1ZSA9IHRoaXMudWludDMyKCk7XHJcbiAgICByZXR1cm4gdmFsdWUgPj4+IDEgXiAtKHZhbHVlICYgMSkgfCAwO1xyXG59O1xyXG5cclxuLyogZXNsaW50LWRpc2FibGUgbm8taW52YWxpZC10aGlzICovXHJcblxyXG5mdW5jdGlvbiByZWFkTG9uZ1ZhcmludCgpIHtcclxuICAgIC8vIHRlbmRzIHRvIGRlb3B0IHdpdGggbG9jYWwgdmFycyBmb3Igb2N0ZXQgZXRjLlxyXG4gICAgdmFyIGJpdHMgPSBuZXcgTG9uZ0JpdHMoMCwgMCk7XHJcbiAgICB2YXIgaSA9IDA7XHJcbiAgICBpZiAodGhpcy5sZW4gLSB0aGlzLnBvcyA+IDQpIHsgLy8gZmFzdCByb3V0ZSAobG8pXHJcbiAgICAgICAgZm9yICg7IGkgPCA0OyArK2kpIHtcclxuICAgICAgICAgICAgLy8gMXN0Li40dGhcclxuICAgICAgICAgICAgYml0cy5sbyA9IChiaXRzLmxvIHwgKHRoaXMuYnVmW3RoaXMucG9zXSAmIDEyNykgPDwgaSAqIDcpID4+PiAwO1xyXG4gICAgICAgICAgICBpZiAodGhpcy5idWZbdGhpcy5wb3MrK10gPCAxMjgpXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYml0cztcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gNXRoXHJcbiAgICAgICAgYml0cy5sbyA9IChiaXRzLmxvIHwgKHRoaXMuYnVmW3RoaXMucG9zXSAmIDEyNykgPDwgMjgpID4+PiAwO1xyXG4gICAgICAgIGJpdHMuaGkgPSAoYml0cy5oaSB8ICh0aGlzLmJ1Zlt0aGlzLnBvc10gJiAxMjcpID4+ICA0KSA+Pj4gMDtcclxuICAgICAgICBpZiAodGhpcy5idWZbdGhpcy5wb3MrK10gPCAxMjgpXHJcbiAgICAgICAgICAgIHJldHVybiBiaXRzO1xyXG4gICAgICAgIGkgPSAwO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBmb3IgKDsgaSA8IDM7ICsraSkge1xyXG4gICAgICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgICAgICAgICBpZiAodGhpcy5wb3MgPj0gdGhpcy5sZW4pXHJcbiAgICAgICAgICAgICAgICB0aHJvdyBpbmRleE91dE9mUmFuZ2UodGhpcyk7XHJcbiAgICAgICAgICAgIC8vIDFzdC4uM3RoXHJcbiAgICAgICAgICAgIGJpdHMubG8gPSAoYml0cy5sbyB8ICh0aGlzLmJ1Zlt0aGlzLnBvc10gJiAxMjcpIDw8IGkgKiA3KSA+Pj4gMDtcclxuICAgICAgICAgICAgaWYgKHRoaXMuYnVmW3RoaXMucG9zKytdIDwgMTI4KVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGJpdHM7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIDR0aFxyXG4gICAgICAgIGJpdHMubG8gPSAoYml0cy5sbyB8ICh0aGlzLmJ1Zlt0aGlzLnBvcysrXSAmIDEyNykgPDwgaSAqIDcpID4+PiAwO1xyXG4gICAgICAgIHJldHVybiBiaXRzO1xyXG4gICAgfVxyXG4gICAgaWYgKHRoaXMubGVuIC0gdGhpcy5wb3MgPiA0KSB7IC8vIGZhc3Qgcm91dGUgKGhpKVxyXG4gICAgICAgIGZvciAoOyBpIDwgNTsgKytpKSB7XHJcbiAgICAgICAgICAgIC8vIDZ0aC4uMTB0aFxyXG4gICAgICAgICAgICBiaXRzLmhpID0gKGJpdHMuaGkgfCAodGhpcy5idWZbdGhpcy5wb3NdICYgMTI3KSA8PCBpICogNyArIDMpID4+PiAwO1xyXG4gICAgICAgICAgICBpZiAodGhpcy5idWZbdGhpcy5wb3MrK10gPCAxMjgpXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYml0cztcclxuICAgICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGZvciAoOyBpIDwgNTsgKytpKSB7XHJcbiAgICAgICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICAgICAgICAgIGlmICh0aGlzLnBvcyA+PSB0aGlzLmxlbilcclxuICAgICAgICAgICAgICAgIHRocm93IGluZGV4T3V0T2ZSYW5nZSh0aGlzKTtcclxuICAgICAgICAgICAgLy8gNnRoLi4xMHRoXHJcbiAgICAgICAgICAgIGJpdHMuaGkgPSAoYml0cy5oaSB8ICh0aGlzLmJ1Zlt0aGlzLnBvc10gJiAxMjcpIDw8IGkgKiA3ICsgMykgPj4+IDA7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmJ1Zlt0aGlzLnBvcysrXSA8IDEyOClcclxuICAgICAgICAgICAgICAgIHJldHVybiBiaXRzO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICB0aHJvdyBFcnJvcihcImludmFsaWQgdmFyaW50IGVuY29kaW5nXCIpO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZWFkX2ludDY0X2xvbmcoKSB7XHJcbiAgICByZXR1cm4gcmVhZExvbmdWYXJpbnQuY2FsbCh0aGlzKS50b0xvbmcoKTtcclxufVxyXG5cclxuLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuZnVuY3Rpb24gcmVhZF9pbnQ2NF9udW1iZXIoKSB7XHJcbiAgICByZXR1cm4gcmVhZExvbmdWYXJpbnQuY2FsbCh0aGlzKS50b051bWJlcigpO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZWFkX3VpbnQ2NF9sb25nKCkge1xyXG4gICAgcmV0dXJuIHJlYWRMb25nVmFyaW50LmNhbGwodGhpcykudG9Mb25nKHRydWUpO1xyXG59XHJcblxyXG4vKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG5mdW5jdGlvbiByZWFkX3VpbnQ2NF9udW1iZXIoKSB7XHJcbiAgICByZXR1cm4gcmVhZExvbmdWYXJpbnQuY2FsbCh0aGlzKS50b051bWJlcih0cnVlKTtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVhZF9zaW50NjRfbG9uZygpIHtcclxuICAgIHJldHVybiByZWFkTG9uZ1ZhcmludC5jYWxsKHRoaXMpLnp6RGVjb2RlKCkudG9Mb25nKCk7XHJcbn1cclxuXHJcbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbmZ1bmN0aW9uIHJlYWRfc2ludDY0X251bWJlcigpIHtcclxuICAgIHJldHVybiByZWFkTG9uZ1ZhcmludC5jYWxsKHRoaXMpLnp6RGVjb2RlKCkudG9OdW1iZXIoKTtcclxufVxyXG5cclxuLyogZXNsaW50LWVuYWJsZSBuby1pbnZhbGlkLXRoaXMgKi9cclxuXHJcbi8qKlxyXG4gKiBSZWFkcyBhIHZhcmludCBhcyBhIHNpZ25lZCA2NCBiaXQgdmFsdWUuXHJcbiAqIEBuYW1lIFJlYWRlciNpbnQ2NFxyXG4gKiBAZnVuY3Rpb25cclxuICogQHJldHVybnMge0xvbmd8bnVtYmVyfSBWYWx1ZSByZWFkXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIFJlYWRzIGEgdmFyaW50IGFzIGFuIHVuc2lnbmVkIDY0IGJpdCB2YWx1ZS5cclxuICogQG5hbWUgUmVhZGVyI3VpbnQ2NFxyXG4gKiBAZnVuY3Rpb25cclxuICogQHJldHVybnMge0xvbmd8bnVtYmVyfSBWYWx1ZSByZWFkXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIFJlYWRzIGEgemlnLXphZyBlbmNvZGVkIHZhcmludCBhcyBhIHNpZ25lZCA2NCBiaXQgdmFsdWUuXHJcbiAqIEBuYW1lIFJlYWRlciNzaW50NjRcclxuICogQGZ1bmN0aW9uXHJcbiAqIEByZXR1cm5zIHtMb25nfG51bWJlcn0gVmFsdWUgcmVhZFxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBSZWFkcyBhIHZhcmludCBhcyBhIGJvb2xlYW4uXHJcbiAqIEByZXR1cm5zIHtib29sZWFufSBWYWx1ZSByZWFkXHJcbiAqL1xyXG5SZWFkZXIucHJvdG90eXBlLmJvb2wgPSBmdW5jdGlvbiByZWFkX2Jvb2woKSB7XHJcbiAgICByZXR1cm4gdGhpcy51aW50MzIoKSAhPT0gMDtcclxufTtcclxuXHJcbmZ1bmN0aW9uIHJlYWRGaXhlZDMyKGJ1ZiwgZW5kKSB7XHJcbiAgICByZXR1cm4gKGJ1ZltlbmQgLSA0XVxyXG4gICAgICAgICAgfCBidWZbZW5kIC0gM10gPDwgOFxyXG4gICAgICAgICAgfCBidWZbZW5kIC0gMl0gPDwgMTZcclxuICAgICAgICAgIHwgYnVmW2VuZCAtIDFdIDw8IDI0KSA+Pj4gMDtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJlYWRzIGZpeGVkIDMyIGJpdHMgYXMgYW4gdW5zaWduZWQgMzIgYml0IGludGVnZXIuXHJcbiAqIEByZXR1cm5zIHtudW1iZXJ9IFZhbHVlIHJlYWRcclxuICovXHJcblJlYWRlci5wcm90b3R5cGUuZml4ZWQzMiA9IGZ1bmN0aW9uIHJlYWRfZml4ZWQzMigpIHtcclxuXHJcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgaWYgKHRoaXMucG9zICsgNCA+IHRoaXMubGVuKVxyXG4gICAgICAgIHRocm93IGluZGV4T3V0T2ZSYW5nZSh0aGlzLCA0KTtcclxuXHJcbiAgICByZXR1cm4gcmVhZEZpeGVkMzIodGhpcy5idWYsIHRoaXMucG9zICs9IDQpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJlYWRzIGZpeGVkIDMyIGJpdHMgYXMgYSBzaWduZWQgMzIgYml0IGludGVnZXIuXHJcbiAqIEByZXR1cm5zIHtudW1iZXJ9IFZhbHVlIHJlYWRcclxuICovXHJcblJlYWRlci5wcm90b3R5cGUuc2ZpeGVkMzIgPSBmdW5jdGlvbiByZWFkX3NmaXhlZDMyKCkge1xyXG5cclxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICBpZiAodGhpcy5wb3MgKyA0ID4gdGhpcy5sZW4pXHJcbiAgICAgICAgdGhyb3cgaW5kZXhPdXRPZlJhbmdlKHRoaXMsIDQpO1xyXG5cclxuICAgIHJldHVybiByZWFkRml4ZWQzMih0aGlzLmJ1ZiwgdGhpcy5wb3MgKz0gNCkgfCAwO1xyXG59O1xyXG5cclxuLyogZXNsaW50LWRpc2FibGUgbm8taW52YWxpZC10aGlzICovXHJcblxyXG5mdW5jdGlvbiByZWFkRml4ZWQ2NCgvKiB0aGlzOiBSZWFkZXIgKi8pIHtcclxuXHJcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgaWYgKHRoaXMucG9zICsgOCA+IHRoaXMubGVuKVxyXG4gICAgICAgIHRocm93IGluZGV4T3V0T2ZSYW5nZSh0aGlzLCA4KTtcclxuXHJcbiAgICByZXR1cm4gbmV3IExvbmdCaXRzKHJlYWRGaXhlZDMyKHRoaXMuYnVmLCB0aGlzLnBvcyArPSA0KSwgcmVhZEZpeGVkMzIodGhpcy5idWYsIHRoaXMucG9zICs9IDQpKTtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVhZF9maXhlZDY0X2xvbmcoKSB7XHJcbiAgICByZXR1cm4gcmVhZEZpeGVkNjQuY2FsbCh0aGlzKS50b0xvbmcodHJ1ZSk7XHJcbn1cclxuXHJcbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbmZ1bmN0aW9uIHJlYWRfZml4ZWQ2NF9udW1iZXIoKSB7XHJcbiAgICByZXR1cm4gcmVhZEZpeGVkNjQuY2FsbCh0aGlzKS50b051bWJlcih0cnVlKTtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVhZF9zZml4ZWQ2NF9sb25nKCkge1xyXG4gICAgcmV0dXJuIHJlYWRGaXhlZDY0LmNhbGwodGhpcykudG9Mb25nKGZhbHNlKTtcclxufVxyXG5cclxuLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuZnVuY3Rpb24gcmVhZF9zZml4ZWQ2NF9udW1iZXIoKSB7XHJcbiAgICByZXR1cm4gcmVhZEZpeGVkNjQuY2FsbCh0aGlzKS50b051bWJlcihmYWxzZSk7XHJcbn1cclxuXHJcbi8qIGVzbGludC1lbmFibGUgbm8taW52YWxpZC10aGlzICovXHJcblxyXG4vKipcclxuICogUmVhZHMgZml4ZWQgNjQgYml0cy5cclxuICogQG5hbWUgUmVhZGVyI2ZpeGVkNjRcclxuICogQGZ1bmN0aW9uXHJcbiAqIEByZXR1cm5zIHtMb25nfG51bWJlcn0gVmFsdWUgcmVhZFxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBSZWFkcyB6aWctemFnIGVuY29kZWQgZml4ZWQgNjQgYml0cy5cclxuICogQG5hbWUgUmVhZGVyI3NmaXhlZDY0XHJcbiAqIEBmdW5jdGlvblxyXG4gKiBAcmV0dXJucyB7TG9uZ3xudW1iZXJ9IFZhbHVlIHJlYWRcclxuICovXHJcblxyXG52YXIgcmVhZEZsb2F0ID0gdHlwZW9mIEZsb2F0MzJBcnJheSAhPT0gXCJ1bmRlZmluZWRcIlxyXG4gICAgPyAoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyIGYzMiA9IG5ldyBGbG9hdDMyQXJyYXkoMSksXHJcbiAgICAgICAgICAgIGY4YiA9IG5ldyBVaW50OEFycmF5KGYzMi5idWZmZXIpO1xyXG4gICAgICAgIGYzMlswXSA9IC0wO1xyXG4gICAgICAgIHJldHVybiBmOGJbM10gLy8gYWxyZWFkeSBsZT9cclxuICAgICAgICAgICAgPyBmdW5jdGlvbiByZWFkRmxvYXRfZjMyKGJ1ZiwgcG9zKSB7XHJcbiAgICAgICAgICAgICAgICBmOGJbMF0gPSBidWZbcG9zICAgIF07XHJcbiAgICAgICAgICAgICAgICBmOGJbMV0gPSBidWZbcG9zICsgMV07XHJcbiAgICAgICAgICAgICAgICBmOGJbMl0gPSBidWZbcG9zICsgMl07XHJcbiAgICAgICAgICAgICAgICBmOGJbM10gPSBidWZbcG9zICsgM107XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZjMyWzBdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICAgICAgICAgIDogZnVuY3Rpb24gcmVhZEZsb2F0X2YzMl9sZShidWYsIHBvcykge1xyXG4gICAgICAgICAgICAgICAgZjhiWzNdID0gYnVmW3BvcyAgICBdO1xyXG4gICAgICAgICAgICAgICAgZjhiWzJdID0gYnVmW3BvcyArIDFdO1xyXG4gICAgICAgICAgICAgICAgZjhiWzFdID0gYnVmW3BvcyArIDJdO1xyXG4gICAgICAgICAgICAgICAgZjhiWzBdID0gYnVmW3BvcyArIDNdO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGYzMlswXTtcclxuICAgICAgICAgICAgfTtcclxuICAgIH0pKClcclxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICA6IGZ1bmN0aW9uIHJlYWRGbG9hdF9pZWVlNzU0KGJ1ZiwgcG9zKSB7XHJcbiAgICAgICAgdmFyIHVpbnQgPSByZWFkRml4ZWQzMihidWYsIHBvcyArIDQpLFxyXG4gICAgICAgICAgICBzaWduID0gKHVpbnQgPj4gMzEpICogMiArIDEsXHJcbiAgICAgICAgICAgIGV4cG9uZW50ID0gdWludCA+Pj4gMjMgJiAyNTUsXHJcbiAgICAgICAgICAgIG1hbnRpc3NhID0gdWludCAmIDgzODg2MDc7XHJcbiAgICAgICAgcmV0dXJuIGV4cG9uZW50ID09PSAyNTVcclxuICAgICAgICAgICAgPyBtYW50aXNzYVxyXG4gICAgICAgICAgICAgID8gTmFOXHJcbiAgICAgICAgICAgICAgOiBzaWduICogSW5maW5pdHlcclxuICAgICAgICAgICAgOiBleHBvbmVudCA9PT0gMCAvLyBkZW5vcm1hbFxyXG4gICAgICAgICAgICAgID8gc2lnbiAqIDEuNDAxMjk4NDY0MzI0ODE3ZS00NSAqIG1hbnRpc3NhXHJcbiAgICAgICAgICAgICAgOiBzaWduICogTWF0aC5wb3coMiwgZXhwb25lbnQgLSAxNTApICogKG1hbnRpc3NhICsgODM4ODYwOCk7XHJcbiAgICB9O1xyXG5cclxuLyoqXHJcbiAqIFJlYWRzIGEgZmxvYXQgKDMyIGJpdCkgYXMgYSBudW1iZXIuXHJcbiAqIEBmdW5jdGlvblxyXG4gKiBAcmV0dXJucyB7bnVtYmVyfSBWYWx1ZSByZWFkXHJcbiAqL1xyXG5SZWFkZXIucHJvdG90eXBlLmZsb2F0ID0gZnVuY3Rpb24gcmVhZF9mbG9hdCgpIHtcclxuXHJcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgaWYgKHRoaXMucG9zICsgNCA+IHRoaXMubGVuKVxyXG4gICAgICAgIHRocm93IGluZGV4T3V0T2ZSYW5nZSh0aGlzLCA0KTtcclxuXHJcbiAgICB2YXIgdmFsdWUgPSByZWFkRmxvYXQodGhpcy5idWYsIHRoaXMucG9zKTtcclxuICAgIHRoaXMucG9zICs9IDQ7XHJcbiAgICByZXR1cm4gdmFsdWU7XHJcbn07XHJcblxyXG52YXIgcmVhZERvdWJsZSA9IHR5cGVvZiBGbG9hdDY0QXJyYXkgIT09IFwidW5kZWZpbmVkXCJcclxuICAgID8gKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHZhciBmNjQgPSBuZXcgRmxvYXQ2NEFycmF5KDEpLFxyXG4gICAgICAgICAgICBmOGIgPSBuZXcgVWludDhBcnJheShmNjQuYnVmZmVyKTtcclxuICAgICAgICBmNjRbMF0gPSAtMDtcclxuICAgICAgICByZXR1cm4gZjhiWzddIC8vIGFscmVhZHkgbGU/XHJcbiAgICAgICAgICAgID8gZnVuY3Rpb24gcmVhZERvdWJsZV9mNjQoYnVmLCBwb3MpIHtcclxuICAgICAgICAgICAgICAgIGY4YlswXSA9IGJ1Zltwb3MgICAgXTtcclxuICAgICAgICAgICAgICAgIGY4YlsxXSA9IGJ1Zltwb3MgKyAxXTtcclxuICAgICAgICAgICAgICAgIGY4YlsyXSA9IGJ1Zltwb3MgKyAyXTtcclxuICAgICAgICAgICAgICAgIGY4YlszXSA9IGJ1Zltwb3MgKyAzXTtcclxuICAgICAgICAgICAgICAgIGY4Yls0XSA9IGJ1Zltwb3MgKyA0XTtcclxuICAgICAgICAgICAgICAgIGY4Yls1XSA9IGJ1Zltwb3MgKyA1XTtcclxuICAgICAgICAgICAgICAgIGY4Yls2XSA9IGJ1Zltwb3MgKyA2XTtcclxuICAgICAgICAgICAgICAgIGY4Yls3XSA9IGJ1Zltwb3MgKyA3XTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmNjRbMF07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgICAgICAgICAgOiBmdW5jdGlvbiByZWFkRG91YmxlX2Y2NF9sZShidWYsIHBvcykge1xyXG4gICAgICAgICAgICAgICAgZjhiWzddID0gYnVmW3BvcyAgICBdO1xyXG4gICAgICAgICAgICAgICAgZjhiWzZdID0gYnVmW3BvcyArIDFdO1xyXG4gICAgICAgICAgICAgICAgZjhiWzVdID0gYnVmW3BvcyArIDJdO1xyXG4gICAgICAgICAgICAgICAgZjhiWzRdID0gYnVmW3BvcyArIDNdO1xyXG4gICAgICAgICAgICAgICAgZjhiWzNdID0gYnVmW3BvcyArIDRdO1xyXG4gICAgICAgICAgICAgICAgZjhiWzJdID0gYnVmW3BvcyArIDVdO1xyXG4gICAgICAgICAgICAgICAgZjhiWzFdID0gYnVmW3BvcyArIDZdO1xyXG4gICAgICAgICAgICAgICAgZjhiWzBdID0gYnVmW3BvcyArIDddO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGY2NFswXTtcclxuICAgICAgICAgICAgfTtcclxuICAgIH0pKClcclxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICA6IGZ1bmN0aW9uIHJlYWREb3VibGVfaWVlZTc1NChidWYsIHBvcykge1xyXG4gICAgICAgIHZhciBsbyA9IHJlYWRGaXhlZDMyKGJ1ZiwgcG9zICsgNCksXHJcbiAgICAgICAgICAgIGhpID0gcmVhZEZpeGVkMzIoYnVmLCBwb3MgKyA4KTtcclxuICAgICAgICB2YXIgc2lnbiA9IChoaSA+PiAzMSkgKiAyICsgMSxcclxuICAgICAgICAgICAgZXhwb25lbnQgPSBoaSA+Pj4gMjAgJiAyMDQ3LFxyXG4gICAgICAgICAgICBtYW50aXNzYSA9IDQyOTQ5NjcyOTYgKiAoaGkgJiAxMDQ4NTc1KSArIGxvO1xyXG4gICAgICAgIHJldHVybiBleHBvbmVudCA9PT0gMjA0N1xyXG4gICAgICAgICAgICA/IG1hbnRpc3NhXHJcbiAgICAgICAgICAgICAgPyBOYU5cclxuICAgICAgICAgICAgICA6IHNpZ24gKiBJbmZpbml0eVxyXG4gICAgICAgICAgICA6IGV4cG9uZW50ID09PSAwIC8vIGRlbm9ybWFsXHJcbiAgICAgICAgICAgICAgPyBzaWduICogNWUtMzI0ICogbWFudGlzc2FcclxuICAgICAgICAgICAgICA6IHNpZ24gKiBNYXRoLnBvdygyLCBleHBvbmVudCAtIDEwNzUpICogKG1hbnRpc3NhICsgNDUwMzU5OTYyNzM3MDQ5Nik7XHJcbiAgICB9O1xyXG5cclxuLyoqXHJcbiAqIFJlYWRzIGEgZG91YmxlICg2NCBiaXQgZmxvYXQpIGFzIGEgbnVtYmVyLlxyXG4gKiBAZnVuY3Rpb25cclxuICogQHJldHVybnMge251bWJlcn0gVmFsdWUgcmVhZFxyXG4gKi9cclxuUmVhZGVyLnByb3RvdHlwZS5kb3VibGUgPSBmdW5jdGlvbiByZWFkX2RvdWJsZSgpIHtcclxuXHJcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgaWYgKHRoaXMucG9zICsgOCA+IHRoaXMubGVuKVxyXG4gICAgICAgIHRocm93IGluZGV4T3V0T2ZSYW5nZSh0aGlzLCA0KTtcclxuXHJcbiAgICB2YXIgdmFsdWUgPSByZWFkRG91YmxlKHRoaXMuYnVmLCB0aGlzLnBvcyk7XHJcbiAgICB0aGlzLnBvcyArPSA4O1xyXG4gICAgcmV0dXJuIHZhbHVlO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJlYWRzIGEgc2VxdWVuY2Ugb2YgYnl0ZXMgcHJlY2VlZGVkIGJ5IGl0cyBsZW5ndGggYXMgYSB2YXJpbnQuXHJcbiAqIEByZXR1cm5zIHtVaW50OEFycmF5fSBWYWx1ZSByZWFkXHJcbiAqL1xyXG5SZWFkZXIucHJvdG90eXBlLmJ5dGVzID0gZnVuY3Rpb24gcmVhZF9ieXRlcygpIHtcclxuICAgIHZhciBsZW5ndGggPSB0aGlzLnVpbnQzMigpLFxyXG4gICAgICAgIHN0YXJ0ICA9IHRoaXMucG9zLFxyXG4gICAgICAgIGVuZCAgICA9IHRoaXMucG9zICsgbGVuZ3RoO1xyXG5cclxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICBpZiAoZW5kID4gdGhpcy5sZW4pXHJcbiAgICAgICAgdGhyb3cgaW5kZXhPdXRPZlJhbmdlKHRoaXMsIGxlbmd0aCk7XHJcblxyXG4gICAgdGhpcy5wb3MgKz0gbGVuZ3RoO1xyXG4gICAgcmV0dXJuIHN0YXJ0ID09PSBlbmQgLy8gZml4IGZvciBJRSAxMC9XaW44IGFuZCBvdGhlcnMnIHN1YmFycmF5IHJldHVybmluZyBhcnJheSBvZiBzaXplIDFcclxuICAgICAgICA/IG5ldyB0aGlzLmJ1Zi5jb25zdHJ1Y3RvcigwKVxyXG4gICAgICAgIDogdGhpcy5fc2xpY2UuY2FsbCh0aGlzLmJ1Ziwgc3RhcnQsIGVuZCk7XHJcbn07XHJcblxyXG4vKipcclxuICogUmVhZHMgYSBzdHJpbmcgcHJlY2VlZGVkIGJ5IGl0cyBieXRlIGxlbmd0aCBhcyBhIHZhcmludC5cclxuICogQHJldHVybnMge3N0cmluZ30gVmFsdWUgcmVhZFxyXG4gKi9cclxuUmVhZGVyLnByb3RvdHlwZS5zdHJpbmcgPSBmdW5jdGlvbiByZWFkX3N0cmluZygpIHtcclxuICAgIHZhciBieXRlcyA9IHRoaXMuYnl0ZXMoKTtcclxuICAgIHJldHVybiB1dGY4LnJlYWQoYnl0ZXMsIDAsIGJ5dGVzLmxlbmd0aCk7XHJcbn07XHJcblxyXG4vKipcclxuICogU2tpcHMgdGhlIHNwZWNpZmllZCBudW1iZXIgb2YgYnl0ZXMgaWYgc3BlY2lmaWVkLCBvdGhlcndpc2Ugc2tpcHMgYSB2YXJpbnQuXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBbbGVuZ3RoXSBMZW5ndGggaWYga25vd24sIG90aGVyd2lzZSBhIHZhcmludCBpcyBhc3N1bWVkXHJcbiAqIEByZXR1cm5zIHtSZWFkZXJ9IGB0aGlzYFxyXG4gKi9cclxuUmVhZGVyLnByb3RvdHlwZS5za2lwID0gZnVuY3Rpb24gc2tpcChsZW5ndGgpIHtcclxuICAgIGlmICh0eXBlb2YgbGVuZ3RoID09PSBcIm51bWJlclwiKSB7XHJcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgICAgICBpZiAodGhpcy5wb3MgKyBsZW5ndGggPiB0aGlzLmxlbilcclxuICAgICAgICAgICAgdGhyb3cgaW5kZXhPdXRPZlJhbmdlKHRoaXMsIGxlbmd0aCk7XHJcbiAgICAgICAgdGhpcy5wb3MgKz0gbGVuZ3RoO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgICAgIGRvIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMucG9zID49IHRoaXMubGVuKVxyXG4gICAgICAgICAgICAgICAgdGhyb3cgaW5kZXhPdXRPZlJhbmdlKHRoaXMpO1xyXG4gICAgICAgIH0gd2hpbGUgKHRoaXMuYnVmW3RoaXMucG9zKytdICYgMTI4KTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFNraXBzIHRoZSBuZXh0IGVsZW1lbnQgb2YgdGhlIHNwZWNpZmllZCB3aXJlIHR5cGUuXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSB3aXJlVHlwZSBXaXJlIHR5cGUgcmVjZWl2ZWRcclxuICogQHJldHVybnMge1JlYWRlcn0gYHRoaXNgXHJcbiAqL1xyXG5SZWFkZXIucHJvdG90eXBlLnNraXBUeXBlID0gZnVuY3Rpb24od2lyZVR5cGUpIHtcclxuICAgIHN3aXRjaCAod2lyZVR5cGUpIHtcclxuICAgICAgICBjYXNlIDA6XHJcbiAgICAgICAgICAgIHRoaXMuc2tpcCgpO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIDE6XHJcbiAgICAgICAgICAgIHRoaXMuc2tpcCg4KTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSAyOlxyXG4gICAgICAgICAgICB0aGlzLnNraXAodGhpcy51aW50MzIoKSk7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgMzpcclxuICAgICAgICAgICAgZG8geyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWNvbnN0YW50LWNvbmRpdGlvblxyXG4gICAgICAgICAgICAgICAgaWYgKCh3aXJlVHlwZSA9IHRoaXMudWludDMyKCkgJiA3KSA9PT0gNClcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIHRoaXMuc2tpcFR5cGUod2lyZVR5cGUpO1xyXG4gICAgICAgICAgICB9IHdoaWxlICh0cnVlKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSA1OlxyXG4gICAgICAgICAgICB0aGlzLnNraXAoNCk7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgIHRocm93IEVycm9yKFwiaW52YWxpZCB3aXJlIHR5cGUgXCIgKyB3aXJlVHlwZSArIFwiIGF0IG9mZnNldCBcIiArIHRoaXMucG9zKTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuUmVhZGVyLl9jb25maWd1cmUgPSBmdW5jdGlvbihCdWZmZXJSZWFkZXJfKSB7XHJcbiAgICBCdWZmZXJSZWFkZXIgPSBCdWZmZXJSZWFkZXJfO1xyXG5cclxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICovXHJcbiAgICBpZiAodXRpbC5Mb25nKSB7XHJcbiAgICAgICAgUmVhZGVyLnByb3RvdHlwZS5pbnQ2NCA9IHJlYWRfaW50NjRfbG9uZztcclxuICAgICAgICBSZWFkZXIucHJvdG90eXBlLnVpbnQ2NCA9IHJlYWRfdWludDY0X2xvbmc7XHJcbiAgICAgICAgUmVhZGVyLnByb3RvdHlwZS5zaW50NjQgPSByZWFkX3NpbnQ2NF9sb25nO1xyXG4gICAgICAgIFJlYWRlci5wcm90b3R5cGUuZml4ZWQ2NCA9IHJlYWRfZml4ZWQ2NF9sb25nO1xyXG4gICAgICAgIFJlYWRlci5wcm90b3R5cGUuc2ZpeGVkNjQgPSByZWFkX3NmaXhlZDY0X2xvbmc7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIFJlYWRlci5wcm90b3R5cGUuaW50NjQgPSByZWFkX2ludDY0X251bWJlcjtcclxuICAgICAgICBSZWFkZXIucHJvdG90eXBlLnVpbnQ2NCA9IHJlYWRfdWludDY0X251bWJlcjtcclxuICAgICAgICBSZWFkZXIucHJvdG90eXBlLnNpbnQ2NCA9IHJlYWRfc2ludDY0X251bWJlcjtcclxuICAgICAgICBSZWFkZXIucHJvdG90eXBlLmZpeGVkNjQgPSByZWFkX2ZpeGVkNjRfbnVtYmVyO1xyXG4gICAgICAgIFJlYWRlci5wcm90b3R5cGUuc2ZpeGVkNjQgPSByZWFkX3NmaXhlZDY0X251bWJlcjtcclxuICAgIH1cclxufTtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbm1vZHVsZS5leHBvcnRzID0gQnVmZmVyUmVhZGVyO1xyXG5cclxuLy8gZXh0ZW5kcyBSZWFkZXJcclxudmFyIFJlYWRlciA9IHJlcXVpcmUoXCIuL3JlYWRlclwiKTtcclxuKEJ1ZmZlclJlYWRlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlYWRlci5wcm90b3R5cGUpKS5jb25zdHJ1Y3RvciA9IEJ1ZmZlclJlYWRlcjtcclxuXHJcbnZhciB1dGlsID0gcmVxdWlyZShcIi4vdXRpbC9taW5pbWFsXCIpO1xyXG5cclxuLyoqXHJcbiAqIENvbnN0cnVjdHMgYSBuZXcgYnVmZmVyIHJlYWRlciBpbnN0YW5jZS5cclxuICogQGNsYXNzZGVzYyBXaXJlIGZvcm1hdCByZWFkZXIgdXNpbmcgbm9kZSBidWZmZXJzLlxyXG4gKiBAZXh0ZW5kcyBSZWFkZXJcclxuICogQGNvbnN0cnVjdG9yXHJcbiAqIEBwYXJhbSB7QnVmZmVyfSBidWZmZXIgQnVmZmVyIHRvIHJlYWQgZnJvbVxyXG4gKi9cclxuZnVuY3Rpb24gQnVmZmVyUmVhZGVyKGJ1ZmZlcikge1xyXG4gICAgUmVhZGVyLmNhbGwodGhpcywgYnVmZmVyKTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlYWQgYnVmZmVyLlxyXG4gICAgICogQG5hbWUgQnVmZmVyUmVhZGVyI2J1ZlxyXG4gICAgICogQHR5cGUge0J1ZmZlcn1cclxuICAgICAqL1xyXG59XHJcblxyXG4vKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xyXG5pZiAodXRpbC5CdWZmZXIpXHJcbiAgICBCdWZmZXJSZWFkZXIucHJvdG90eXBlLl9zbGljZSA9IHV0aWwuQnVmZmVyLnByb3RvdHlwZS5zbGljZTtcclxuXHJcbi8qKlxyXG4gKiBAb3ZlcnJpZGVcclxuICovXHJcbkJ1ZmZlclJlYWRlci5wcm90b3R5cGUuc3RyaW5nID0gZnVuY3Rpb24gcmVhZF9zdHJpbmdfYnVmZmVyKCkge1xyXG4gICAgdmFyIGxlbiA9IHRoaXMudWludDMyKCk7IC8vIG1vZGlmaWVzIHBvc1xyXG4gICAgcmV0dXJuIHRoaXMuYnVmLnV0ZjhTbGljZSh0aGlzLnBvcywgdGhpcy5wb3MgPSBNYXRoLm1pbih0aGlzLnBvcyArIGxlbiwgdGhpcy5sZW4pKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZWFkcyBhIHNlcXVlbmNlIG9mIGJ5dGVzIHByZWNlZWRlZCBieSBpdHMgbGVuZ3RoIGFzIGEgdmFyaW50LlxyXG4gKiBAbmFtZSBCdWZmZXJSZWFkZXIjYnl0ZXNcclxuICogQGZ1bmN0aW9uXHJcbiAqIEByZXR1cm5zIHtCdWZmZXJ9IFZhbHVlIHJlYWRcclxuICovXHJcbiIsIlwidXNlIHN0cmljdFwiO1xyXG5tb2R1bGUuZXhwb3J0cyA9IFJvb3Q7XHJcblxyXG4vLyBleHRlbmRzIE5hbWVzcGFjZVxyXG52YXIgTmFtZXNwYWNlID0gcmVxdWlyZShcIi4vbmFtZXNwYWNlXCIpO1xyXG4oKFJvb3QucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShOYW1lc3BhY2UucHJvdG90eXBlKSkuY29uc3RydWN0b3IgPSBSb290KS5jbGFzc05hbWUgPSBcIlJvb3RcIjtcclxuXHJcbnZhciBGaWVsZCAgID0gcmVxdWlyZShcIi4vZmllbGRcIiksXHJcbiAgICBFbnVtICAgID0gcmVxdWlyZShcIi4vZW51bVwiKSxcclxuICAgIHV0aWwgICAgPSByZXF1aXJlKFwiLi91dGlsXCIpO1xyXG5cclxudmFyIFR5cGUsICAgLy8gY3ljbGljXHJcbiAgICBwYXJzZSwgIC8vIG1pZ2h0IGJlIGV4Y2x1ZGVkXHJcbiAgICBjb21tb247IC8vIFwiXHJcblxyXG4vKipcclxuICogQ29uc3RydWN0cyBhIG5ldyByb290IG5hbWVzcGFjZSBpbnN0YW5jZS5cclxuICogQGNsYXNzZGVzYyBSb290IG5hbWVzcGFjZSB3cmFwcGluZyBhbGwgdHlwZXMsIGVudW1zLCBzZXJ2aWNlcywgc3ViLW5hbWVzcGFjZXMgZXRjLiB0aGF0IGJlbG9uZyB0b2dldGhlci5cclxuICogQGV4dGVuZHMgTmFtZXNwYWNlQmFzZVxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywqPn0gW29wdGlvbnNdIFRvcCBsZXZlbCBvcHRpb25zXHJcbiAqL1xyXG5mdW5jdGlvbiBSb290KG9wdGlvbnMpIHtcclxuICAgIE5hbWVzcGFjZS5jYWxsKHRoaXMsIFwiXCIsIG9wdGlvbnMpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogRGVmZXJyZWQgZXh0ZW5zaW9uIGZpZWxkcy5cclxuICAgICAqIEB0eXBlIHtGaWVsZFtdfVxyXG4gICAgICovXHJcbiAgICB0aGlzLmRlZmVycmVkID0gW107XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXNvbHZlZCBmaWxlIG5hbWVzIG9mIGxvYWRlZCBmaWxlcy5cclxuICAgICAqIEB0eXBlIHtzdHJpbmdbXX1cclxuICAgICAqL1xyXG4gICAgdGhpcy5maWxlcyA9IFtdO1xyXG59XHJcblxyXG4vKipcclxuICogTG9hZHMgYSBKU09OIGRlZmluaXRpb24gaW50byBhIHJvb3QgbmFtZXNwYWNlLlxyXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCo+fSBqc29uIEpTT04gZGVmaW5pdGlvblxyXG4gKiBAcGFyYW0ge1Jvb3R9IFtyb290XSBSb290IG5hbWVzcGFjZSwgZGVmYXVsdHMgdG8gY3JlYXRlIGEgbmV3IG9uZSBpZiBvbWl0dGVkXHJcbiAqIEByZXR1cm5zIHtSb290fSBSb290IG5hbWVzcGFjZVxyXG4gKi9cclxuUm9vdC5mcm9tSlNPTiA9IGZ1bmN0aW9uIGZyb21KU09OKGpzb24sIHJvb3QpIHtcclxuICAgIGlmICghcm9vdClcclxuICAgICAgICByb290ID0gbmV3IFJvb3QoKTtcclxuICAgIGlmIChqc29uLm9wdGlvbnMpXHJcbiAgICAgICAgcm9vdC5zZXRPcHRpb25zKGpzb24ub3B0aW9ucyk7XHJcbiAgICByZXR1cm4gcm9vdC5hZGRKU09OKGpzb24ubmVzdGVkKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZXNvbHZlcyB0aGUgcGF0aCBvZiBhbiBpbXBvcnRlZCBmaWxlLCByZWxhdGl2ZSB0byB0aGUgaW1wb3J0aW5nIG9yaWdpbi5cclxuICogVGhpcyBtZXRob2QgZXhpc3RzIHNvIHlvdSBjYW4gb3ZlcnJpZGUgaXQgd2l0aCB5b3VyIG93biBsb2dpYyBpbiBjYXNlIHlvdXIgaW1wb3J0cyBhcmUgc2NhdHRlcmVkIG92ZXIgbXVsdGlwbGUgZGlyZWN0b3JpZXMuXHJcbiAqIEBmdW5jdGlvblxyXG4gKiBAcGFyYW0ge3N0cmluZ30gb3JpZ2luIFRoZSBmaWxlIG5hbWUgb2YgdGhlIGltcG9ydGluZyBmaWxlXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSB0YXJnZXQgVGhlIGZpbGUgbmFtZSBiZWluZyBpbXBvcnRlZFxyXG4gKiBAcmV0dXJucyB7P3N0cmluZ30gUmVzb2x2ZWQgcGF0aCB0byBgdGFyZ2V0YCBvciBgbnVsbGAgdG8gc2tpcCB0aGUgZmlsZVxyXG4gKi9cclxuUm9vdC5wcm90b3R5cGUucmVzb2x2ZVBhdGggPSB1dGlsLnBhdGgucmVzb2x2ZTtcclxuXHJcbi8vIEEgc3ltYm9sLWxpa2UgZnVuY3Rpb24gdG8gc2FmZWx5IHNpZ25hbCBzeW5jaHJvbm91cyBsb2FkaW5nXHJcbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbmZ1bmN0aW9uIFNZTkMoKSB7fSAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWVtcHR5LWZ1bmN0aW9uXHJcblxyXG4vKipcclxuICogTG9hZHMgb25lIG9yIG11bHRpcGxlIC5wcm90byBvciBwcmVwcm9jZXNzZWQgLmpzb24gZmlsZXMgaW50byB0aGlzIHJvb3QgbmFtZXNwYWNlIGFuZCBjYWxscyB0aGUgY2FsbGJhY2suXHJcbiAqIEBwYXJhbSB7c3RyaW5nfHN0cmluZ1tdfSBmaWxlbmFtZSBOYW1lcyBvZiBvbmUgb3IgbXVsdGlwbGUgZmlsZXMgdG8gbG9hZFxyXG4gKiBAcGFyYW0ge1BhcnNlT3B0aW9uc30gb3B0aW9ucyBQYXJzZSBvcHRpb25zXHJcbiAqIEBwYXJhbSB7TG9hZENhbGxiYWNrfSBjYWxsYmFjayBDYWxsYmFjayBmdW5jdGlvblxyXG4gKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxyXG4gKi9cclxuUm9vdC5wcm90b3R5cGUubG9hZCA9IGZ1bmN0aW9uIGxvYWQoZmlsZW5hbWUsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XHJcbiAgICBpZiAodHlwZW9mIG9wdGlvbnMgPT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcclxuICAgICAgICBvcHRpb25zID0gdW5kZWZpbmVkO1xyXG4gICAgfVxyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG4gICAgaWYgKCFjYWxsYmFjaylcclxuICAgICAgICByZXR1cm4gdXRpbC5hc1Byb21pc2UobG9hZCwgc2VsZiwgZmlsZW5hbWUpO1xyXG4gICAgXHJcbiAgICB2YXIgc3luYyA9IGNhbGxiYWNrID09PSBTWU5DOyAvLyB1bmRvY3VtZW50ZWRcclxuXHJcbiAgICAvLyBGaW5pc2hlcyBsb2FkaW5nIGJ5IGNhbGxpbmcgdGhlIGNhbGxiYWNrIChleGFjdGx5IG9uY2UpXHJcbiAgICBmdW5jdGlvbiBmaW5pc2goZXJyLCByb290KSB7XHJcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgICAgICBpZiAoIWNhbGxiYWNrKVxyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgdmFyIGNiID0gY2FsbGJhY2s7XHJcbiAgICAgICAgY2FsbGJhY2sgPSBudWxsO1xyXG4gICAgICAgIGlmIChzeW5jKVxyXG4gICAgICAgICAgICB0aHJvdyBlcnI7XHJcbiAgICAgICAgY2IoZXJyLCByb290KTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBQcm9jZXNzZXMgYSBzaW5nbGUgZmlsZVxyXG4gICAgZnVuY3Rpb24gcHJvY2VzcyhmaWxlbmFtZSwgc291cmNlKSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKHV0aWwuaXNTdHJpbmcoc291cmNlKSAmJiBzb3VyY2UuY2hhckF0KDApID09PSBcIntcIilcclxuICAgICAgICAgICAgICAgIHNvdXJjZSA9IEpTT04ucGFyc2Uoc291cmNlKTtcclxuICAgICAgICAgICAgaWYgKCF1dGlsLmlzU3RyaW5nKHNvdXJjZSkpXHJcbiAgICAgICAgICAgICAgICBzZWxmLnNldE9wdGlvbnMoc291cmNlLm9wdGlvbnMpLmFkZEpTT04oc291cmNlLm5lc3RlZCk7XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcGFyc2UuZmlsZW5hbWUgPSBmaWxlbmFtZTtcclxuICAgICAgICAgICAgICAgIHZhciBwYXJzZWQgPSBwYXJzZShzb3VyY2UsIHNlbGYsIG9wdGlvbnMpLFxyXG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmVkLFxyXG4gICAgICAgICAgICAgICAgICAgIGkgPSAwO1xyXG4gICAgICAgICAgICAgICAgaWYgKHBhcnNlZC5pbXBvcnRzKVxyXG4gICAgICAgICAgICAgICAgICAgIGZvciAoOyBpIDwgcGFyc2VkLmltcG9ydHMubGVuZ3RoOyArK2kpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXNvbHZlZCA9IHNlbGYucmVzb2x2ZVBhdGgoZmlsZW5hbWUsIHBhcnNlZC5pbXBvcnRzW2ldKSlcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZldGNoKHJlc29sdmVkKTtcclxuICAgICAgICAgICAgICAgIGlmIChwYXJzZWQud2Vha0ltcG9ydHMpXHJcbiAgICAgICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IHBhcnNlZC53ZWFrSW1wb3J0cy5sZW5ndGg7ICsraSlcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlc29sdmVkID0gc2VsZi5yZXNvbHZlUGF0aChmaWxlbmFtZSwgcGFyc2VkLndlYWtJbXBvcnRzW2ldKSlcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZldGNoKHJlc29sdmVkLCB0cnVlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICAgICAgICBmaW5pc2goZXJyKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCFzeW5jICYmICFxdWV1ZWQpXHJcbiAgICAgICAgICAgIGZpbmlzaChudWxsLCBzZWxmKTsgLy8gb25seSBvbmNlIGFueXdheVxyXG4gICAgfVxyXG5cclxuICAgIC8vIEZldGNoZXMgYSBzaW5nbGUgZmlsZVxyXG4gICAgZnVuY3Rpb24gZmV0Y2goZmlsZW5hbWUsIHdlYWspIHtcclxuXHJcbiAgICAgICAgLy8gU3RyaXAgcGF0aCBpZiB0aGlzIGZpbGUgcmVmZXJlbmNlcyBhIGJ1bmRsZWQgZGVmaW5pdGlvblxyXG4gICAgICAgIHZhciBpZHggPSBmaWxlbmFtZS5sYXN0SW5kZXhPZihcImdvb2dsZS9wcm90b2J1Zi9cIik7XHJcbiAgICAgICAgaWYgKGlkeCA+IC0xKSB7XHJcbiAgICAgICAgICAgIHZhciBhbHRuYW1lID0gZmlsZW5hbWUuc3Vic3RyaW5nKGlkeCk7XHJcbiAgICAgICAgICAgIGlmIChhbHRuYW1lIGluIGNvbW1vbilcclxuICAgICAgICAgICAgICAgIGZpbGVuYW1lID0gYWx0bmFtZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIFNraXAgaWYgYWxyZWFkeSBsb2FkZWQgLyBhdHRlbXB0ZWRcclxuICAgICAgICBpZiAoc2VsZi5maWxlcy5pbmRleE9mKGZpbGVuYW1lKSA+IC0xKVxyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgc2VsZi5maWxlcy5wdXNoKGZpbGVuYW1lKTtcclxuXHJcbiAgICAgICAgLy8gU2hvcnRjdXQgYnVuZGxlZCBkZWZpbml0aW9uc1xyXG4gICAgICAgIGlmIChmaWxlbmFtZSBpbiBjb21tb24pIHtcclxuICAgICAgICAgICAgaWYgKHN5bmMpXHJcbiAgICAgICAgICAgICAgICBwcm9jZXNzKGZpbGVuYW1lLCBjb21tb25bZmlsZW5hbWVdKTtcclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICArK3F1ZXVlZDtcclxuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLS1xdWV1ZWQ7XHJcbiAgICAgICAgICAgICAgICAgICAgcHJvY2VzcyhmaWxlbmFtZSwgY29tbW9uW2ZpbGVuYW1lXSk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBPdGhlcndpc2UgZmV0Y2ggZnJvbSBkaXNrIG9yIG5ldHdvcmtcclxuICAgICAgICBpZiAoc3luYykge1xyXG4gICAgICAgICAgICB2YXIgc291cmNlO1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgc291cmNlID0gdXRpbC5mcy5yZWFkRmlsZVN5bmMoZmlsZW5hbWUpLnRvU3RyaW5nKFwidXRmOFwiKTtcclxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIXdlYWspXHJcbiAgICAgICAgICAgICAgICAgICAgZmluaXNoKGVycik7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcHJvY2VzcyhmaWxlbmFtZSwgc291cmNlKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICArK3F1ZXVlZDtcclxuICAgICAgICAgICAgdXRpbC5mZXRjaChmaWxlbmFtZSwgZnVuY3Rpb24oZXJyLCBzb3VyY2UpIHtcclxuICAgICAgICAgICAgICAgIC0tcXVldWVkO1xyXG4gICAgICAgICAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgICAgICAgICAgICAgIGlmICghY2FsbGJhY2spXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuOyAvLyB0ZXJtaW5hdGVkIG1lYW53aGlsZVxyXG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICghd2VhaylcclxuICAgICAgICAgICAgICAgICAgICAgICAgZmluaXNoKGVycik7XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZSAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqLyBpZiAoIXF1ZXVlZCkgLy8gY2FuJ3QgYmUgY292ZXJlZCByZWxpYWJseVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBmaW5pc2gobnVsbCwgc2VsZik7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcHJvY2VzcyhmaWxlbmFtZSwgc291cmNlKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgdmFyIHF1ZXVlZCA9IDA7XHJcblxyXG4gICAgLy8gQXNzZW1ibGluZyB0aGUgcm9vdCBuYW1lc3BhY2UgZG9lc24ndCByZXF1aXJlIHdvcmtpbmcgdHlwZVxyXG4gICAgLy8gcmVmZXJlbmNlcyBhbnltb3JlLCBzbyB3ZSBjYW4gbG9hZCBldmVyeXRoaW5nIGluIHBhcmFsbGVsXHJcbiAgICBpZiAodXRpbC5pc1N0cmluZyhmaWxlbmFtZSkpXHJcbiAgICAgICAgZmlsZW5hbWUgPSBbIGZpbGVuYW1lIF07XHJcbiAgICBmb3IgKHZhciBpID0gMCwgcmVzb2x2ZWQ7IGkgPCBmaWxlbmFtZS5sZW5ndGg7ICsraSlcclxuICAgICAgICBpZiAocmVzb2x2ZWQgPSBzZWxmLnJlc29sdmVQYXRoKFwiXCIsIGZpbGVuYW1lW2ldKSlcclxuICAgICAgICAgICAgZmV0Y2gocmVzb2x2ZWQpO1xyXG5cclxuICAgIGlmIChzeW5jKVxyXG4gICAgICAgIHJldHVybiBzZWxmO1xyXG4gICAgaWYgKCFxdWV1ZWQpXHJcbiAgICAgICAgZmluaXNoKG51bGwsIHNlbGYpO1xyXG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcclxufTtcclxuLy8gZnVuY3Rpb24gbG9hZChmaWxlbmFtZTpzdHJpbmcsIG9wdGlvbnM6UGFyc2VPcHRpb25zLCBjYWxsYmFjazpMb2FkQ2FsbGJhY2spOnVuZGVmaW5lZFxyXG5cclxuLyoqXHJcbiAqIExvYWRzIG9uZSBvciBtdWx0aXBsZSAucHJvdG8gb3IgcHJlcHJvY2Vzc2VkIC5qc29uIGZpbGVzIGludG8gdGhpcyByb290IG5hbWVzcGFjZSBhbmQgY2FsbHMgdGhlIGNhbGxiYWNrLlxyXG4gKiBAcGFyYW0ge3N0cmluZ3xzdHJpbmdbXX0gZmlsZW5hbWUgTmFtZXMgb2Ygb25lIG9yIG11bHRpcGxlIGZpbGVzIHRvIGxvYWRcclxuICogQHBhcmFtIHtMb2FkQ2FsbGJhY2t9IGNhbGxiYWNrIENhbGxiYWNrIGZ1bmN0aW9uXHJcbiAqIEByZXR1cm5zIHt1bmRlZmluZWR9XHJcbiAqIEB2YXJpYXRpb24gMlxyXG4gKi9cclxuLy8gZnVuY3Rpb24gbG9hZChmaWxlbmFtZTpzdHJpbmcsIGNhbGxiYWNrOkxvYWRDYWxsYmFjayk6dW5kZWZpbmVkXHJcblxyXG4vKipcclxuICogTG9hZHMgb25lIG9yIG11bHRpcGxlIC5wcm90byBvciBwcmVwcm9jZXNzZWQgLmpzb24gZmlsZXMgaW50byB0aGlzIHJvb3QgbmFtZXNwYWNlIGFuZCByZXR1cm5zIGEgcHJvbWlzZS5cclxuICogQG5hbWUgUm9vdCNsb2FkXHJcbiAqIEBmdW5jdGlvblxyXG4gKiBAcGFyYW0ge3N0cmluZ3xzdHJpbmdbXX0gZmlsZW5hbWUgTmFtZXMgb2Ygb25lIG9yIG11bHRpcGxlIGZpbGVzIHRvIGxvYWRcclxuICogQHBhcmFtIHtQYXJzZU9wdGlvbnN9IFtvcHRpb25zXSBQYXJzZSBvcHRpb25zLiBEZWZhdWx0cyB0byB7QGxpbmsgcGFyc2UuZGVmYXVsdHN9IHdoZW4gb21pdHRlZC5cclxuICogQHJldHVybnMge1Byb21pc2U8Um9vdD59IFByb21pc2VcclxuICogQHZhcmlhdGlvbiAzXHJcbiAqL1xyXG4vLyBmdW5jdGlvbiBsb2FkKGZpbGVuYW1lOnN0cmluZywgW29wdGlvbnM6UGFyc2VPcHRpb25zXSk6UHJvbWlzZTxSb290PlxyXG5cclxuLyoqXHJcbiAqIFN5bmNocm9ub3VzbHkgbG9hZHMgb25lIG9yIG11bHRpcGxlIC5wcm90byBvciBwcmVwcm9jZXNzZWQgLmpzb24gZmlsZXMgaW50byB0aGlzIHJvb3QgbmFtZXNwYWNlIChub2RlIG9ubHkpLlxyXG4gKiBAbmFtZSBSb290I2xvYWRTeW5jXHJcbiAqIEBmdW5jdGlvblxyXG4gKiBAcGFyYW0ge3N0cmluZ3xzdHJpbmdbXX0gZmlsZW5hbWUgTmFtZXMgb2Ygb25lIG9yIG11bHRpcGxlIGZpbGVzIHRvIGxvYWRcclxuICogQHBhcmFtIHtQYXJzZU9wdGlvbnN9IFtvcHRpb25zXSBQYXJzZSBvcHRpb25zLiBEZWZhdWx0cyB0byB7QGxpbmsgcGFyc2UuZGVmYXVsdHN9IHdoZW4gb21pdHRlZC5cclxuICogQHJldHVybnMge1Jvb3R9IFJvb3QgbmFtZXNwYWNlXHJcbiAqIEB0aHJvd3Mge0Vycm9yfSBJZiBzeW5jaHJvbm91cyBmZXRjaGluZyBpcyBub3Qgc3VwcG9ydGVkIChpLmUuIGluIGJyb3dzZXJzKSBvciBpZiBhIGZpbGUncyBzeW50YXggaXMgaW52YWxpZFxyXG4gKi9cclxuUm9vdC5wcm90b3R5cGUubG9hZFN5bmMgPSBmdW5jdGlvbiBsb2FkU3luYyhmaWxlbmFtZSwgb3B0aW9ucykge1xyXG4gICAgaWYgKCF1dGlsLmlzTm9kZSlcclxuICAgICAgICB0aHJvdyBFcnJvcihcIm5vdCBzdXBwb3J0ZWRcIik7XHJcbiAgICByZXR1cm4gdGhpcy5sb2FkKGZpbGVuYW1lLCBvcHRpb25zLCBTWU5DKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBAb3ZlcnJpZGVcclxuICovXHJcblJvb3QucHJvdG90eXBlLnJlc29sdmVBbGwgPSBmdW5jdGlvbiByZXNvbHZlQWxsKCkge1xyXG4gICAgaWYgKHRoaXMuZGVmZXJyZWQubGVuZ3RoKVxyXG4gICAgICAgIHRocm93IEVycm9yKFwidW5yZXNvbHZhYmxlIGV4dGVuc2lvbnM6IFwiICsgdGhpcy5kZWZlcnJlZC5tYXAoZnVuY3Rpb24oZmllbGQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFwiJ2V4dGVuZCBcIiArIGZpZWxkLmV4dGVuZCArIFwiJyBpbiBcIiArIGZpZWxkLnBhcmVudC5mdWxsTmFtZTtcclxuICAgICAgICB9KS5qb2luKFwiLCBcIikpO1xyXG4gICAgcmV0dXJuIE5hbWVzcGFjZS5wcm90b3R5cGUucmVzb2x2ZUFsbC5jYWxsKHRoaXMpO1xyXG59O1xyXG5cclxuLy8gb25seSB1cHBlcmNhc2VkIChhbmQgdGh1cyBjb25mbGljdC1mcmVlKSBjaGlsZHJlbiBhcmUgZXhwb3NlZCwgc2VlIGJlbG93XHJcbnZhciBleHBvc2VSZSA9IC9eW0EtWl0vO1xyXG5cclxuLyoqXHJcbiAqIEhhbmRsZXMgYSBkZWZlcnJlZCBkZWNsYXJpbmcgZXh0ZW5zaW9uIGZpZWxkIGJ5IGNyZWF0aW5nIGEgc2lzdGVyIGZpZWxkIHRvIHJlcHJlc2VudCBpdCB3aXRoaW4gaXRzIGV4dGVuZGVkIHR5cGUuXHJcbiAqIEBwYXJhbSB7Um9vdH0gcm9vdCBSb290IGluc3RhbmNlXHJcbiAqIEBwYXJhbSB7RmllbGR9IGZpZWxkIERlY2xhcmluZyBleHRlbnNpb24gZmllbGQgd2l0aW4gdGhlIGRlY2xhcmluZyB0eXBlXHJcbiAqIEByZXR1cm5zIHtib29sZWFufSBgdHJ1ZWAgaWYgc3VjY2Vzc2Z1bGx5IGFkZGVkIHRvIHRoZSBleHRlbmRlZCB0eXBlLCBgZmFsc2VgIG90aGVyd2lzZVxyXG4gKiBAaW5uZXJcclxuICogQGlnbm9yZVxyXG4gKi9cclxuZnVuY3Rpb24gdHJ5SGFuZGxlRXh0ZW5zaW9uKHJvb3QsIGZpZWxkKSB7ICAgXHJcbiAgICB2YXIgZXh0ZW5kZWRUeXBlID0gZmllbGQucGFyZW50Lmxvb2t1cChmaWVsZC5leHRlbmQpO1xyXG4gICAgaWYgKGV4dGVuZGVkVHlwZSkge1xyXG4gICAgICAgIHZhciBzaXN0ZXJGaWVsZCA9IG5ldyBGaWVsZChmaWVsZC5mdWxsTmFtZSwgZmllbGQuaWQsIGZpZWxkLnR5cGUsIGZpZWxkLnJ1bGUsIHVuZGVmaW5lZCwgZmllbGQub3B0aW9ucyk7XHJcbiAgICAgICAgc2lzdGVyRmllbGQuZGVjbGFyaW5nRmllbGQgPSBmaWVsZDtcclxuICAgICAgICBmaWVsZC5leHRlbnNpb25GaWVsZCA9IHNpc3RlckZpZWxkO1xyXG4gICAgICAgIGV4dGVuZGVkVHlwZS5hZGQoc2lzdGVyRmllbGQpO1xyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG59XHJcblxyXG4vKipcclxuICogQ2FsbGVkIHdoZW4gYW55IG9iamVjdCBpcyBhZGRlZCB0byB0aGlzIHJvb3Qgb3IgaXRzIHN1Yi1uYW1lc3BhY2VzLlxyXG4gKiBAcGFyYW0ge1JlZmxlY3Rpb25PYmplY3R9IG9iamVjdCBPYmplY3QgYWRkZWRcclxuICogQHJldHVybnMge3VuZGVmaW5lZH1cclxuICogQHByaXZhdGVcclxuICovXHJcblJvb3QucHJvdG90eXBlLl9oYW5kbGVBZGQgPSBmdW5jdGlvbiBfaGFuZGxlQWRkKG9iamVjdCkge1xyXG4gICAgaWYgKG9iamVjdCBpbnN0YW5jZW9mIEZpZWxkKSB7XHJcblxyXG4gICAgICAgIGlmICgvKiBhbiBleHRlbnNpb24gZmllbGQgKGltcGxpZXMgbm90IHBhcnQgb2YgYSBvbmVvZikgKi8gb2JqZWN0LmV4dGVuZCAhPT0gdW5kZWZpbmVkICYmIC8qIG5vdCBhbHJlYWR5IGhhbmRsZWQgKi8gIW9iamVjdC5leHRlbnNpb25GaWVsZClcclxuICAgICAgICAgICAgaWYgKCF0cnlIYW5kbGVFeHRlbnNpb24odGhpcywgb2JqZWN0KSlcclxuICAgICAgICAgICAgICAgIHRoaXMuZGVmZXJyZWQucHVzaChvYmplY3QpO1xyXG5cclxuICAgIH0gZWxzZSBpZiAob2JqZWN0IGluc3RhbmNlb2YgRW51bSkge1xyXG5cclxuICAgICAgICBpZiAoZXhwb3NlUmUudGVzdChvYmplY3QubmFtZSkpXHJcbiAgICAgICAgICAgIG9iamVjdC5wYXJlbnRbb2JqZWN0Lm5hbWVdID0gb2JqZWN0LnZhbHVlczsgLy8gZXhwb3NlIGVudW0gdmFsdWVzIGFzIHByb3BlcnR5IG9mIGl0cyBwYXJlbnRcclxuXHJcbiAgICB9IGVsc2UgLyogZXZlcnl0aGluZyBlbHNlIGlzIGEgbmFtZXNwYWNlICovIHtcclxuXHJcbiAgICAgICAgaWYgKG9iamVjdCBpbnN0YW5jZW9mIFR5cGUpIC8vIFRyeSB0byBoYW5kbGUgYW55IGRlZmVycmVkIGV4dGVuc2lvbnNcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmRlZmVycmVkLmxlbmd0aDspXHJcbiAgICAgICAgICAgICAgICBpZiAodHJ5SGFuZGxlRXh0ZW5zaW9uKHRoaXMsIHRoaXMuZGVmZXJyZWRbaV0pKVxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmZXJyZWQuc3BsaWNlKGksIDEpO1xyXG4gICAgICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAgICAgICAgICsraTtcclxuICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IC8qIGluaXRpYWxpemVzICovIG9iamVjdC5uZXN0ZWRBcnJheS5sZW5ndGg7ICsraikgLy8gcmVjdXJzZSBpbnRvIHRoZSBuYW1lc3BhY2VcclxuICAgICAgICAgICAgdGhpcy5faGFuZGxlQWRkKG9iamVjdC5fbmVzdGVkQXJyYXlbal0pO1xyXG4gICAgICAgIGlmIChleHBvc2VSZS50ZXN0KG9iamVjdC5uYW1lKSlcclxuICAgICAgICAgICAgb2JqZWN0LnBhcmVudFtvYmplY3QubmFtZV0gPSBvYmplY3Q7IC8vIGV4cG9zZSBuYW1lc3BhY2UgYXMgcHJvcGVydHkgb2YgaXRzIHBhcmVudFxyXG4gICAgfVxyXG5cclxuICAgIC8vIFRoZSBhYm92ZSBhbHNvIGFkZHMgdXBwZXJjYXNlZCAoYW5kIHRodXMgY29uZmxpY3QtZnJlZSkgbmVzdGVkIHR5cGVzLCBzZXJ2aWNlcyBhbmQgZW51bXMgYXNcclxuICAgIC8vIHByb3BlcnRpZXMgb2YgbmFtZXNwYWNlcyBqdXN0IGxpa2Ugc3RhdGljIGNvZGUgZG9lcy4gVGhpcyBhbGxvd3MgdXNpbmcgYSAuZC50cyBnZW5lcmF0ZWQgZm9yXHJcbiAgICAvLyBhIHN0YXRpYyBtb2R1bGUgd2l0aCByZWZsZWN0aW9uLWJhc2VkIHNvbHV0aW9ucyB3aGVyZSB0aGUgY29uZGl0aW9uIGlzIG1ldC5cclxufTtcclxuXHJcbi8qKlxyXG4gKiBDYWxsZWQgd2hlbiBhbnkgb2JqZWN0IGlzIHJlbW92ZWQgZnJvbSB0aGlzIHJvb3Qgb3IgaXRzIHN1Yi1uYW1lc3BhY2VzLlxyXG4gKiBAcGFyYW0ge1JlZmxlY3Rpb25PYmplY3R9IG9iamVjdCBPYmplY3QgcmVtb3ZlZFxyXG4gKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxyXG4gKiBAcHJpdmF0ZVxyXG4gKi9cclxuUm9vdC5wcm90b3R5cGUuX2hhbmRsZVJlbW92ZSA9IGZ1bmN0aW9uIF9oYW5kbGVSZW1vdmUob2JqZWN0KSB7XHJcbiAgICBpZiAob2JqZWN0IGluc3RhbmNlb2YgRmllbGQpIHtcclxuXHJcbiAgICAgICAgaWYgKC8qIGFuIGV4dGVuc2lvbiBmaWVsZCAqLyBvYmplY3QuZXh0ZW5kICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgaWYgKC8qIGFscmVhZHkgaGFuZGxlZCAqLyBvYmplY3QuZXh0ZW5zaW9uRmllbGQpIHsgLy8gcmVtb3ZlIGl0cyBzaXN0ZXIgZmllbGRcclxuICAgICAgICAgICAgICAgIG9iamVjdC5leHRlbnNpb25GaWVsZC5wYXJlbnQucmVtb3ZlKG9iamVjdC5leHRlbnNpb25GaWVsZCk7XHJcbiAgICAgICAgICAgICAgICBvYmplY3QuZXh0ZW5zaW9uRmllbGQgPSBudWxsO1xyXG4gICAgICAgICAgICB9IGVsc2UgeyAvLyBjYW5jZWwgdGhlIGV4dGVuc2lvblxyXG4gICAgICAgICAgICAgICAgdmFyIGluZGV4ID0gdGhpcy5kZWZlcnJlZC5pbmRleE9mKG9iamVjdCk7XHJcbiAgICAgICAgICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xyXG4gICAgICAgICAgICAgICAgaWYgKGluZGV4ID4gLTEpXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZlcnJlZC5zcGxpY2UoaW5kZXgsIDEpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgIH0gZWxzZSBpZiAob2JqZWN0IGluc3RhbmNlb2YgRW51bSkge1xyXG5cclxuICAgICAgICBpZiAoZXhwb3NlUmUudGVzdChvYmplY3QubmFtZSkpXHJcbiAgICAgICAgICAgIGRlbGV0ZSBvYmplY3QucGFyZW50W29iamVjdC5uYW1lXTsgLy8gdW5leHBvc2UgZW51bSB2YWx1ZXNcclxuXHJcbiAgICB9IGVsc2UgaWYgKG9iamVjdCBpbnN0YW5jZW9mIE5hbWVzcGFjZSkge1xyXG5cclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IC8qIGluaXRpYWxpemVzICovIG9iamVjdC5uZXN0ZWRBcnJheS5sZW5ndGg7ICsraSkgLy8gcmVjdXJzZSBpbnRvIHRoZSBuYW1lc3BhY2VcclxuICAgICAgICAgICAgdGhpcy5faGFuZGxlUmVtb3ZlKG9iamVjdC5fbmVzdGVkQXJyYXlbaV0pO1xyXG5cclxuICAgICAgICBpZiAoZXhwb3NlUmUudGVzdChvYmplY3QubmFtZSkpXHJcbiAgICAgICAgICAgIGRlbGV0ZSBvYmplY3QucGFyZW50W29iamVjdC5uYW1lXTsgLy8gdW5leHBvc2UgbmFtZXNwYWNlc1xyXG5cclxuICAgIH1cclxufTtcclxuXHJcblJvb3QuX2NvbmZpZ3VyZSA9IGZ1bmN0aW9uKFR5cGVfLCBwYXJzZV8sIGNvbW1vbl8pIHtcclxuICAgIFR5cGUgPSBUeXBlXztcclxuICAgIHBhcnNlID0gcGFyc2VfO1xyXG4gICAgY29tbW9uID0gY29tbW9uXztcclxufTtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4vKipcclxuICogU3RyZWFtaW5nIFJQQyBoZWxwZXJzLlxyXG4gKiBAbmFtZXNwYWNlXHJcbiAqL1xyXG52YXIgcnBjID0gZXhwb3J0cztcclxuXHJcbi8qKlxyXG4gKiBSUEMgaW1wbGVtZW50YXRpb24gcGFzc2VkIHRvIHtAbGluayBTZXJ2aWNlI2NyZWF0ZX0gcGVyZm9ybWluZyBhIHNlcnZpY2UgcmVxdWVzdCBvbiBuZXR3b3JrIGxldmVsLCBpLmUuIGJ5IHV0aWxpemluZyBodHRwIHJlcXVlc3RzIG9yIHdlYnNvY2tldHMuXHJcbiAqIEB0eXBlZGVmIFJQQ0ltcGxcclxuICogQHR5cGUge2Z1bmN0aW9ufVxyXG4gKiBAcGFyYW0ge01ldGhvZHxycGMuU2VydmljZU1ldGhvZH0gbWV0aG9kIFJlZmxlY3RlZCBvciBzdGF0aWMgbWV0aG9kIGJlaW5nIGNhbGxlZFxyXG4gKiBAcGFyYW0ge1VpbnQ4QXJyYXl9IHJlcXVlc3REYXRhIFJlcXVlc3QgZGF0YVxyXG4gKiBAcGFyYW0ge1JQQ0ltcGxDYWxsYmFja30gY2FsbGJhY2sgQ2FsbGJhY2sgZnVuY3Rpb25cclxuICogQHJldHVybnMge3VuZGVmaW5lZH1cclxuICogQGV4YW1wbGVcclxuICogZnVuY3Rpb24gcnBjSW1wbChtZXRob2QsIHJlcXVlc3REYXRhLCBjYWxsYmFjaykge1xyXG4gKiAgICAgaWYgKHByb3RvYnVmLnV0aWwubGNGaXJzdChtZXRob2QubmFtZSkgIT09IFwibXlNZXRob2RcIikgLy8gY29tcGF0aWJsZSB3aXRoIHN0YXRpYyBjb2RlXHJcbiAqICAgICAgICAgdGhyb3cgRXJyb3IoXCJubyBzdWNoIG1ldGhvZFwiKTtcclxuICogICAgIGFzeW5jaHJvbm91c2x5T2J0YWluQVJlc3BvbnNlKHJlcXVlc3REYXRhLCBmdW5jdGlvbihlcnIsIHJlc3BvbnNlRGF0YSkge1xyXG4gKiAgICAgICAgIGNhbGxiYWNrKGVyciwgcmVzcG9uc2VEYXRhKTtcclxuICogICAgIH0pO1xyXG4gKiB9XHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIE5vZGUtc3R5bGUgY2FsbGJhY2sgYXMgdXNlZCBieSB7QGxpbmsgUlBDSW1wbH0uXHJcbiAqIEB0eXBlZGVmIFJQQ0ltcGxDYWxsYmFja1xyXG4gKiBAdHlwZSB7ZnVuY3Rpb259XHJcbiAqIEBwYXJhbSB7P0Vycm9yfSBlcnJvciBFcnJvciwgaWYgYW55LCBvdGhlcndpc2UgYG51bGxgXHJcbiAqIEBwYXJhbSB7P1VpbnQ4QXJyYXl9IFtyZXNwb25zZV0gUmVzcG9uc2UgZGF0YSBvciBgbnVsbGAgdG8gc2lnbmFsIGVuZCBvZiBzdHJlYW0sIGlmIHRoZXJlIGhhc24ndCBiZWVuIGFuIGVycm9yXHJcbiAqIEByZXR1cm5zIHt1bmRlZmluZWR9XHJcbiAqL1xyXG5cclxucnBjLlNlcnZpY2UgPSByZXF1aXJlKFwiLi9ycGMvc2VydmljZVwiKTtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbm1vZHVsZS5leHBvcnRzID0gU2VydmljZTtcclxuXHJcbnZhciB1dGlsID0gcmVxdWlyZShcIi4uL3V0aWwvbWluaW1hbFwiKTtcclxuXHJcbi8vIEV4dGVuZHMgRXZlbnRFbWl0dGVyXHJcbihTZXJ2aWNlLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUodXRpbC5FdmVudEVtaXR0ZXIucHJvdG90eXBlKSkuY29uc3RydWN0b3IgPSBTZXJ2aWNlO1xyXG5cclxuLyoqXHJcbiAqIEEgc2VydmljZSBtZXRob2QgY2FsbGJhY2sgYXMgdXNlZCBieSB7QGxpbmsgcnBjLlNlcnZpY2VNZXRob2R8U2VydmljZU1ldGhvZH0uXHJcbiAqIFxyXG4gKiBEaWZmZXJzIGZyb20ge0BsaW5rIFJQQ0ltcGxDYWxsYmFja30gaW4gdGhhdCBpdCBpcyBhbiBhY3R1YWwgY2FsbGJhY2sgb2YgYSBzZXJ2aWNlIG1ldGhvZCB3aGljaCBtYXkgbm90IHJldHVybiBgcmVzcG9uc2UgPSBudWxsYC5cclxuICogQHR5cGVkZWYgcnBjLlNlcnZpY2VNZXRob2RDYWxsYmFja1xyXG4gKiBAdHlwZSB7ZnVuY3Rpb259XHJcbiAqIEBwYXJhbSB7P0Vycm9yfSBlcnJvciBFcnJvciwgaWYgYW55XHJcbiAqIEBwYXJhbSB7P01lc3NhZ2V9IFtyZXNwb25zZV0gUmVzcG9uc2UgbWVzc2FnZVxyXG4gKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBBIHNlcnZpY2UgbWV0aG9kIHBhcnQgb2YgYSB7QGxpbmsgcnBjLlNlcnZpY2VNZXRob2RNaXhpbnxTZXJ2aWNlTWV0aG9kTWl4aW59IGFuZCB0aHVzIHtAbGluayBycGMuU2VydmljZX0gYXMgY3JlYXRlZCBieSB7QGxpbmsgU2VydmljZS5jcmVhdGV9LlxyXG4gKiBAdHlwZWRlZiBycGMuU2VydmljZU1ldGhvZFxyXG4gKiBAdHlwZSB7ZnVuY3Rpb259XHJcbiAqIEBwYXJhbSB7TWVzc2FnZXxPYmplY3R9IHJlcXVlc3QgUmVxdWVzdCBtZXNzYWdlIG9yIHBsYWluIG9iamVjdFxyXG4gKiBAcGFyYW0ge3JwYy5TZXJ2aWNlTWV0aG9kQ2FsbGJhY2t9IFtjYWxsYmFja10gTm9kZS1zdHlsZSBjYWxsYmFjayBjYWxsZWQgd2l0aCB0aGUgZXJyb3IsIGlmIGFueSwgYW5kIHRoZSByZXNwb25zZSBtZXNzYWdlXHJcbiAqIEByZXR1cm5zIHtQcm9taXNlPE1lc3NhZ2U+fSBQcm9taXNlIGlmIGBjYWxsYmFja2AgaGFzIGJlZW4gb21pdHRlZCwgb3RoZXJ3aXNlIGB1bmRlZmluZWRgXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIEEgc2VydmljZSBtZXRob2QgbWl4aW4uXHJcbiAqIFxyXG4gKiBXaGVuIHVzaW5nIFR5cGVTY3JpcHQsIG1peGVkIGluIHNlcnZpY2UgbWV0aG9kcyBhcmUgb25seSBzdXBwb3J0ZWQgZGlyZWN0bHkgd2l0aCBhIHR5cGUgZGVmaW5pdGlvbiBvZiBhIHN0YXRpYyBtb2R1bGUgKHVzZWQgd2l0aCByZWZsZWN0aW9uKS4gT3RoZXJ3aXNlLCBleHBsaWNpdCBjYXN0aW5nIGlzIHJlcXVpcmVkLlxyXG4gKiBAdHlwZWRlZiBycGMuU2VydmljZU1ldGhvZE1peGluXHJcbiAqIEB0eXBlIHtPYmplY3QuPHN0cmluZyxycGMuU2VydmljZU1ldGhvZD59XHJcbiAqIEBleGFtcGxlXHJcbiAqIC8vIEV4cGxpY2l0IGNhc3Rpbmcgd2l0aCBUeXBlU2NyaXB0XHJcbiAqIChteVJwY1NlcnZpY2VbXCJteU1ldGhvZFwiXSBhcyBwcm90b2J1Zi5ycGMuU2VydmljZU1ldGhvZCkoLi4uKVxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBDb25zdHJ1Y3RzIGEgbmV3IFJQQyBzZXJ2aWNlIGluc3RhbmNlLlxyXG4gKiBAY2xhc3NkZXNjIEFuIFJQQyBzZXJ2aWNlIGFzIHJldHVybmVkIGJ5IHtAbGluayBTZXJ2aWNlI2NyZWF0ZX0uXHJcbiAqIEBleHBvcnRzIHJwYy5TZXJ2aWNlXHJcbiAqIEBleHRlbmRzIHV0aWwuRXZlbnRFbWl0dGVyXHJcbiAqIEBhdWdtZW50cyBycGMuU2VydmljZU1ldGhvZE1peGluXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKiBAcGFyYW0ge1JQQ0ltcGx9IHJwY0ltcGwgUlBDIGltcGxlbWVudGF0aW9uXHJcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW3JlcXVlc3REZWxpbWl0ZWQ9ZmFsc2VdIFdoZXRoZXIgcmVxdWVzdHMgYXJlIGxlbmd0aC1kZWxpbWl0ZWRcclxuICogQHBhcmFtIHtib29sZWFufSBbcmVzcG9uc2VEZWxpbWl0ZWQ9ZmFsc2VdIFdoZXRoZXIgcmVzcG9uc2VzIGFyZSBsZW5ndGgtZGVsaW1pdGVkXHJcbiAqL1xyXG5mdW5jdGlvbiBTZXJ2aWNlKHJwY0ltcGwsIHJlcXVlc3REZWxpbWl0ZWQsIHJlc3BvbnNlRGVsaW1pdGVkKSB7XHJcblxyXG4gICAgaWYgKHR5cGVvZiBycGNJbXBsICE9PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgdGhyb3cgVHlwZUVycm9yKFwicnBjSW1wbCBtdXN0IGJlIGEgZnVuY3Rpb25cIik7XHJcblxyXG4gICAgdXRpbC5FdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJQQyBpbXBsZW1lbnRhdGlvbi4gQmVjb21lcyBgbnVsbGAgb25jZSB0aGUgc2VydmljZSBpcyBlbmRlZC5cclxuICAgICAqIEB0eXBlIHs/UlBDSW1wbH1cclxuICAgICAqL1xyXG4gICAgdGhpcy5ycGNJbXBsID0gcnBjSW1wbDtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFdoZXRoZXIgcmVxdWVzdHMgYXJlIGxlbmd0aC1kZWxpbWl0ZWQuXHJcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cclxuICAgICAqL1xyXG4gICAgdGhpcy5yZXF1ZXN0RGVsaW1pdGVkID0gQm9vbGVhbihyZXF1ZXN0RGVsaW1pdGVkKTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFdoZXRoZXIgcmVzcG9uc2VzIGFyZSBsZW5ndGgtZGVsaW1pdGVkLlxyXG4gICAgICogQHR5cGUge2Jvb2xlYW59XHJcbiAgICAgKi9cclxuICAgIHRoaXMucmVzcG9uc2VEZWxpbWl0ZWQgPSBCb29sZWFuKHJlc3BvbnNlRGVsaW1pdGVkKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENhbGxzIGEgc2VydmljZSBtZXRob2QgdGhyb3VnaCB7QGxpbmsgcnBjLlNlcnZpY2UjcnBjSW1wbHxycGNJbXBsfS5cclxuICogQHBhcmFtIHtNZXRob2R8cnBjLlNlcnZpY2VNZXRob2R9IG1ldGhvZCBSZWZsZWN0ZWQgb3Igc3RhdGljIG1ldGhvZFxyXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSByZXF1ZXN0Q3RvciBSZXF1ZXN0IGNvbnN0cnVjdG9yXHJcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IHJlc3BvbnNlQ3RvciBSZXNwb25zZSBjb25zdHJ1Y3RvclxyXG4gKiBAcGFyYW0ge01lc3NhZ2V8T2JqZWN0fSByZXF1ZXN0IFJlcXVlc3QgbWVzc2FnZSBvciBwbGFpbiBvYmplY3RcclxuICogQHBhcmFtIHtycGMuU2VydmljZU1ldGhvZENhbGxiYWNrfSBjYWxsYmFjayBTZXJ2aWNlIGNhbGxiYWNrXHJcbiAqIEByZXR1cm5zIHt1bmRlZmluZWR9XHJcbiAqL1xyXG5TZXJ2aWNlLnByb3RvdHlwZS5ycGNDYWxsID0gZnVuY3Rpb24gcnBjQ2FsbChtZXRob2QsIHJlcXVlc3RDdG9yLCByZXNwb25zZUN0b3IsIHJlcXVlc3QsIGNhbGxiYWNrKSB7XHJcblxyXG4gICAgaWYgKCFyZXF1ZXN0KVxyXG4gICAgICAgIHRocm93IFR5cGVFcnJvcihcInJlcXVlc3QgbXVzdCBiZSBzcGVjaWZpZWRcIik7XHJcblxyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG4gICAgaWYgKCFjYWxsYmFjaylcclxuICAgICAgICByZXR1cm4gdXRpbC5hc1Byb21pc2UocnBjQ2FsbCwgc2VsZiwgbWV0aG9kLCByZXF1ZXN0Q3RvciwgcmVzcG9uc2VDdG9yLCByZXF1ZXN0KTtcclxuXHJcbiAgICBpZiAoIXNlbGYucnBjSW1wbCkge1xyXG4gICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7IGNhbGxiYWNrKEVycm9yKFwiYWxyZWFkeSBlbmRlZFwiKSk7IH0sIDApO1xyXG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICB9XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgICByZXR1cm4gc2VsZi5ycGNJbXBsKFxyXG4gICAgICAgICAgICBtZXRob2QsXHJcbiAgICAgICAgICAgIHJlcXVlc3RDdG9yW3NlbGYucmVxdWVzdERlbGltaXRlZCA/IFwiZW5jb2RlRGVsaW1pdGVkXCIgOiBcImVuY29kZVwiXShyZXF1ZXN0KS5maW5pc2goKSxcclxuICAgICAgICAgICAgZnVuY3Rpb24gcnBjQ2FsbGJhY2soZXJyLCByZXNwb25zZSkge1xyXG5cclxuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICBzZWxmLmVtaXQoXCJlcnJvclwiLCBlcnIsIG1ldGhvZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKHJlc3BvbnNlID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5lbmQoLyogZW5kZWRCeVJQQyAqLyB0cnVlKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGlmICghKHJlc3BvbnNlIGluc3RhbmNlb2YgcmVzcG9uc2VDdG9yKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlID0gcmVzcG9uc2VDdG9yW3NlbGYucmVzcG9uc2VEZWxpbWl0ZWQgPyBcImRlY29kZURlbGltaXRlZFwiIDogXCJkZWNvZGVcIl0ocmVzcG9uc2UpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLmVtaXQoXCJlcnJvclwiLCBlcnIsIG1ldGhvZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBzZWxmLmVtaXQoXCJkYXRhXCIsIHJlc3BvbnNlLCBtZXRob2QpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKG51bGwsIHJlc3BvbnNlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICk7XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgICBzZWxmLmVtaXQoXCJlcnJvclwiLCBlcnIsIG1ldGhvZCk7XHJcbiAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHsgY2FsbGJhY2soZXJyKTsgfSwgMCk7XHJcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBFbmRzIHRoaXMgc2VydmljZSBhbmQgZW1pdHMgdGhlIGBlbmRgIGV2ZW50LlxyXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtlbmRlZEJ5UlBDPWZhbHNlXSBXaGV0aGVyIHRoZSBzZXJ2aWNlIGhhcyBiZWVuIGVuZGVkIGJ5IHRoZSBSUEMgaW1wbGVtZW50YXRpb24uXHJcbiAqIEByZXR1cm5zIHtycGMuU2VydmljZX0gYHRoaXNgXHJcbiAqL1xyXG5TZXJ2aWNlLnByb3RvdHlwZS5lbmQgPSBmdW5jdGlvbiBlbmQoZW5kZWRCeVJQQykge1xyXG4gICAgaWYgKHRoaXMucnBjSW1wbCkge1xyXG4gICAgICAgIGlmICghZW5kZWRCeVJQQykgLy8gc2lnbmFsIGVuZCB0byBycGNJbXBsXHJcbiAgICAgICAgICAgIHRoaXMucnBjSW1wbChudWxsLCBudWxsLCBudWxsKTtcclxuICAgICAgICB0aGlzLnJwY0ltcGwgPSBudWxsO1xyXG4gICAgICAgIHRoaXMuZW1pdChcImVuZFwiKS5vZmYoKTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzO1xyXG59O1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxubW9kdWxlLmV4cG9ydHMgPSBTZXJ2aWNlO1xyXG5cclxuLy8gZXh0ZW5kcyBOYW1lc3BhY2VcclxudmFyIE5hbWVzcGFjZSA9IHJlcXVpcmUoXCIuL25hbWVzcGFjZVwiKTtcclxuKChTZXJ2aWNlLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoTmFtZXNwYWNlLnByb3RvdHlwZSkpLmNvbnN0cnVjdG9yID0gU2VydmljZSkuY2xhc3NOYW1lID0gXCJTZXJ2aWNlXCI7XHJcblxyXG52YXIgTWV0aG9kID0gcmVxdWlyZShcIi4vbWV0aG9kXCIpLFxyXG4gICAgdXRpbCAgID0gcmVxdWlyZShcIi4vdXRpbFwiKSxcclxuICAgIHJwYyAgICA9IHJlcXVpcmUoXCIuL3JwY1wiKTtcclxuXHJcbi8qKlxyXG4gKiBDb25zdHJ1Y3RzIGEgbmV3IHNlcnZpY2UgaW5zdGFuY2UuXHJcbiAqIEBjbGFzc2Rlc2MgUmVmbGVjdGVkIHNlcnZpY2UuXHJcbiAqIEBleHRlbmRzIE5hbWVzcGFjZUJhc2VcclxuICogQGNvbnN0cnVjdG9yXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIFNlcnZpY2UgbmFtZVxyXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCo+fSBbb3B0aW9uc10gU2VydmljZSBvcHRpb25zXHJcbiAqIEB0aHJvd3Mge1R5cGVFcnJvcn0gSWYgYXJndW1lbnRzIGFyZSBpbnZhbGlkXHJcbiAqL1xyXG5mdW5jdGlvbiBTZXJ2aWNlKG5hbWUsIG9wdGlvbnMpIHtcclxuICAgIE5hbWVzcGFjZS5jYWxsKHRoaXMsIG5hbWUsIG9wdGlvbnMpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2VydmljZSBtZXRob2RzLlxyXG4gICAgICogQHR5cGUge09iamVjdC48c3RyaW5nLE1ldGhvZD59XHJcbiAgICAgKi9cclxuICAgIHRoaXMubWV0aG9kcyA9IHt9OyAvLyB0b0pTT04sIG1hcmtlclxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2FjaGVkIG1ldGhvZHMgYXMgYW4gYXJyYXkuXHJcbiAgICAgKiBAdHlwZSB7P01ldGhvZFtdfVxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqL1xyXG4gICAgdGhpcy5fbWV0aG9kc0FycmF5ID0gbnVsbDtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvbnN0cnVjdHMgYSBzZXJ2aWNlIGZyb20gSlNPTi5cclxuICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgU2VydmljZSBuYW1lXHJcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsKj59IGpzb24gSlNPTiBvYmplY3RcclxuICogQHJldHVybnMge1NlcnZpY2V9IENyZWF0ZWQgc2VydmljZVxyXG4gKiBAdGhyb3dzIHtUeXBlRXJyb3J9IElmIGFyZ3VtZW50cyBhcmUgaW52YWxpZFxyXG4gKi9cclxuU2VydmljZS5mcm9tSlNPTiA9IGZ1bmN0aW9uIGZyb21KU09OKG5hbWUsIGpzb24pIHtcclxuICAgIHZhciBzZXJ2aWNlID0gbmV3IFNlcnZpY2UobmFtZSwganNvbi5vcHRpb25zKTtcclxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICovXHJcbiAgICBpZiAoanNvbi5tZXRob2RzKVxyXG4gICAgICAgIGZvciAodmFyIG5hbWVzID0gT2JqZWN0LmtleXMoanNvbi5tZXRob2RzKSwgaSA9IDA7IGkgPCBuYW1lcy5sZW5ndGg7ICsraSlcclxuICAgICAgICAgICAgc2VydmljZS5hZGQoTWV0aG9kLmZyb21KU09OKG5hbWVzW2ldLCBqc29uLm1ldGhvZHNbbmFtZXNbaV1dKSk7XHJcbiAgICByZXR1cm4gc2VydmljZTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBNZXRob2RzIG9mIHRoaXMgc2VydmljZSBhcyBhbiBhcnJheSBmb3IgaXRlcmF0aW9uLlxyXG4gKiBAbmFtZSBTZXJ2aWNlI21ldGhvZHNBcnJheVxyXG4gKiBAdHlwZSB7TWV0aG9kW119XHJcbiAqIEByZWFkb25seVxyXG4gKi9cclxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFNlcnZpY2UucHJvdG90eXBlLCBcIm1ldGhvZHNBcnJheVwiLCB7XHJcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9tZXRob2RzQXJyYXkgfHwgKHRoaXMuX21ldGhvZHNBcnJheSA9IHV0aWwudG9BcnJheSh0aGlzLm1ldGhvZHMpKTtcclxuICAgIH1cclxufSk7XHJcblxyXG5mdW5jdGlvbiBjbGVhckNhY2hlKHNlcnZpY2UpIHtcclxuICAgIHNlcnZpY2UuX21ldGhvZHNBcnJheSA9IG51bGw7XHJcbiAgICByZXR1cm4gc2VydmljZTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEBvdmVycmlkZVxyXG4gKi9cclxuU2VydmljZS5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gdG9KU09OKCkge1xyXG4gICAgdmFyIGluaGVyaXRlZCA9IE5hbWVzcGFjZS5wcm90b3R5cGUudG9KU09OLmNhbGwodGhpcyk7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIG9wdGlvbnMgOiBpbmhlcml0ZWQgJiYgaW5oZXJpdGVkLm9wdGlvbnMgfHwgdW5kZWZpbmVkLFxyXG4gICAgICAgIG1ldGhvZHMgOiBOYW1lc3BhY2UuYXJyYXlUb0pTT04odGhpcy5tZXRob2RzQXJyYXkpIHx8IC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovIHt9LFxyXG4gICAgICAgIG5lc3RlZCAgOiBpbmhlcml0ZWQgJiYgaW5oZXJpdGVkLm5lc3RlZCB8fCB1bmRlZmluZWRcclxuICAgIH07XHJcbn07XHJcblxyXG4vKipcclxuICogQG92ZXJyaWRlXHJcbiAqL1xyXG5TZXJ2aWNlLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiBnZXQobmFtZSkge1xyXG4gICAgcmV0dXJuIHRoaXMubWV0aG9kc1tuYW1lXVxyXG4gICAgICAgIHx8IE5hbWVzcGFjZS5wcm90b3R5cGUuZ2V0LmNhbGwodGhpcywgbmFtZSk7XHJcbn07XHJcblxyXG4vKipcclxuICogQG92ZXJyaWRlXHJcbiAqL1xyXG5TZXJ2aWNlLnByb3RvdHlwZS5yZXNvbHZlQWxsID0gZnVuY3Rpb24gcmVzb2x2ZUFsbCgpIHtcclxuICAgIHZhciBtZXRob2RzID0gdGhpcy5tZXRob2RzQXJyYXk7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1ldGhvZHMubGVuZ3RoOyArK2kpXHJcbiAgICAgICAgbWV0aG9kc1tpXS5yZXNvbHZlKCk7XHJcbiAgICByZXR1cm4gTmFtZXNwYWNlLnByb3RvdHlwZS5yZXNvbHZlLmNhbGwodGhpcyk7XHJcbn07XHJcblxyXG4vKipcclxuICogQG92ZXJyaWRlXHJcbiAqL1xyXG5TZXJ2aWNlLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiBhZGQob2JqZWN0KSB7XHJcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgaWYgKHRoaXMuZ2V0KG9iamVjdC5uYW1lKSlcclxuICAgICAgICB0aHJvdyBFcnJvcihcImR1cGxpY2F0ZSBuYW1lICdcIiArIG9iamVjdC5uYW1lICsgXCInIGluIFwiICsgdGhpcyk7XHJcbiAgICBpZiAob2JqZWN0IGluc3RhbmNlb2YgTWV0aG9kKSB7XHJcbiAgICAgICAgdGhpcy5tZXRob2RzW29iamVjdC5uYW1lXSA9IG9iamVjdDtcclxuICAgICAgICBvYmplY3QucGFyZW50ID0gdGhpcztcclxuICAgICAgICByZXR1cm4gY2xlYXJDYWNoZSh0aGlzKTtcclxuICAgIH1cclxuICAgIHJldHVybiBOYW1lc3BhY2UucHJvdG90eXBlLmFkZC5jYWxsKHRoaXMsIG9iamVjdCk7XHJcbn07XHJcblxyXG4vKipcclxuICogQG92ZXJyaWRlXHJcbiAqL1xyXG5TZXJ2aWNlLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbiByZW1vdmUob2JqZWN0KSB7XHJcbiAgICBpZiAob2JqZWN0IGluc3RhbmNlb2YgTWV0aG9kKSB7XHJcblxyXG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICAgICAgaWYgKHRoaXMubWV0aG9kc1tvYmplY3QubmFtZV0gIT09IG9iamVjdClcclxuICAgICAgICAgICAgdGhyb3cgRXJyb3Iob2JqZWN0ICsgXCIgaXMgbm90IGEgbWVtYmVyIG9mIFwiICsgdGhpcyk7XHJcblxyXG4gICAgICAgIGRlbGV0ZSB0aGlzLm1ldGhvZHNbb2JqZWN0Lm5hbWVdO1xyXG4gICAgICAgIG9iamVjdC5wYXJlbnQgPSBudWxsO1xyXG4gICAgICAgIHJldHVybiBjbGVhckNhY2hlKHRoaXMpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIE5hbWVzcGFjZS5wcm90b3R5cGUucmVtb3ZlLmNhbGwodGhpcywgb2JqZWN0KTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDcmVhdGVzIGEgcnVudGltZSBzZXJ2aWNlIHVzaW5nIHRoZSBzcGVjaWZpZWQgcnBjIGltcGxlbWVudGF0aW9uLlxyXG4gKiBAcGFyYW0ge1JQQ0ltcGx9IHJwY0ltcGwgUlBDIGltcGxlbWVudGF0aW9uXHJcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW3JlcXVlc3REZWxpbWl0ZWQ9ZmFsc2VdIFdoZXRoZXIgcmVxdWVzdHMgYXJlIGxlbmd0aC1kZWxpbWl0ZWRcclxuICogQHBhcmFtIHtib29sZWFufSBbcmVzcG9uc2VEZWxpbWl0ZWQ9ZmFsc2VdIFdoZXRoZXIgcmVzcG9uc2VzIGFyZSBsZW5ndGgtZGVsaW1pdGVkXHJcbiAqIEByZXR1cm5zIHtycGMuU2VydmljZX0gUlBDIHNlcnZpY2UuIFVzZWZ1bCB3aGVyZSByZXF1ZXN0cyBhbmQvb3IgcmVzcG9uc2VzIGFyZSBzdHJlYW1lZC5cclxuICovXHJcblNlcnZpY2UucHJvdG90eXBlLmNyZWF0ZSA9IGZ1bmN0aW9uIGNyZWF0ZShycGNJbXBsLCByZXF1ZXN0RGVsaW1pdGVkLCByZXNwb25zZURlbGltaXRlZCkge1xyXG4gICAgdmFyIHJwY1NlcnZpY2UgPSBuZXcgcnBjLlNlcnZpY2UocnBjSW1wbCwgcmVxdWVzdERlbGltaXRlZCwgcmVzcG9uc2VEZWxpbWl0ZWQpO1xyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCAvKiBpbml0aWFsaXplcyAqLyB0aGlzLm1ldGhvZHNBcnJheS5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgIHJwY1NlcnZpY2VbdXRpbC5sY0ZpcnN0KHRoaXMuX21ldGhvZHNBcnJheVtpXS5yZXNvbHZlKCkubmFtZSldID0gdXRpbC5jb2RlZ2VuKFwiclwiLFwiY1wiKShcInJldHVybiB0aGlzLnJwY0NhbGwobSxxLHMscixjKVwiKS5lb2YodXRpbC5sY0ZpcnN0KHRoaXMuX21ldGhvZHNBcnJheVtpXS5uYW1lKSwge1xyXG4gICAgICAgICAgICBtOiB0aGlzLl9tZXRob2RzQXJyYXlbaV0sXHJcbiAgICAgICAgICAgIHE6IHRoaXMuX21ldGhvZHNBcnJheVtpXS5yZXNvbHZlZFJlcXVlc3RUeXBlLmN0b3IsXHJcbiAgICAgICAgICAgIHM6IHRoaXMuX21ldGhvZHNBcnJheVtpXS5yZXNvbHZlZFJlc3BvbnNlVHlwZS5jdG9yXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcnBjU2VydmljZTtcclxufTtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbm1vZHVsZS5leHBvcnRzID0gdG9rZW5pemU7XHJcblxyXG52YXIgZGVsaW1SZSAgICAgICAgPSAvW1xcc3t9PTs6W1xcXSwnXCIoKTw+XS9nLFxyXG4gICAgc3RyaW5nRG91YmxlUmUgPSAvKD86XCIoW15cIlxcXFxdKig/OlxcXFwuW15cIlxcXFxdKikqKVwiKS9nLFxyXG4gICAgc3RyaW5nU2luZ2xlUmUgPSAvKD86JyhbXidcXFxcXSooPzpcXFxcLlteJ1xcXFxdKikqKScpL2c7XHJcblxyXG4vKipcclxuICogVW5lc2NhcGVzIGEgc3RyaW5nLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyIFN0cmluZyB0byB1bmVzY2FwZVxyXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBVbmVzY2FwZWQgc3RyaW5nXHJcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0LjxzdHJpbmcsc3RyaW5nPn0gbWFwIFNwZWNpYWwgY2hhcmFjdGVycyBtYXBcclxuICogQGlnbm9yZVxyXG4gKi9cclxuZnVuY3Rpb24gdW5lc2NhcGUoc3RyKSB7XHJcbiAgICByZXR1cm4gc3RyLnJlcGxhY2UoL1xcXFwoLj8pL2csIGZ1bmN0aW9uKCQwLCAkMSkge1xyXG4gICAgICAgIHN3aXRjaCAoJDEpIHtcclxuICAgICAgICAgICAgY2FzZSBcIlxcXFxcIjpcclxuICAgICAgICAgICAgY2FzZSBcIlwiOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuICQxO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHVuZXNjYXBlLm1hcFskMV0gfHwgXCJcIjtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxufVxyXG5cclxudW5lc2NhcGUubWFwID0ge1xyXG4gICAgXCIwXCI6IFwiXFwwXCIsXHJcbiAgICBcInJcIjogXCJcXHJcIixcclxuICAgIFwiblwiOiBcIlxcblwiLFxyXG4gICAgXCJ0XCI6IFwiXFx0XCJcclxufTtcclxuXHJcbnRva2VuaXplLnVuZXNjYXBlID0gdW5lc2NhcGU7XHJcblxyXG4vKipcclxuICogSGFuZGxlIG9iamVjdCByZXR1cm5lZCBmcm9tIHtAbGluayB0b2tlbml6ZX0uXHJcbiAqIEB0eXBlZGVmIHtPYmplY3QuPHN0cmluZywqPn0gVG9rZW5pemVySGFuZGxlXHJcbiAqIEBwcm9wZXJ0eSB7ZnVuY3Rpb24oKTpudW1iZXJ9IGxpbmUgR2V0cyB0aGUgY3VycmVudCBsaW5lIG51bWJlclxyXG4gKiBAcHJvcGVydHkge2Z1bmN0aW9uKCk6P3N0cmluZ30gbmV4dCBHZXRzIHRoZSBuZXh0IHRva2VuIGFuZCBhZHZhbmNlcyAoYG51bGxgIG9uIGVvZilcclxuICogQHByb3BlcnR5IHtmdW5jdGlvbigpOj9zdHJpbmd9IHBlZWsgUGVla3MgZm9yIHRoZSBuZXh0IHRva2VuIChgbnVsbGAgb24gZW9mKVxyXG4gKiBAcHJvcGVydHkge2Z1bmN0aW9uKHN0cmluZyl9IHB1c2ggUHVzaGVzIGEgdG9rZW4gYmFjayB0byB0aGUgc3RhY2tcclxuICogQHByb3BlcnR5IHtmdW5jdGlvbihzdHJpbmcsIGJvb2xlYW49KTpib29sZWFufSBza2lwIFNraXBzIGEgdG9rZW4sIHJldHVybnMgaXRzIHByZXNlbmNlIGFuZCBhZHZhbmNlcyBvciwgaWYgbm9uLW9wdGlvbmFsIGFuZCBub3QgcHJlc2VudCwgdGhyb3dzXHJcbiAqIEBwcm9wZXJ0eSB7ZnVuY3Rpb24obnVtYmVyPSk6P3N0cmluZ30gY21udCBHZXRzIHRoZSBjb21tZW50IG9uIHRoZSBwcmV2aW91cyBsaW5lIG9yIHRoZSBsaW5lIGNvbW1lbnQgb24gdGhlIHNwZWNpZmllZCBsaW5lLCBpZiBhbnlcclxuICovXHJcblxyXG4vKipcclxuICogVG9rZW5pemVzIHRoZSBnaXZlbiAucHJvdG8gc291cmNlIGFuZCByZXR1cm5zIGFuIG9iamVjdCB3aXRoIHVzZWZ1bCB1dGlsaXR5IGZ1bmN0aW9ucy5cclxuICogQHBhcmFtIHtzdHJpbmd9IHNvdXJjZSBTb3VyY2UgY29udGVudHNcclxuICogQHJldHVybnMge1Rva2VuaXplckhhbmRsZX0gVG9rZW5pemVyIGhhbmRsZVxyXG4gKiBAcHJvcGVydHkge2Z1bmN0aW9uKHN0cmluZyk6c3RyaW5nfSB1bmVzY2FwZSBVbmVzY2FwZXMgYSBzdHJpbmdcclxuICovXHJcbmZ1bmN0aW9uIHRva2VuaXplKHNvdXJjZSkge1xyXG4gICAgLyogZXNsaW50LWRpc2FibGUgY2FsbGJhY2stcmV0dXJuICovXHJcbiAgICBzb3VyY2UgPSBzb3VyY2UudG9TdHJpbmcoKTtcclxuXHJcbiAgICB2YXIgb2Zmc2V0ID0gMCxcclxuICAgICAgICBsZW5ndGggPSBzb3VyY2UubGVuZ3RoLFxyXG4gICAgICAgIGxpbmUgPSAxLFxyXG4gICAgICAgIGNvbW1lbnRUeXBlID0gbnVsbCxcclxuICAgICAgICBjb21tZW50VGV4dCA9IG51bGwsXHJcbiAgICAgICAgY29tbWVudExpbmUgPSAwO1xyXG5cclxuICAgIHZhciBzdGFjayA9IFtdO1xyXG5cclxuICAgIHZhciBzdHJpbmdEZWxpbSA9IG51bGw7XHJcblxyXG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhbiBlcnJvciBmb3IgaWxsZWdhbCBzeW50YXguXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3ViamVjdCBTdWJqZWN0XHJcbiAgICAgKiBAcmV0dXJucyB7RXJyb3J9IEVycm9yIGNyZWF0ZWRcclxuICAgICAqIEBpbm5lclxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBpbGxlZ2FsKHN1YmplY3QpIHtcclxuICAgICAgICByZXR1cm4gRXJyb3IoXCJpbGxlZ2FsIFwiICsgc3ViamVjdCArIFwiIChsaW5lIFwiICsgbGluZSArIFwiKVwiKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlYWRzIGEgc3RyaW5nIHRpbGwgaXRzIGVuZC5cclxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFN0cmluZyByZWFkXHJcbiAgICAgKiBAaW5uZXJcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gcmVhZFN0cmluZygpIHtcclxuICAgICAgICB2YXIgcmUgPSBzdHJpbmdEZWxpbSA9PT0gXCInXCIgPyBzdHJpbmdTaW5nbGVSZSA6IHN0cmluZ0RvdWJsZVJlO1xyXG4gICAgICAgIHJlLmxhc3RJbmRleCA9IG9mZnNldCAtIDE7XHJcbiAgICAgICAgdmFyIG1hdGNoID0gcmUuZXhlYyhzb3VyY2UpO1xyXG4gICAgICAgIGlmICghbWF0Y2gpXHJcbiAgICAgICAgICAgIHRocm93IGlsbGVnYWwoXCJzdHJpbmdcIik7XHJcbiAgICAgICAgb2Zmc2V0ID0gcmUubGFzdEluZGV4O1xyXG4gICAgICAgIHB1c2goc3RyaW5nRGVsaW0pO1xyXG4gICAgICAgIHN0cmluZ0RlbGltID0gbnVsbDtcclxuICAgICAgICByZXR1cm4gdW5lc2NhcGUobWF0Y2hbMV0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogR2V0cyB0aGUgY2hhcmFjdGVyIGF0IGBwb3NgIHdpdGhpbiB0aGUgc291cmNlLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHBvcyBQb3NpdGlvblxyXG4gICAgICogQHJldHVybnMge3N0cmluZ30gQ2hhcmFjdGVyXHJcbiAgICAgKiBAaW5uZXJcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gY2hhckF0KHBvcykge1xyXG4gICAgICAgIHJldHVybiBzb3VyY2UuY2hhckF0KHBvcyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTZXRzIHRoZSBjdXJyZW50IGNvbW1lbnQgdGV4dC5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzdGFydCBTdGFydCBvZmZzZXRcclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBlbmQgRW5kIG9mZnNldFxyXG4gICAgICogQHJldHVybnMge3VuZGVmaW5lZH1cclxuICAgICAqIEBpbm5lclxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBzZXRDb21tZW50KHN0YXJ0LCBlbmQpIHtcclxuICAgICAgICBjb21tZW50VHlwZSA9IHNvdXJjZS5jaGFyQXQoc3RhcnQrKyk7XHJcbiAgICAgICAgY29tbWVudExpbmUgPSBsaW5lO1xyXG4gICAgICAgIHZhciBsaW5lcyA9IHNvdXJjZVxyXG4gICAgICAgICAgICAuc3Vic3RyaW5nKHN0YXJ0LCBlbmQpXHJcbiAgICAgICAgICAgIC5zcGxpdCgvXFxuL2cpO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyArK2kpXHJcbiAgICAgICAgICAgIGxpbmVzW2ldID0gbGluZXNbaV0ucmVwbGFjZSgvXiAqWyovXSsgKi8sIFwiXCIpLnRyaW0oKTtcclxuICAgICAgICBjb21tZW50VGV4dCA9IGxpbmVzXHJcbiAgICAgICAgICAgIC5qb2luKFwiXFxuXCIpXHJcbiAgICAgICAgICAgIC50cmltKCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBPYnRhaW5zIHRoZSBuZXh0IHRva2VuLlxyXG4gICAgICogQHJldHVybnMgez9zdHJpbmd9IE5leHQgdG9rZW4gb3IgYG51bGxgIG9uIGVvZlxyXG4gICAgICogQGlubmVyXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIG5leHQoKSB7XHJcbiAgICAgICAgaWYgKHN0YWNrLmxlbmd0aCA+IDApXHJcbiAgICAgICAgICAgIHJldHVybiBzdGFjay5zaGlmdCgpO1xyXG4gICAgICAgIGlmIChzdHJpbmdEZWxpbSlcclxuICAgICAgICAgICAgcmV0dXJuIHJlYWRTdHJpbmcoKTtcclxuICAgICAgICB2YXIgcmVwZWF0LFxyXG4gICAgICAgICAgICBwcmV2LFxyXG4gICAgICAgICAgICBjdXJyLFxyXG4gICAgICAgICAgICBzdGFydCxcclxuICAgICAgICAgICAgaXNDb21tZW50O1xyXG4gICAgICAgIGRvIHtcclxuICAgICAgICAgICAgaWYgKG9mZnNldCA9PT0gbGVuZ3RoKVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIHJlcGVhdCA9IGZhbHNlO1xyXG4gICAgICAgICAgICB3aGlsZSAoL1xccy8udGVzdChjdXJyID0gY2hhckF0KG9mZnNldCkpKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoY3VyciA9PT0gXCJcXG5cIilcclxuICAgICAgICAgICAgICAgICAgICArK2xpbmU7XHJcbiAgICAgICAgICAgICAgICBpZiAoKytvZmZzZXQgPT09IGxlbmd0aClcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoY2hhckF0KG9mZnNldCkgPT09IFwiL1wiKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoKytvZmZzZXQgPT09IGxlbmd0aClcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBpbGxlZ2FsKFwiY29tbWVudFwiKTtcclxuICAgICAgICAgICAgICAgIGlmIChjaGFyQXQob2Zmc2V0KSA9PT0gXCIvXCIpIHsgLy8gTGluZVxyXG4gICAgICAgICAgICAgICAgICAgIGlzQ29tbWVudCA9IGNoYXJBdChzdGFydCA9IG9mZnNldCArIDEpID09PSBcIi9cIjtcclxuICAgICAgICAgICAgICAgICAgICB3aGlsZSAoY2hhckF0KCsrb2Zmc2V0KSAhPT0gXCJcXG5cIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9mZnNldCA9PT0gbGVuZ3RoKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgKytvZmZzZXQ7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzQ29tbWVudClcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2V0Q29tbWVudChzdGFydCwgb2Zmc2V0IC0gMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgKytsaW5lO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlcGVhdCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKChjdXJyID0gY2hhckF0KG9mZnNldCkpID09PSBcIipcIikgeyAvKiBCbG9jayAqL1xyXG4gICAgICAgICAgICAgICAgICAgIGlzQ29tbWVudCA9IGNoYXJBdChzdGFydCA9IG9mZnNldCArIDEpID09PSBcIipcIjtcclxuICAgICAgICAgICAgICAgICAgICBkbyB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjdXJyID09PSBcIlxcblwiKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKytsaW5lO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoKytvZmZzZXQgPT09IGxlbmd0aClcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IGlsbGVnYWwoXCJjb21tZW50XCIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmV2ID0gY3VycjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY3VyciA9IGNoYXJBdChvZmZzZXQpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gd2hpbGUgKHByZXYgIT09IFwiKlwiIHx8IGN1cnIgIT09IFwiL1wiKTtcclxuICAgICAgICAgICAgICAgICAgICArK29mZnNldDtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaXNDb21tZW50KVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRDb21tZW50KHN0YXJ0LCBvZmZzZXQgLSAyKTtcclxuICAgICAgICAgICAgICAgICAgICByZXBlYXQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiL1wiO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSB3aGlsZSAocmVwZWF0KTtcclxuXHJcbiAgICAgICAgLy8gb2Zmc2V0ICE9PSBsZW5ndGggaWYgd2UgZ290IGhlcmVcclxuXHJcbiAgICAgICAgdmFyIGVuZCA9IG9mZnNldDtcclxuICAgICAgICBkZWxpbVJlLmxhc3RJbmRleCA9IDA7XHJcbiAgICAgICAgdmFyIGRlbGltID0gZGVsaW1SZS50ZXN0KGNoYXJBdChlbmQrKykpO1xyXG4gICAgICAgIGlmICghZGVsaW0pXHJcbiAgICAgICAgICAgIHdoaWxlIChlbmQgPCBsZW5ndGggJiYgIWRlbGltUmUudGVzdChjaGFyQXQoZW5kKSkpXHJcbiAgICAgICAgICAgICAgICArK2VuZDtcclxuICAgICAgICB2YXIgdG9rZW4gPSBzb3VyY2Uuc3Vic3RyaW5nKG9mZnNldCwgb2Zmc2V0ID0gZW5kKTtcclxuICAgICAgICBpZiAodG9rZW4gPT09IFwiXFxcIlwiIHx8IHRva2VuID09PSBcIidcIilcclxuICAgICAgICAgICAgc3RyaW5nRGVsaW0gPSB0b2tlbjtcclxuICAgICAgICByZXR1cm4gdG9rZW47XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBQdXNoZXMgYSB0b2tlbiBiYWNrIHRvIHRoZSBzdGFjay5cclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0b2tlbiBUb2tlblxyXG4gICAgICogQHJldHVybnMge3VuZGVmaW5lZH1cclxuICAgICAqIEBpbm5lclxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBwdXNoKHRva2VuKSB7XHJcbiAgICAgICAgc3RhY2sucHVzaCh0b2tlbik7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBQZWVrcyBmb3IgdGhlIG5leHQgdG9rZW4uXHJcbiAgICAgKiBAcmV0dXJucyB7P3N0cmluZ30gVG9rZW4gb3IgYG51bGxgIG9uIGVvZlxyXG4gICAgICogQGlubmVyXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIHBlZWsoKSB7XHJcbiAgICAgICAgaWYgKCFzdGFjay5sZW5ndGgpIHtcclxuICAgICAgICAgICAgdmFyIHRva2VuID0gbmV4dCgpO1xyXG4gICAgICAgICAgICBpZiAodG9rZW4gPT09IG51bGwpXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgcHVzaCh0b2tlbik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBzdGFja1swXTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFNraXBzIGEgdG9rZW4uXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZXhwZWN0ZWQgRXhwZWN0ZWQgdG9rZW5cclxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbmFsPWZhbHNlXSBXaGV0aGVyIHRoZSB0b2tlbiBpcyBvcHRpb25hbFxyXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IGB0cnVlYCB3aGVuIHNraXBwZWQsIGBmYWxzZWAgaWYgbm90XHJcbiAgICAgKiBAdGhyb3dzIHtFcnJvcn0gV2hlbiBhIHJlcXVpcmVkIHRva2VuIGlzIG5vdCBwcmVzZW50XHJcbiAgICAgKiBAaW5uZXJcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gc2tpcChleHBlY3RlZCwgb3B0aW9uYWwpIHtcclxuICAgICAgICB2YXIgYWN0dWFsID0gcGVlaygpLFxyXG4gICAgICAgICAgICBlcXVhbHMgPSBhY3R1YWwgPT09IGV4cGVjdGVkO1xyXG4gICAgICAgIGlmIChlcXVhbHMpIHtcclxuICAgICAgICAgICAgbmV4dCgpO1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCFvcHRpb25hbClcclxuICAgICAgICAgICAgdGhyb3cgaWxsZWdhbChcInRva2VuICdcIiArIGFjdHVhbCArIFwiJywgJ1wiICsgZXhwZWN0ZWQgKyBcIicgZXhwZWN0ZWRcIik7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgbmV4dDogbmV4dCxcclxuICAgICAgICBwZWVrOiBwZWVrLFxyXG4gICAgICAgIHB1c2g6IHB1c2gsXHJcbiAgICAgICAgc2tpcDogc2tpcCxcclxuICAgICAgICBsaW5lOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGxpbmU7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBjbW50OiBmdW5jdGlvbih0cmFpbGluZ0xpbmUpIHtcclxuICAgICAgICAgICAgdmFyIHJldDtcclxuICAgICAgICAgICAgaWYgKHRyYWlsaW5nTGluZSA9PT0gdW5kZWZpbmVkKVxyXG4gICAgICAgICAgICAgICAgcmV0ID0gY29tbWVudExpbmUgPT09IGxpbmUgLSAxICYmIGNvbW1lbnRUZXh0IHx8IG51bGw7XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFjb21tZW50VGV4dClcclxuICAgICAgICAgICAgICAgICAgICBwZWVrKCk7XHJcbiAgICAgICAgICAgICAgICByZXQgPSBjb21tZW50TGluZSA9PT0gdHJhaWxpbmdMaW5lICYmIGNvbW1lbnRUeXBlID09PSBcIi9cIiAmJiBjb21tZW50VGV4dCB8fCBudWxsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChyZXQpIHtcclxuICAgICAgICAgICAgICAgIGNvbW1lbnRUeXBlID0gY29tbWVudFRleHQgPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgY29tbWVudExpbmUgPSAwO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiByZXQ7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIC8qIGVzbGludC1lbmFibGUgY2FsbGJhY2stcmV0dXJuICovXHJcbn1cclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbm1vZHVsZS5leHBvcnRzID0gVHlwZTtcclxuXHJcbi8vIGV4dGVuZHMgTmFtZXNwYWNlXHJcbnZhciBOYW1lc3BhY2UgPSByZXF1aXJlKFwiLi9uYW1lc3BhY2VcIik7XHJcbigoVHlwZS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKE5hbWVzcGFjZS5wcm90b3R5cGUpKS5jb25zdHJ1Y3RvciA9IFR5cGUpLmNsYXNzTmFtZSA9IFwiVHlwZVwiO1xyXG5cclxudmFyIEVudW0gICAgICA9IHJlcXVpcmUoXCIuL2VudW1cIiksXHJcbiAgICBPbmVPZiAgICAgPSByZXF1aXJlKFwiLi9vbmVvZlwiKSxcclxuICAgIEZpZWxkICAgICA9IHJlcXVpcmUoXCIuL2ZpZWxkXCIpLFxyXG4gICAgTWFwRmllbGQgID0gcmVxdWlyZShcIi4vbWFwZmllbGRcIiksXHJcbiAgICBTZXJ2aWNlICAgPSByZXF1aXJlKFwiLi9zZXJ2aWNlXCIpLFxyXG4gICAgQ2xhc3MgICAgID0gcmVxdWlyZShcIi4vY2xhc3NcIiksXHJcbiAgICBNZXNzYWdlICAgPSByZXF1aXJlKFwiLi9tZXNzYWdlXCIpLFxyXG4gICAgUmVhZGVyICAgID0gcmVxdWlyZShcIi4vcmVhZGVyXCIpLFxyXG4gICAgV3JpdGVyICAgID0gcmVxdWlyZShcIi4vd3JpdGVyXCIpLFxyXG4gICAgdXRpbCAgICAgID0gcmVxdWlyZShcIi4vdXRpbFwiKSxcclxuICAgIGVuY29kZXIgICA9IHJlcXVpcmUoXCIuL2VuY29kZXJcIiksXHJcbiAgICBkZWNvZGVyICAgPSByZXF1aXJlKFwiLi9kZWNvZGVyXCIpLFxyXG4gICAgdmVyaWZpZXIgID0gcmVxdWlyZShcIi4vdmVyaWZpZXJcIiksXHJcbiAgICBjb252ZXJ0ZXIgPSByZXF1aXJlKFwiLi9jb252ZXJ0ZXJcIik7XHJcblxyXG4vKipcclxuICogQ3JlYXRlcyBhIHR5cGUgZnJvbSBKU09OLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBNZXNzYWdlIG5hbWVcclxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywqPn0ganNvbiBKU09OIG9iamVjdFxyXG4gKiBAcmV0dXJucyB7VHlwZX0gQ3JlYXRlZCBtZXNzYWdlIHR5cGVcclxuICovXHJcblR5cGUuZnJvbUpTT04gPSBmdW5jdGlvbiBmcm9tSlNPTihuYW1lLCBqc29uKSB7XHJcbiAgICB2YXIgdHlwZSA9IG5ldyBUeXBlKG5hbWUsIGpzb24ub3B0aW9ucyk7XHJcbiAgICB0eXBlLmV4dGVuc2lvbnMgPSBqc29uLmV4dGVuc2lvbnM7XHJcbiAgICB0eXBlLnJlc2VydmVkID0ganNvbi5yZXNlcnZlZDtcclxuICAgIHZhciBuYW1lcyA9IE9iamVjdC5rZXlzKGpzb24uZmllbGRzKSxcclxuICAgICAgICBpID0gMDtcclxuICAgIGZvciAoOyBpIDwgbmFtZXMubGVuZ3RoOyArK2kpXHJcbiAgICAgICAgdHlwZS5hZGQoXHJcbiAgICAgICAgICAgICggdHlwZW9mIGpzb24uZmllbGRzW25hbWVzW2ldXS5rZXlUeXBlICE9PSBcInVuZGVmaW5lZFwiXHJcbiAgICAgICAgICAgID8gTWFwRmllbGQuZnJvbUpTT05cclxuICAgICAgICAgICAgOiBGaWVsZC5mcm9tSlNPTiApKG5hbWVzW2ldLCBqc29uLmZpZWxkc1tuYW1lc1tpXV0pXHJcbiAgICAgICAgKTtcclxuICAgIGlmIChqc29uLm9uZW9mcylcclxuICAgICAgICBmb3IgKG5hbWVzID0gT2JqZWN0LmtleXMoanNvbi5vbmVvZnMpLCBpID0gMDsgaSA8IG5hbWVzLmxlbmd0aDsgKytpKVxyXG4gICAgICAgICAgICB0eXBlLmFkZChPbmVPZi5mcm9tSlNPTihuYW1lc1tpXSwganNvbi5vbmVvZnNbbmFtZXNbaV1dKSk7XHJcbiAgICBpZiAoanNvbi5uZXN0ZWQpXHJcbiAgICAgICAgZm9yIChuYW1lcyA9IE9iamVjdC5rZXlzKGpzb24ubmVzdGVkKSwgaSA9IDA7IGkgPCBuYW1lcy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICB2YXIgbmVzdGVkID0ganNvbi5uZXN0ZWRbbmFtZXNbaV1dO1xyXG4gICAgICAgICAgICB0eXBlLmFkZCggLy8gbW9zdCB0byBsZWFzdCBsaWtlbHlcclxuICAgICAgICAgICAgICAgICggbmVzdGVkLmlkICE9PSB1bmRlZmluZWRcclxuICAgICAgICAgICAgICAgID8gRmllbGQuZnJvbUpTT05cclxuICAgICAgICAgICAgICAgIDogbmVzdGVkLmZpZWxkcyAhPT0gdW5kZWZpbmVkXHJcbiAgICAgICAgICAgICAgICA/IFR5cGUuZnJvbUpTT05cclxuICAgICAgICAgICAgICAgIDogbmVzdGVkLnZhbHVlcyAhPT0gdW5kZWZpbmVkXHJcbiAgICAgICAgICAgICAgICA/IEVudW0uZnJvbUpTT05cclxuICAgICAgICAgICAgICAgIDogbmVzdGVkLm1ldGhvZHMgIT09IHVuZGVmaW5lZFxyXG4gICAgICAgICAgICAgICAgPyBTZXJ2aWNlLmZyb21KU09OXHJcbiAgICAgICAgICAgICAgICA6IE5hbWVzcGFjZS5mcm9tSlNPTiApKG5hbWVzW2ldLCBuZXN0ZWQpXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG4gICAgaWYgKGpzb24uZXh0ZW5zaW9ucyAmJiBqc29uLmV4dGVuc2lvbnMubGVuZ3RoKVxyXG4gICAgICAgIHR5cGUuZXh0ZW5zaW9ucyA9IGpzb24uZXh0ZW5zaW9ucztcclxuICAgIGlmIChqc29uLnJlc2VydmVkICYmIGpzb24ucmVzZXJ2ZWQubGVuZ3RoKVxyXG4gICAgICAgIHR5cGUucmVzZXJ2ZWQgPSBqc29uLnJlc2VydmVkO1xyXG4gICAgaWYgKGpzb24uZ3JvdXApXHJcbiAgICAgICAgdHlwZS5ncm91cCA9IHRydWU7XHJcbiAgICByZXR1cm4gdHlwZTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDb25zdHJ1Y3RzIGEgbmV3IHJlZmxlY3RlZCBtZXNzYWdlIHR5cGUgaW5zdGFuY2UuXHJcbiAqIEBjbGFzc2Rlc2MgUmVmbGVjdGVkIG1lc3NhZ2UgdHlwZS5cclxuICogQGV4dGVuZHMgTmFtZXNwYWNlQmFzZVxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgTWVzc2FnZSBuYW1lXHJcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsKj59IFtvcHRpb25zXSBEZWNsYXJlZCBvcHRpb25zXHJcbiAqL1xyXG5mdW5jdGlvbiBUeXBlKG5hbWUsIG9wdGlvbnMpIHtcclxuICAgIE5hbWVzcGFjZS5jYWxsKHRoaXMsIG5hbWUsIG9wdGlvbnMpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogTWVzc2FnZSBmaWVsZHMuXHJcbiAgICAgKiBAdHlwZSB7T2JqZWN0LjxzdHJpbmcsRmllbGQ+fVxyXG4gICAgICovXHJcbiAgICB0aGlzLmZpZWxkcyA9IHt9OyAgLy8gdG9KU09OLCBtYXJrZXJcclxuXHJcbiAgICAvKipcclxuICAgICAqIE9uZW9mcyBkZWNsYXJlZCB3aXRoaW4gdGhpcyBuYW1lc3BhY2UsIGlmIGFueS5cclxuICAgICAqIEB0eXBlIHtPYmplY3QuPHN0cmluZyxPbmVPZj59XHJcbiAgICAgKi9cclxuICAgIHRoaXMub25lb2ZzID0gdW5kZWZpbmVkOyAvLyB0b0pTT05cclxuXHJcbiAgICAvKipcclxuICAgICAqIEV4dGVuc2lvbiByYW5nZXMsIGlmIGFueS5cclxuICAgICAqIEB0eXBlIHtudW1iZXJbXVtdfVxyXG4gICAgICovXHJcbiAgICB0aGlzLmV4dGVuc2lvbnMgPSB1bmRlZmluZWQ7IC8vIHRvSlNPTlxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVzZXJ2ZWQgcmFuZ2VzLCBpZiBhbnkuXHJcbiAgICAgKiBAdHlwZSB7QXJyYXkuPG51bWJlcltdfHN0cmluZz59XHJcbiAgICAgKi9cclxuICAgIHRoaXMucmVzZXJ2ZWQgPSB1bmRlZmluZWQ7IC8vIHRvSlNPTlxyXG5cclxuICAgIC8qP1xyXG4gICAgICogV2hldGhlciB0aGlzIHR5cGUgaXMgYSBsZWdhY3kgZ3JvdXAuXHJcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbnx1bmRlZmluZWR9XHJcbiAgICAgKi9cclxuICAgIHRoaXMuZ3JvdXAgPSB1bmRlZmluZWQ7IC8vIHRvSlNPTlxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2FjaGVkIGZpZWxkcyBieSBpZC5cclxuICAgICAqIEB0eXBlIHs/T2JqZWN0LjxudW1iZXIsRmllbGQ+fVxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqL1xyXG4gICAgdGhpcy5fZmllbGRzQnlJZCA9IG51bGw7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWNoZWQgZmllbGRzIGFzIGFuIGFycmF5LlxyXG4gICAgICogQHR5cGUgez9GaWVsZFtdfVxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqL1xyXG4gICAgdGhpcy5fZmllbGRzQXJyYXkgPSBudWxsO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2FjaGVkIG9uZW9mcyBhcyBhbiBhcnJheS5cclxuICAgICAqIEB0eXBlIHs/T25lT2ZbXX1cclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKi9cclxuICAgIHRoaXMuX29uZW9mc0FycmF5ID0gbnVsbDtcclxuXHJcbiAgICAvKipcclxuICAgICAqIENhY2hlZCBjb25zdHJ1Y3Rvci5cclxuICAgICAqIEB0eXBlIHsqfVxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqL1xyXG4gICAgdGhpcy5fY3RvciA9IG51bGw7XHJcbn1cclxuXHJcbk9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKFR5cGUucHJvdG90eXBlLCB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBNZXNzYWdlIGZpZWxkcyBieSBpZC5cclxuICAgICAqIEBuYW1lIFR5cGUjZmllbGRzQnlJZFxyXG4gICAgICogQHR5cGUge09iamVjdC48bnVtYmVyLEZpZWxkPn1cclxuICAgICAqIEByZWFkb25seVxyXG4gICAgICovXHJcbiAgICBmaWVsZHNCeUlkOiB7XHJcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgICAgICAgICAgaWYgKHRoaXMuX2ZpZWxkc0J5SWQpXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fZmllbGRzQnlJZDtcclxuICAgICAgICAgICAgdGhpcy5fZmllbGRzQnlJZCA9IHt9O1xyXG4gICAgICAgICAgICBmb3IgKHZhciBuYW1lcyA9IE9iamVjdC5rZXlzKHRoaXMuZmllbGRzKSwgaSA9IDA7IGkgPCBuYW1lcy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGZpZWxkID0gdGhpcy5maWVsZHNbbmFtZXNbaV1dLFxyXG4gICAgICAgICAgICAgICAgICAgIGlkID0gZmllbGQuaWQ7XHJcblxyXG4gICAgICAgICAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9maWVsZHNCeUlkW2lkXSlcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBFcnJvcihcImR1cGxpY2F0ZSBpZCBcIiArIGlkICsgXCIgaW4gXCIgKyB0aGlzKTtcclxuXHJcbiAgICAgICAgICAgICAgICB0aGlzLl9maWVsZHNCeUlkW2lkXSA9IGZpZWxkO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9maWVsZHNCeUlkO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGaWVsZHMgb2YgdGhpcyBtZXNzYWdlIGFzIGFuIGFycmF5IGZvciBpdGVyYXRpb24uXHJcbiAgICAgKiBAbmFtZSBUeXBlI2ZpZWxkc0FycmF5XHJcbiAgICAgKiBAdHlwZSB7RmllbGRbXX1cclxuICAgICAqIEByZWFkb25seVxyXG4gICAgICovXHJcbiAgICBmaWVsZHNBcnJheToge1xyXG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9maWVsZHNBcnJheSB8fCAodGhpcy5fZmllbGRzQXJyYXkgPSB1dGlsLnRvQXJyYXkodGhpcy5maWVsZHMpKTtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogT25lb2ZzIG9mIHRoaXMgbWVzc2FnZSBhcyBhbiBhcnJheSBmb3IgaXRlcmF0aW9uLlxyXG4gICAgICogQG5hbWUgVHlwZSNvbmVvZnNBcnJheVxyXG4gICAgICogQHR5cGUge09uZU9mW119XHJcbiAgICAgKiBAcmVhZG9ubHlcclxuICAgICAqL1xyXG4gICAgb25lb2ZzQXJyYXk6IHtcclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fb25lb2ZzQXJyYXkgfHwgKHRoaXMuX29uZW9mc0FycmF5ID0gdXRpbC50b0FycmF5KHRoaXMub25lb2ZzKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoZSByZWdpc3RlcmVkIGNvbnN0cnVjdG9yLCBpZiBhbnkgcmVnaXN0ZXJlZCwgb3RoZXJ3aXNlIGEgZ2VuZXJpYyBjb25zdHJ1Y3Rvci5cclxuICAgICAqIEBuYW1lIFR5cGUjY3RvclxyXG4gICAgICogQHR5cGUge0NsYXNzfVxyXG4gICAgICovXHJcbiAgICBjdG9yOiB7XHJcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2N0b3IgfHwgKHRoaXMuX2N0b3IgPSBDbGFzcyh0aGlzKS5jb25zdHJ1Y3Rvcik7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBzZXQ6IGZ1bmN0aW9uKGN0b3IpIHtcclxuICAgICAgICAgICAgaWYgKGN0b3IgJiYgIShjdG9yLnByb3RvdHlwZSBpbnN0YW5jZW9mIE1lc3NhZ2UpKVxyXG4gICAgICAgICAgICAgICAgdGhyb3cgVHlwZUVycm9yKFwiY3RvciBtdXN0IGJlIGEgTWVzc2FnZSBjb25zdHJ1Y3RvclwiKTtcclxuICAgICAgICAgICAgaWYgKCFjdG9yLmZyb20pXHJcbiAgICAgICAgICAgICAgICBjdG9yLmZyb20gPSBNZXNzYWdlLmZyb207XHJcbiAgICAgICAgICAgIHRoaXMuX2N0b3IgPSBjdG9yO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufSk7XHJcblxyXG5mdW5jdGlvbiBjbGVhckNhY2hlKHR5cGUpIHtcclxuICAgIHR5cGUuX2ZpZWxkc0J5SWQgPSB0eXBlLl9maWVsZHNBcnJheSA9IHR5cGUuX29uZW9mc0FycmF5ID0gdHlwZS5fY3RvciA9IG51bGw7XHJcbiAgICBkZWxldGUgdHlwZS5lbmNvZGU7XHJcbiAgICBkZWxldGUgdHlwZS5kZWNvZGU7XHJcbiAgICBkZWxldGUgdHlwZS52ZXJpZnk7XHJcbiAgICByZXR1cm4gdHlwZTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEBvdmVycmlkZVxyXG4gKi9cclxuVHlwZS5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gdG9KU09OKCkge1xyXG4gICAgdmFyIGluaGVyaXRlZCA9IE5hbWVzcGFjZS5wcm90b3R5cGUudG9KU09OLmNhbGwodGhpcyk7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIG9wdGlvbnMgICAgOiBpbmhlcml0ZWQgJiYgaW5oZXJpdGVkLm9wdGlvbnMgfHwgdW5kZWZpbmVkLFxyXG4gICAgICAgIG9uZW9mcyAgICAgOiBOYW1lc3BhY2UuYXJyYXlUb0pTT04odGhpcy5vbmVvZnNBcnJheSksXHJcbiAgICAgICAgZmllbGRzICAgICA6IE5hbWVzcGFjZS5hcnJheVRvSlNPTih0aGlzLmZpZWxkc0FycmF5LmZpbHRlcihmdW5jdGlvbihvYmopIHsgcmV0dXJuICFvYmouZGVjbGFyaW5nRmllbGQ7IH0pKSB8fCB7fSxcclxuICAgICAgICBleHRlbnNpb25zIDogdGhpcy5leHRlbnNpb25zICYmIHRoaXMuZXh0ZW5zaW9ucy5sZW5ndGggPyB0aGlzLmV4dGVuc2lvbnMgOiB1bmRlZmluZWQsXHJcbiAgICAgICAgcmVzZXJ2ZWQgICA6IHRoaXMucmVzZXJ2ZWQgJiYgdGhpcy5yZXNlcnZlZC5sZW5ndGggPyB0aGlzLnJlc2VydmVkIDogdW5kZWZpbmVkLFxyXG4gICAgICAgIGdyb3VwICAgICAgOiB0aGlzLmdyb3VwIHx8IHVuZGVmaW5lZCxcclxuICAgICAgICBuZXN0ZWQgICAgIDogaW5oZXJpdGVkICYmIGluaGVyaXRlZC5uZXN0ZWQgfHwgdW5kZWZpbmVkXHJcbiAgICB9O1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEBvdmVycmlkZVxyXG4gKi9cclxuVHlwZS5wcm90b3R5cGUucmVzb2x2ZUFsbCA9IGZ1bmN0aW9uIHJlc29sdmVBbGwoKSB7XHJcbiAgICB2YXIgZmllbGRzID0gdGhpcy5maWVsZHNBcnJheSwgaSA9IDA7XHJcbiAgICB3aGlsZSAoaSA8IGZpZWxkcy5sZW5ndGgpXHJcbiAgICAgICAgZmllbGRzW2krK10ucmVzb2x2ZSgpO1xyXG4gICAgdmFyIG9uZW9mcyA9IHRoaXMub25lb2ZzQXJyYXk7IGkgPSAwO1xyXG4gICAgd2hpbGUgKGkgPCBvbmVvZnMubGVuZ3RoKVxyXG4gICAgICAgIG9uZW9mc1tpKytdLnJlc29sdmUoKTtcclxuICAgIHJldHVybiBOYW1lc3BhY2UucHJvdG90eXBlLnJlc29sdmUuY2FsbCh0aGlzKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBAb3ZlcnJpZGVcclxuICovXHJcblR5cGUucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIGdldChuYW1lKSB7XHJcbiAgICByZXR1cm4gdGhpcy5maWVsZHNbbmFtZV1cclxuICAgICAgICB8fCB0aGlzLm9uZW9mcyAmJiB0aGlzLm9uZW9mc1tuYW1lXVxyXG4gICAgICAgIHx8IHRoaXMubmVzdGVkICYmIHRoaXMubmVzdGVkW25hbWVdXHJcbiAgICAgICAgfHwgbnVsbDtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBBZGRzIGEgbmVzdGVkIG9iamVjdCB0byB0aGlzIHR5cGUuXHJcbiAqIEBwYXJhbSB7UmVmbGVjdGlvbk9iamVjdH0gb2JqZWN0IE5lc3RlZCBvYmplY3QgdG8gYWRkXHJcbiAqIEByZXR1cm5zIHtUeXBlfSBgdGhpc2BcclxuICogQHRocm93cyB7VHlwZUVycm9yfSBJZiBhcmd1bWVudHMgYXJlIGludmFsaWRcclxuICogQHRocm93cyB7RXJyb3J9IElmIHRoZXJlIGlzIGFscmVhZHkgYSBuZXN0ZWQgb2JqZWN0IHdpdGggdGhpcyBuYW1lIG9yLCBpZiBhIGZpZWxkLCB3aGVuIHRoZXJlIGlzIGFscmVhZHkgYSBmaWVsZCB3aXRoIHRoaXMgaWRcclxuICovXHJcblR5cGUucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uIGFkZChvYmplY3QpIHtcclxuXHJcbiAgICBpZiAodGhpcy5nZXQob2JqZWN0Lm5hbWUpKVxyXG4gICAgICAgIHRocm93IEVycm9yKFwiZHVwbGljYXRlIG5hbWUgJ1wiICsgb2JqZWN0Lm5hbWUgKyBcIicgaW4gXCIgKyB0aGlzKTtcclxuXHJcbiAgICBpZiAob2JqZWN0IGluc3RhbmNlb2YgRmllbGQgJiYgb2JqZWN0LmV4dGVuZCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgLy8gTk9URTogRXh0ZW5zaW9uIGZpZWxkcyBhcmVuJ3QgYWN0dWFsIGZpZWxkcyBvbiB0aGUgZGVjbGFyaW5nIHR5cGUsIGJ1dCBuZXN0ZWQgb2JqZWN0cy5cclxuICAgICAgICAvLyBUaGUgcm9vdCBvYmplY3QgdGFrZXMgY2FyZSBvZiBhZGRpbmcgZGlzdGluY3Qgc2lzdGVyLWZpZWxkcyB0byB0aGUgcmVzcGVjdGl2ZSBleHRlbmRlZFxyXG4gICAgICAgIC8vIHR5cGUgaW5zdGVhZC5cclxuXHJcbiAgICAgICAgLy8gYXZvaWRzIGNhbGxpbmcgdGhlIGdldHRlciBpZiBub3QgYWJzb2x1dGVseSBuZWNlc3NhcnkgYmVjYXVzZSBpdCdzIGNhbGxlZCBxdWl0ZSBmcmVxdWVudGx5XHJcbiAgICAgICAgaWYgKHRoaXMuX2ZpZWxkc0J5SWQgPyAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqLyB0aGlzLl9maWVsZHNCeUlkW29iamVjdC5pZF0gOiB0aGlzLmZpZWxkc0J5SWRbb2JqZWN0LmlkXSlcclxuICAgICAgICAgICAgdGhyb3cgRXJyb3IoXCJkdXBsaWNhdGUgaWQgXCIgKyBvYmplY3QuaWQgKyBcIiBpbiBcIiArIHRoaXMpO1xyXG4gICAgICAgIGlmICh0aGlzLmlzUmVzZXJ2ZWRJZChvYmplY3QuaWQpKVxyXG4gICAgICAgICAgICB0aHJvdyBFcnJvcihcImlkIFwiICsgb2JqZWN0LmlkICsgXCIgaXMgcmVzZXJ2ZWQgaW4gXCIgKyB0aGlzKTtcclxuICAgICAgICBpZiAodGhpcy5pc1Jlc2VydmVkTmFtZShvYmplY3QubmFtZSkpXHJcbiAgICAgICAgICAgIHRocm93IEVycm9yKFwibmFtZSAnXCIgKyBvYmplY3QubmFtZSArIFwiJyBpcyByZXNlcnZlZCBpbiBcIiArIHRoaXMpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChvYmplY3QucGFyZW50KVxyXG4gICAgICAgICAgICBvYmplY3QucGFyZW50LnJlbW92ZShvYmplY3QpO1xyXG4gICAgICAgIHRoaXMuZmllbGRzW29iamVjdC5uYW1lXSA9IG9iamVjdDtcclxuICAgICAgICBvYmplY3QubWVzc2FnZSA9IHRoaXM7XHJcbiAgICAgICAgb2JqZWN0Lm9uQWRkKHRoaXMpO1xyXG4gICAgICAgIHJldHVybiBjbGVhckNhY2hlKHRoaXMpO1xyXG4gICAgfVxyXG4gICAgaWYgKG9iamVjdCBpbnN0YW5jZW9mIE9uZU9mKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLm9uZW9mcylcclxuICAgICAgICAgICAgdGhpcy5vbmVvZnMgPSB7fTtcclxuICAgICAgICB0aGlzLm9uZW9mc1tvYmplY3QubmFtZV0gPSBvYmplY3Q7XHJcbiAgICAgICAgb2JqZWN0Lm9uQWRkKHRoaXMpO1xyXG4gICAgICAgIHJldHVybiBjbGVhckNhY2hlKHRoaXMpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIE5hbWVzcGFjZS5wcm90b3R5cGUuYWRkLmNhbGwodGhpcywgb2JqZWN0KTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZW1vdmVzIGEgbmVzdGVkIG9iamVjdCBmcm9tIHRoaXMgdHlwZS5cclxuICogQHBhcmFtIHtSZWZsZWN0aW9uT2JqZWN0fSBvYmplY3QgTmVzdGVkIG9iamVjdCB0byByZW1vdmVcclxuICogQHJldHVybnMge1R5cGV9IGB0aGlzYFxyXG4gKiBAdGhyb3dzIHtUeXBlRXJyb3J9IElmIGFyZ3VtZW50cyBhcmUgaW52YWxpZFxyXG4gKiBAdGhyb3dzIHtFcnJvcn0gSWYgYG9iamVjdGAgaXMgbm90IGEgbWVtYmVyIG9mIHRoaXMgdHlwZVxyXG4gKi9cclxuVHlwZS5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24gcmVtb3ZlKG9iamVjdCkge1xyXG4gICAgaWYgKG9iamVjdCBpbnN0YW5jZW9mIEZpZWxkICYmIG9iamVjdC5leHRlbmQgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIC8vIFNlZSBUeXBlI2FkZCBmb3IgdGhlIHJlYXNvbiB3aHkgZXh0ZW5zaW9uIGZpZWxkcyBhcmUgZXhjbHVkZWQgaGVyZS5cclxuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgICAgIGlmICghdGhpcy5maWVsZHMgfHwgdGhpcy5maWVsZHNbb2JqZWN0Lm5hbWVdICE9PSBvYmplY3QpXHJcbiAgICAgICAgICAgIHRocm93IEVycm9yKG9iamVjdCArIFwiIGlzIG5vdCBhIG1lbWJlciBvZiBcIiArIHRoaXMpO1xyXG4gICAgICAgIGRlbGV0ZSB0aGlzLmZpZWxkc1tvYmplY3QubmFtZV07XHJcbiAgICAgICAgb2JqZWN0LnBhcmVudCA9IG51bGw7XHJcbiAgICAgICAgb2JqZWN0Lm9uUmVtb3ZlKHRoaXMpO1xyXG4gICAgICAgIHJldHVybiBjbGVhckNhY2hlKHRoaXMpO1xyXG4gICAgfVxyXG4gICAgaWYgKG9iamVjdCBpbnN0YW5jZW9mIE9uZU9mKSB7XHJcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgICAgICBpZiAoIXRoaXMub25lb2ZzIHx8IHRoaXMub25lb2ZzW29iamVjdC5uYW1lXSAhPT0gb2JqZWN0KVxyXG4gICAgICAgICAgICB0aHJvdyBFcnJvcihvYmplY3QgKyBcIiBpcyBub3QgYSBtZW1iZXIgb2YgXCIgKyB0aGlzKTtcclxuICAgICAgICBkZWxldGUgdGhpcy5vbmVvZnNbb2JqZWN0Lm5hbWVdO1xyXG4gICAgICAgIG9iamVjdC5wYXJlbnQgPSBudWxsO1xyXG4gICAgICAgIG9iamVjdC5vblJlbW92ZSh0aGlzKTtcclxuICAgICAgICByZXR1cm4gY2xlYXJDYWNoZSh0aGlzKTtcclxuICAgIH1cclxuICAgIHJldHVybiBOYW1lc3BhY2UucHJvdG90eXBlLnJlbW92ZS5jYWxsKHRoaXMsIG9iamVjdCk7XHJcbn07XHJcblxyXG4vKipcclxuICogVGVzdHMgaWYgdGhlIHNwZWNpZmllZCBpZCBpcyByZXNlcnZlZC5cclxuICogQHBhcmFtIHtudW1iZXJ9IGlkIElkIHRvIHRlc3RcclxuICogQHJldHVybnMge2Jvb2xlYW59IGB0cnVlYCBpZiByZXNlcnZlZCwgb3RoZXJ3aXNlIGBmYWxzZWBcclxuICovXHJcblR5cGUucHJvdG90eXBlLmlzUmVzZXJ2ZWRJZCA9IGZ1bmN0aW9uIGlzUmVzZXJ2ZWRJZChpZCkge1xyXG4gICAgaWYgKHRoaXMucmVzZXJ2ZWQpXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnJlc2VydmVkLmxlbmd0aDsgKytpKVxyXG4gICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMucmVzZXJ2ZWRbaV0gIT09IFwic3RyaW5nXCIgJiYgdGhpcy5yZXNlcnZlZFtpXVswXSA8PSBpZCAmJiB0aGlzLnJlc2VydmVkW2ldWzFdID49IGlkKVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbn07XHJcblxyXG4vKipcclxuICogVGVzdHMgaWYgdGhlIHNwZWNpZmllZCBuYW1lIGlzIHJlc2VydmVkLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBOYW1lIHRvIHRlc3RcclxuICogQHJldHVybnMge2Jvb2xlYW59IGB0cnVlYCBpZiByZXNlcnZlZCwgb3RoZXJ3aXNlIGBmYWxzZWBcclxuICovXHJcblR5cGUucHJvdG90eXBlLmlzUmVzZXJ2ZWROYW1lID0gZnVuY3Rpb24gaXNSZXNlcnZlZE5hbWUobmFtZSkge1xyXG4gICAgaWYgKHRoaXMucmVzZXJ2ZWQpXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnJlc2VydmVkLmxlbmd0aDsgKytpKVxyXG4gICAgICAgICAgICBpZiAodGhpcy5yZXNlcnZlZFtpXSA9PT0gbmFtZSlcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENyZWF0ZXMgYSBuZXcgbWVzc2FnZSBvZiB0aGlzIHR5cGUgdXNpbmcgdGhlIHNwZWNpZmllZCBwcm9wZXJ0aWVzLlxyXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCo+fSBbcHJvcGVydGllc10gUHJvcGVydGllcyB0byBzZXRcclxuICogQHJldHVybnMge01lc3NhZ2V9IFJ1bnRpbWUgbWVzc2FnZVxyXG4gKi9cclxuVHlwZS5wcm90b3R5cGUuY3JlYXRlID0gZnVuY3Rpb24gY3JlYXRlKHByb3BlcnRpZXMpIHtcclxuICAgIHJldHVybiBuZXcgdGhpcy5jdG9yKHByb3BlcnRpZXMpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFNldHMgdXAge0BsaW5rIFR5cGUjZW5jb2RlfGVuY29kZX0sIHtAbGluayBUeXBlI2RlY29kZXxkZWNvZGV9IGFuZCB7QGxpbmsgVHlwZSN2ZXJpZnl8dmVyaWZ5fS5cclxuICogQHJldHVybnMge1R5cGV9IGB0aGlzYFxyXG4gKi9cclxuVHlwZS5wcm90b3R5cGUuc2V0dXAgPSBmdW5jdGlvbiBzZXR1cCgpIHtcclxuICAgIC8vIFNldHMgdXAgZXZlcnl0aGluZyBhdCBvbmNlIHNvIHRoYXQgdGhlIHByb3RvdHlwZSBjaGFpbiBkb2VzIG5vdCBoYXZlIHRvIGJlIHJlLWV2YWx1YXRlZFxyXG4gICAgLy8gbXVsdGlwbGUgdGltZXMgKFY4LCBzb2Z0LWRlb3B0IHByb3RvdHlwZS1jaGVjaykuXHJcbiAgICB2YXIgZnVsbE5hbWUgPSB0aGlzLmZ1bGxOYW1lLFxyXG4gICAgICAgIHR5cGVzICAgID0gW107XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IC8qIGluaXRpYWxpemVzICovIHRoaXMuZmllbGRzQXJyYXkubGVuZ3RoOyArK2kpXHJcbiAgICAgICAgdHlwZXMucHVzaCh0aGlzLl9maWVsZHNBcnJheVtpXS5yZXNvbHZlKCkucmVzb2x2ZWRUeXBlKTtcclxuICAgIHRoaXMuZW5jb2RlID0gZW5jb2Rlcih0aGlzKS5lb2YoZnVsbE5hbWUgKyBcIiRlbmNvZGVcIiwge1xyXG4gICAgICAgIFdyaXRlciA6IFdyaXRlcixcclxuICAgICAgICB0eXBlcyAgOiB0eXBlcyxcclxuICAgICAgICB1dGlsICAgOiB1dGlsXHJcbiAgICB9KTtcclxuICAgIHRoaXMuZGVjb2RlID0gZGVjb2Rlcih0aGlzKS5lb2YoZnVsbE5hbWUgKyBcIiRkZWNvZGVcIiwge1xyXG4gICAgICAgIFJlYWRlciA6IFJlYWRlcixcclxuICAgICAgICB0eXBlcyAgOiB0eXBlcyxcclxuICAgICAgICB1dGlsICAgOiB1dGlsXHJcbiAgICB9KTtcclxuICAgIHRoaXMudmVyaWZ5ID0gdmVyaWZpZXIodGhpcykuZW9mKGZ1bGxOYW1lICsgXCIkdmVyaWZ5XCIsIHtcclxuICAgICAgICB0eXBlcyA6IHR5cGVzLFxyXG4gICAgICAgIHV0aWwgIDogdXRpbFxyXG4gICAgfSk7XHJcbiAgICB0aGlzLmZyb21PYmplY3QgPSB0aGlzLmZyb20gPSBjb252ZXJ0ZXIuZnJvbU9iamVjdCh0aGlzKS5lb2YoZnVsbE5hbWUgKyBcIiRmcm9tT2JqZWN0XCIsIHtcclxuICAgICAgICB0eXBlcyA6IHR5cGVzLFxyXG4gICAgICAgIHV0aWwgIDogdXRpbFxyXG4gICAgfSk7XHJcbiAgICB0aGlzLnRvT2JqZWN0ID0gY29udmVydGVyLnRvT2JqZWN0KHRoaXMpLmVvZihmdWxsTmFtZSArIFwiJHRvT2JqZWN0XCIsIHtcclxuICAgICAgICB0eXBlcyA6IHR5cGVzLFxyXG4gICAgICAgIHV0aWwgIDogdXRpbFxyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gdGhpcztcclxufTtcclxuXHJcbi8qKlxyXG4gKiBFbmNvZGVzIGEgbWVzc2FnZSBvZiB0aGlzIHR5cGUuXHJcbiAqIEBwYXJhbSB7TWVzc2FnZXxPYmplY3R9IG1lc3NhZ2UgTWVzc2FnZSBpbnN0YW5jZSBvciBwbGFpbiBvYmplY3RcclxuICogQHBhcmFtIHtXcml0ZXJ9IFt3cml0ZXJdIFdyaXRlciB0byBlbmNvZGUgdG9cclxuICogQHJldHVybnMge1dyaXRlcn0gd3JpdGVyXHJcbiAqL1xyXG5UeXBlLnByb3RvdHlwZS5lbmNvZGUgPSBmdW5jdGlvbiBlbmNvZGVfc2V0dXAobWVzc2FnZSwgd3JpdGVyKSB7XHJcbiAgICByZXR1cm4gdGhpcy5zZXR1cCgpLmVuY29kZShtZXNzYWdlLCB3cml0ZXIpOyAvLyBvdmVycmlkZXMgdGhpcyBtZXRob2RcclxufTtcclxuXHJcbi8qKlxyXG4gKiBFbmNvZGVzIGEgbWVzc2FnZSBvZiB0aGlzIHR5cGUgcHJlY2VlZGVkIGJ5IGl0cyBieXRlIGxlbmd0aCBhcyBhIHZhcmludC5cclxuICogQHBhcmFtIHtNZXNzYWdlfE9iamVjdH0gbWVzc2FnZSBNZXNzYWdlIGluc3RhbmNlIG9yIHBsYWluIG9iamVjdFxyXG4gKiBAcGFyYW0ge1dyaXRlcn0gW3dyaXRlcl0gV3JpdGVyIHRvIGVuY29kZSB0b1xyXG4gKiBAcmV0dXJucyB7V3JpdGVyfSB3cml0ZXJcclxuICovXHJcblR5cGUucHJvdG90eXBlLmVuY29kZURlbGltaXRlZCA9IGZ1bmN0aW9uIGVuY29kZURlbGltaXRlZChtZXNzYWdlLCB3cml0ZXIpIHtcclxuICAgIHJldHVybiB0aGlzLmVuY29kZShtZXNzYWdlLCB3cml0ZXIgJiYgd3JpdGVyLmxlbiA/IHdyaXRlci5mb3JrKCkgOiB3cml0ZXIpLmxkZWxpbSgpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIERlY29kZXMgYSBtZXNzYWdlIG9mIHRoaXMgdHlwZS5cclxuICogQHBhcmFtIHtSZWFkZXJ8VWludDhBcnJheX0gcmVhZGVyIFJlYWRlciBvciBidWZmZXIgdG8gZGVjb2RlIGZyb21cclxuICogQHBhcmFtIHtudW1iZXJ9IFtsZW5ndGhdIExlbmd0aCBvZiB0aGUgbWVzc2FnZSwgaWYga25vd24gYmVmb3JlaGFuZFxyXG4gKiBAcmV0dXJucyB7TWVzc2FnZX0gRGVjb2RlZCBtZXNzYWdlXHJcbiAqL1xyXG5UeXBlLnByb3RvdHlwZS5kZWNvZGUgPSBmdW5jdGlvbiBkZWNvZGVfc2V0dXAocmVhZGVyLCBsZW5ndGgpIHtcclxuICAgIHJldHVybiB0aGlzLnNldHVwKCkuZGVjb2RlKHJlYWRlciwgbGVuZ3RoKTsgLy8gb3ZlcnJpZGVzIHRoaXMgbWV0aG9kXHJcbn07XHJcblxyXG4vKipcclxuICogRGVjb2RlcyBhIG1lc3NhZ2Ugb2YgdGhpcyB0eXBlIHByZWNlZWRlZCBieSBpdHMgYnl0ZSBsZW5ndGggYXMgYSB2YXJpbnQuXHJcbiAqIEBwYXJhbSB7UmVhZGVyfFVpbnQ4QXJyYXl9IHJlYWRlciBSZWFkZXIgb3IgYnVmZmVyIHRvIGRlY29kZSBmcm9tXHJcbiAqIEByZXR1cm5zIHtNZXNzYWdlfSBEZWNvZGVkIG1lc3NhZ2VcclxuICovXHJcblR5cGUucHJvdG90eXBlLmRlY29kZURlbGltaXRlZCA9IGZ1bmN0aW9uIGRlY29kZURlbGltaXRlZChyZWFkZXIpIHtcclxuICAgIGlmICghKHJlYWRlciBpbnN0YW5jZW9mIFJlYWRlcikpXHJcbiAgICAgICAgcmVhZGVyID0gUmVhZGVyLmNyZWF0ZShyZWFkZXIpO1xyXG4gICAgcmV0dXJuIHRoaXMuZGVjb2RlKHJlYWRlciwgcmVhZGVyLnVpbnQzMigpKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBWZXJpZmllcyB0aGF0IGZpZWxkIHZhbHVlcyBhcmUgdmFsaWQgYW5kIHRoYXQgcmVxdWlyZWQgZmllbGRzIGFyZSBwcmVzZW50LlxyXG4gKiBAcGFyYW0ge01lc3NhZ2V8T2JqZWN0fSBtZXNzYWdlIE1lc3NhZ2UgdG8gdmVyaWZ5XHJcbiAqIEByZXR1cm5zIHs/c3RyaW5nfSBgbnVsbGAgaWYgdmFsaWQsIG90aGVyd2lzZSB0aGUgcmVhc29uIHdoeSBpdCBpcyBub3RcclxuICovXHJcblR5cGUucHJvdG90eXBlLnZlcmlmeSA9IGZ1bmN0aW9uIHZlcmlmeV9zZXR1cChtZXNzYWdlKSB7XHJcbiAgICByZXR1cm4gdGhpcy5zZXR1cCgpLnZlcmlmeShtZXNzYWdlKTsgLy8gb3ZlcnJpZGVzIHRoaXMgbWV0aG9kXHJcbn07XHJcblxyXG4vKipcclxuICogQ3JlYXRlcyBhIG5ldyBtZXNzYWdlIG9mIHRoaXMgdHlwZSBmcm9tIGEgcGxhaW4gb2JqZWN0LiBBbHNvIGNvbnZlcnRzIHZhbHVlcyB0byB0aGVpciByZXNwZWN0aXZlIGludGVybmFsIHR5cGVzLlxyXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCo+fSBvYmplY3QgUGxhaW4gb2JqZWN0XHJcbiAqIEByZXR1cm5zIHtNZXNzYWdlfSBNZXNzYWdlIGluc3RhbmNlXHJcbiAqL1xyXG5UeXBlLnByb3RvdHlwZS5mcm9tT2JqZWN0ID0gZnVuY3Rpb24gZnJvbU9iamVjdChvYmplY3QpIHtcclxuICAgIHJldHVybiB0aGlzLnNldHVwKCkuZnJvbU9iamVjdChvYmplY3QpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENyZWF0ZXMgYSBuZXcgbWVzc2FnZSBvZiB0aGlzIHR5cGUgZnJvbSBhIHBsYWluIG9iamVjdC4gQWxzbyBjb252ZXJ0cyB2YWx1ZXMgdG8gdGhlaXIgcmVzcGVjdGl2ZSBpbnRlcm5hbCB0eXBlcy5cclxuICogVGhpcyBpcyBhbiBhbGlhcyBvZiB7QGxpbmsgVHlwZSNmcm9tT2JqZWN0fS5cclxuICogQGZ1bmN0aW9uXHJcbiAqIEBwYXJhbSB7T2JqZWN0LjxzdHJpbmcsKj59IG9iamVjdCBQbGFpbiBvYmplY3RcclxuICogQHJldHVybnMge01lc3NhZ2V9IE1lc3NhZ2UgaW5zdGFuY2VcclxuICovXHJcblR5cGUucHJvdG90eXBlLmZyb20gPSBUeXBlLnByb3RvdHlwZS5mcm9tT2JqZWN0O1xyXG5cclxuLyoqXHJcbiAqIENvbnZlcnNpb24gb3B0aW9ucyBhcyB1c2VkIGJ5IHtAbGluayBUeXBlI3RvT2JqZWN0fSBhbmQge0BsaW5rIE1lc3NhZ2UudG9PYmplY3R9LlxyXG4gKiBAdHlwZWRlZiBDb252ZXJzaW9uT3B0aW9uc1xyXG4gKiBAdHlwZSB7T2JqZWN0fVxyXG4gKiBAcHJvcGVydHkgeyp9IFtsb25nc10gTG9uZyBjb252ZXJzaW9uIHR5cGUuXHJcbiAqIFZhbGlkIHZhbHVlcyBhcmUgYFN0cmluZ2AgYW5kIGBOdW1iZXJgICh0aGUgZ2xvYmFsIHR5cGVzKS5cclxuICogRGVmYXVsdHMgdG8gY29weSB0aGUgcHJlc2VudCB2YWx1ZSwgd2hpY2ggaXMgYSBwb3NzaWJseSB1bnNhZmUgbnVtYmVyIHdpdGhvdXQgYW5kIGEge0BsaW5rIExvbmd9IHdpdGggYSBsb25nIGxpYnJhcnkuXHJcbiAqIEBwcm9wZXJ0eSB7Kn0gW2VudW1zXSBFbnVtIHZhbHVlIGNvbnZlcnNpb24gdHlwZS5cclxuICogT25seSB2YWxpZCB2YWx1ZSBpcyBgU3RyaW5nYCAodGhlIGdsb2JhbCB0eXBlKS5cclxuICogRGVmYXVsdHMgdG8gY29weSB0aGUgcHJlc2VudCB2YWx1ZSwgd2hpY2ggaXMgdGhlIG51bWVyaWMgaWQuXHJcbiAqIEBwcm9wZXJ0eSB7Kn0gW2J5dGVzXSBCeXRlcyB2YWx1ZSBjb252ZXJzaW9uIHR5cGUuXHJcbiAqIFZhbGlkIHZhbHVlcyBhcmUgYEFycmF5YCBhbmQgKGEgYmFzZTY0IGVuY29kZWQpIGBTdHJpbmdgICh0aGUgZ2xvYmFsIHR5cGVzKS5cclxuICogRGVmYXVsdHMgdG8gY29weSB0aGUgcHJlc2VudCB2YWx1ZSwgd2hpY2ggdXN1YWxseSBpcyBhIEJ1ZmZlciB1bmRlciBub2RlIGFuZCBhbiBVaW50OEFycmF5IGluIHRoZSBicm93c2VyLlxyXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IFtkZWZhdWx0cz1mYWxzZV0gQWxzbyBzZXRzIGRlZmF1bHQgdmFsdWVzIG9uIHRoZSByZXN1bHRpbmcgb2JqZWN0XHJcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gW2FycmF5cz1mYWxzZV0gU2V0cyBlbXB0eSBhcnJheXMgZm9yIG1pc3NpbmcgcmVwZWF0ZWQgZmllbGRzIGV2ZW4gaWYgYGRlZmF1bHRzPWZhbHNlYFxyXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IFtvYmplY3RzPWZhbHNlXSBTZXRzIGVtcHR5IG9iamVjdHMgZm9yIG1pc3NpbmcgbWFwIGZpZWxkcyBldmVuIGlmIGBkZWZhdWx0cz1mYWxzZWBcclxuICovXHJcblxyXG4vKipcclxuICogQ3JlYXRlcyBhIHBsYWluIG9iamVjdCBmcm9tIGEgbWVzc2FnZSBvZiB0aGlzIHR5cGUuIEFsc28gY29udmVydHMgdmFsdWVzIHRvIG90aGVyIHR5cGVzIGlmIHNwZWNpZmllZC5cclxuICogQHBhcmFtIHtNZXNzYWdlfSBtZXNzYWdlIE1lc3NhZ2UgaW5zdGFuY2VcclxuICogQHBhcmFtIHtDb252ZXJzaW9uT3B0aW9uc30gW29wdGlvbnNdIENvbnZlcnNpb24gb3B0aW9uc1xyXG4gKiBAcmV0dXJucyB7T2JqZWN0LjxzdHJpbmcsKj59IFBsYWluIG9iamVjdFxyXG4gKi9cclxuVHlwZS5wcm90b3R5cGUudG9PYmplY3QgPSBmdW5jdGlvbiB0b09iamVjdChtZXNzYWdlLCBvcHRpb25zKSB7XHJcbiAgICByZXR1cm4gdGhpcy5zZXR1cCgpLnRvT2JqZWN0KG1lc3NhZ2UsIG9wdGlvbnMpO1xyXG59O1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxuXHJcbi8qKlxyXG4gKiBDb21tb24gdHlwZSBjb25zdGFudHMuXHJcbiAqIEBuYW1lc3BhY2VcclxuICovXHJcbnZhciB0eXBlcyA9IGV4cG9ydHM7XHJcblxyXG52YXIgdXRpbCA9IHJlcXVpcmUoXCIuL3V0aWxcIik7XHJcblxyXG52YXIgcyA9IFtcclxuICAgIFwiZG91YmxlXCIsICAgLy8gMFxyXG4gICAgXCJmbG9hdFwiLCAgICAvLyAxXHJcbiAgICBcImludDMyXCIsICAgIC8vIDJcclxuICAgIFwidWludDMyXCIsICAgLy8gM1xyXG4gICAgXCJzaW50MzJcIiwgICAvLyA0XHJcbiAgICBcImZpeGVkMzJcIiwgIC8vIDVcclxuICAgIFwic2ZpeGVkMzJcIiwgLy8gNlxyXG4gICAgXCJpbnQ2NFwiLCAgICAvLyA3XHJcbiAgICBcInVpbnQ2NFwiLCAgIC8vIDhcclxuICAgIFwic2ludDY0XCIsICAgLy8gOVxyXG4gICAgXCJmaXhlZDY0XCIsICAvLyAxMFxyXG4gICAgXCJzZml4ZWQ2NFwiLCAvLyAxMVxyXG4gICAgXCJib29sXCIsICAgICAvLyAxMlxyXG4gICAgXCJzdHJpbmdcIiwgICAvLyAxM1xyXG4gICAgXCJieXRlc1wiICAgICAvLyAxNFxyXG5dO1xyXG5cclxuZnVuY3Rpb24gYmFrZSh2YWx1ZXMsIG9mZnNldCkge1xyXG4gICAgdmFyIGkgPSAwLCBvID0ge307XHJcbiAgICBvZmZzZXQgfD0gMDtcclxuICAgIHdoaWxlIChpIDwgdmFsdWVzLmxlbmd0aCkgb1tzW2kgKyBvZmZzZXRdXSA9IHZhbHVlc1tpKytdO1xyXG4gICAgcmV0dXJuIG87XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBCYXNpYyB0eXBlIHdpcmUgdHlwZXMuXHJcbiAqIEB0eXBlIHtPYmplY3QuPHN0cmluZyxudW1iZXI+fVxyXG4gKiBAcHJvcGVydHkge251bWJlcn0gZG91YmxlPTEgRml4ZWQ2NCB3aXJlIHR5cGVcclxuICogQHByb3BlcnR5IHtudW1iZXJ9IGZsb2F0PTUgRml4ZWQzMiB3aXJlIHR5cGVcclxuICogQHByb3BlcnR5IHtudW1iZXJ9IGludDMyPTAgVmFyaW50IHdpcmUgdHlwZVxyXG4gKiBAcHJvcGVydHkge251bWJlcn0gdWludDMyPTAgVmFyaW50IHdpcmUgdHlwZVxyXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2ludDMyPTAgVmFyaW50IHdpcmUgdHlwZVxyXG4gKiBAcHJvcGVydHkge251bWJlcn0gZml4ZWQzMj01IEZpeGVkMzIgd2lyZSB0eXBlXHJcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBzZml4ZWQzMj01IEZpeGVkMzIgd2lyZSB0eXBlXHJcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBpbnQ2ND0wIFZhcmludCB3aXJlIHR5cGVcclxuICogQHByb3BlcnR5IHtudW1iZXJ9IHVpbnQ2ND0wIFZhcmludCB3aXJlIHR5cGVcclxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNpbnQ2ND0wIFZhcmludCB3aXJlIHR5cGVcclxuICogQHByb3BlcnR5IHtudW1iZXJ9IGZpeGVkNjQ9MSBGaXhlZDY0IHdpcmUgdHlwZVxyXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2ZpeGVkNjQ9MSBGaXhlZDY0IHdpcmUgdHlwZVxyXG4gKiBAcHJvcGVydHkge251bWJlcn0gYm9vbD0wIFZhcmludCB3aXJlIHR5cGVcclxuICogQHByb3BlcnR5IHtudW1iZXJ9IHN0cmluZz0yIExkZWxpbSB3aXJlIHR5cGVcclxuICogQHByb3BlcnR5IHtudW1iZXJ9IGJ5dGVzPTIgTGRlbGltIHdpcmUgdHlwZVxyXG4gKi9cclxudHlwZXMuYmFzaWMgPSBiYWtlKFtcclxuICAgIC8qIGRvdWJsZSAgICovIDEsXHJcbiAgICAvKiBmbG9hdCAgICAqLyA1LFxyXG4gICAgLyogaW50MzIgICAgKi8gMCxcclxuICAgIC8qIHVpbnQzMiAgICovIDAsXHJcbiAgICAvKiBzaW50MzIgICAqLyAwLFxyXG4gICAgLyogZml4ZWQzMiAgKi8gNSxcclxuICAgIC8qIHNmaXhlZDMyICovIDUsXHJcbiAgICAvKiBpbnQ2NCAgICAqLyAwLFxyXG4gICAgLyogdWludDY0ICAgKi8gMCxcclxuICAgIC8qIHNpbnQ2NCAgICovIDAsXHJcbiAgICAvKiBmaXhlZDY0ICAqLyAxLFxyXG4gICAgLyogc2ZpeGVkNjQgKi8gMSxcclxuICAgIC8qIGJvb2wgICAgICovIDAsXHJcbiAgICAvKiBzdHJpbmcgICAqLyAyLFxyXG4gICAgLyogYnl0ZXMgICAgKi8gMlxyXG5dKTtcclxuXHJcbi8qKlxyXG4gKiBCYXNpYyB0eXBlIGRlZmF1bHRzLlxyXG4gKiBAdHlwZSB7T2JqZWN0LjxzdHJpbmcsKj59XHJcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBkb3VibGU9MCBEb3VibGUgZGVmYXVsdFxyXG4gKiBAcHJvcGVydHkge251bWJlcn0gZmxvYXQ9MCBGbG9hdCBkZWZhdWx0XHJcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBpbnQzMj0wIEludDMyIGRlZmF1bHRcclxuICogQHByb3BlcnR5IHtudW1iZXJ9IHVpbnQzMj0wIFVpbnQzMiBkZWZhdWx0XHJcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBzaW50MzI9MCBTaW50MzIgZGVmYXVsdFxyXG4gKiBAcHJvcGVydHkge251bWJlcn0gZml4ZWQzMj0wIEZpeGVkMzIgZGVmYXVsdFxyXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2ZpeGVkMzI9MCBTZml4ZWQzMiBkZWZhdWx0XHJcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBpbnQ2ND0wIEludDY0IGRlZmF1bHRcclxuICogQHByb3BlcnR5IHtudW1iZXJ9IHVpbnQ2ND0wIFVpbnQ2NCBkZWZhdWx0XHJcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBzaW50NjQ9MCBTaW50MzIgZGVmYXVsdFxyXG4gKiBAcHJvcGVydHkge251bWJlcn0gZml4ZWQ2ND0wIEZpeGVkNjQgZGVmYXVsdFxyXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2ZpeGVkNjQ9MCBTZml4ZWQ2NCBkZWZhdWx0XHJcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gYm9vbD1mYWxzZSBCb29sIGRlZmF1bHRcclxuICogQHByb3BlcnR5IHtzdHJpbmd9IHN0cmluZz1cIlwiIFN0cmluZyBkZWZhdWx0XHJcbiAqIEBwcm9wZXJ0eSB7QXJyYXkuPG51bWJlcj59IGJ5dGVzPUFycmF5KDApIEJ5dGVzIGRlZmF1bHRcclxuICogQHByb3BlcnR5IHtNZXNzYWdlfSBtZXNzYWdlPW51bGwgTWVzc2FnZSBkZWZhdWx0XHJcbiAqL1xyXG50eXBlcy5kZWZhdWx0cyA9IGJha2UoW1xyXG4gICAgLyogZG91YmxlICAgKi8gMCxcclxuICAgIC8qIGZsb2F0ICAgICovIDAsXHJcbiAgICAvKiBpbnQzMiAgICAqLyAwLFxyXG4gICAgLyogdWludDMyICAgKi8gMCxcclxuICAgIC8qIHNpbnQzMiAgICovIDAsXHJcbiAgICAvKiBmaXhlZDMyICAqLyAwLFxyXG4gICAgLyogc2ZpeGVkMzIgKi8gMCxcclxuICAgIC8qIGludDY0ICAgICovIDAsXHJcbiAgICAvKiB1aW50NjQgICAqLyAwLFxyXG4gICAgLyogc2ludDY0ICAgKi8gMCxcclxuICAgIC8qIGZpeGVkNjQgICovIDAsXHJcbiAgICAvKiBzZml4ZWQ2NCAqLyAwLFxyXG4gICAgLyogYm9vbCAgICAgKi8gZmFsc2UsXHJcbiAgICAvKiBzdHJpbmcgICAqLyBcIlwiLFxyXG4gICAgLyogYnl0ZXMgICAgKi8gdXRpbC5lbXB0eUFycmF5LFxyXG4gICAgLyogbWVzc2FnZSAgKi8gbnVsbFxyXG5dKTtcclxuXHJcbi8qKlxyXG4gKiBCYXNpYyBsb25nIHR5cGUgd2lyZSB0eXBlcy5cclxuICogQHR5cGUge09iamVjdC48c3RyaW5nLG51bWJlcj59XHJcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBpbnQ2ND0wIFZhcmludCB3aXJlIHR5cGVcclxuICogQHByb3BlcnR5IHtudW1iZXJ9IHVpbnQ2ND0wIFZhcmludCB3aXJlIHR5cGVcclxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNpbnQ2ND0wIFZhcmludCB3aXJlIHR5cGVcclxuICogQHByb3BlcnR5IHtudW1iZXJ9IGZpeGVkNjQ9MSBGaXhlZDY0IHdpcmUgdHlwZVxyXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2ZpeGVkNjQ9MSBGaXhlZDY0IHdpcmUgdHlwZVxyXG4gKi9cclxudHlwZXMubG9uZyA9IGJha2UoW1xyXG4gICAgLyogaW50NjQgICAgKi8gMCxcclxuICAgIC8qIHVpbnQ2NCAgICovIDAsXHJcbiAgICAvKiBzaW50NjQgICAqLyAwLFxyXG4gICAgLyogZml4ZWQ2NCAgKi8gMSxcclxuICAgIC8qIHNmaXhlZDY0ICovIDFcclxuXSwgNyk7XHJcblxyXG4vKipcclxuICogQWxsb3dlZCB0eXBlcyBmb3IgbWFwIGtleXMgd2l0aCB0aGVpciBhc3NvY2lhdGVkIHdpcmUgdHlwZS5cclxuICogQHR5cGUge09iamVjdC48c3RyaW5nLG51bWJlcj59XHJcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBpbnQzMj0wIFZhcmludCB3aXJlIHR5cGVcclxuICogQHByb3BlcnR5IHtudW1iZXJ9IHVpbnQzMj0wIFZhcmludCB3aXJlIHR5cGVcclxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNpbnQzMj0wIFZhcmludCB3aXJlIHR5cGVcclxuICogQHByb3BlcnR5IHtudW1iZXJ9IGZpeGVkMzI9NSBGaXhlZDMyIHdpcmUgdHlwZVxyXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2ZpeGVkMzI9NSBGaXhlZDMyIHdpcmUgdHlwZVxyXG4gKiBAcHJvcGVydHkge251bWJlcn0gaW50NjQ9MCBWYXJpbnQgd2lyZSB0eXBlXHJcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSB1aW50NjQ9MCBWYXJpbnQgd2lyZSB0eXBlXHJcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBzaW50NjQ9MCBWYXJpbnQgd2lyZSB0eXBlXHJcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBmaXhlZDY0PTEgRml4ZWQ2NCB3aXJlIHR5cGVcclxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNmaXhlZDY0PTEgRml4ZWQ2NCB3aXJlIHR5cGVcclxuICogQHByb3BlcnR5IHtudW1iZXJ9IGJvb2w9MCBWYXJpbnQgd2lyZSB0eXBlXHJcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBzdHJpbmc9MiBMZGVsaW0gd2lyZSB0eXBlXHJcbiAqL1xyXG50eXBlcy5tYXBLZXkgPSBiYWtlKFtcclxuICAgIC8qIGludDMyICAgICovIDAsXHJcbiAgICAvKiB1aW50MzIgICAqLyAwLFxyXG4gICAgLyogc2ludDMyICAgKi8gMCxcclxuICAgIC8qIGZpeGVkMzIgICovIDUsXHJcbiAgICAvKiBzZml4ZWQzMiAqLyA1LFxyXG4gICAgLyogaW50NjQgICAgKi8gMCxcclxuICAgIC8qIHVpbnQ2NCAgICovIDAsXHJcbiAgICAvKiBzaW50NjQgICAqLyAwLFxyXG4gICAgLyogZml4ZWQ2NCAgKi8gMSxcclxuICAgIC8qIHNmaXhlZDY0ICovIDEsXHJcbiAgICAvKiBib29sICAgICAqLyAwLFxyXG4gICAgLyogc3RyaW5nICAgKi8gMlxyXG5dLCAyKTtcclxuXHJcbi8qKlxyXG4gKiBBbGxvd2VkIHR5cGVzIGZvciBwYWNrZWQgcmVwZWF0ZWQgZmllbGRzIHdpdGggdGhlaXIgYXNzb2NpYXRlZCB3aXJlIHR5cGUuXHJcbiAqIEB0eXBlIHtPYmplY3QuPHN0cmluZyxudW1iZXI+fVxyXG4gKiBAcHJvcGVydHkge251bWJlcn0gZG91YmxlPTEgRml4ZWQ2NCB3aXJlIHR5cGVcclxuICogQHByb3BlcnR5IHtudW1iZXJ9IGZsb2F0PTUgRml4ZWQzMiB3aXJlIHR5cGVcclxuICogQHByb3BlcnR5IHtudW1iZXJ9IGludDMyPTAgVmFyaW50IHdpcmUgdHlwZVxyXG4gKiBAcHJvcGVydHkge251bWJlcn0gdWludDMyPTAgVmFyaW50IHdpcmUgdHlwZVxyXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2ludDMyPTAgVmFyaW50IHdpcmUgdHlwZVxyXG4gKiBAcHJvcGVydHkge251bWJlcn0gZml4ZWQzMj01IEZpeGVkMzIgd2lyZSB0eXBlXHJcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBzZml4ZWQzMj01IEZpeGVkMzIgd2lyZSB0eXBlXHJcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBpbnQ2ND0wIFZhcmludCB3aXJlIHR5cGVcclxuICogQHByb3BlcnR5IHtudW1iZXJ9IHVpbnQ2ND0wIFZhcmludCB3aXJlIHR5cGVcclxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNpbnQ2ND0wIFZhcmludCB3aXJlIHR5cGVcclxuICogQHByb3BlcnR5IHtudW1iZXJ9IGZpeGVkNjQ9MSBGaXhlZDY0IHdpcmUgdHlwZVxyXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2ZpeGVkNjQ9MSBGaXhlZDY0IHdpcmUgdHlwZVxyXG4gKiBAcHJvcGVydHkge251bWJlcn0gYm9vbD0wIFZhcmludCB3aXJlIHR5cGVcclxuICovXHJcbnR5cGVzLnBhY2tlZCA9IGJha2UoW1xyXG4gICAgLyogZG91YmxlICAgKi8gMSxcclxuICAgIC8qIGZsb2F0ICAgICovIDUsXHJcbiAgICAvKiBpbnQzMiAgICAqLyAwLFxyXG4gICAgLyogdWludDMyICAgKi8gMCxcclxuICAgIC8qIHNpbnQzMiAgICovIDAsXHJcbiAgICAvKiBmaXhlZDMyICAqLyA1LFxyXG4gICAgLyogc2ZpeGVkMzIgKi8gNSxcclxuICAgIC8qIGludDY0ICAgICovIDAsXHJcbiAgICAvKiB1aW50NjQgICAqLyAwLFxyXG4gICAgLyogc2ludDY0ICAgKi8gMCxcclxuICAgIC8qIGZpeGVkNjQgICovIDEsXHJcbiAgICAvKiBzZml4ZWQ2NCAqLyAxLFxyXG4gICAgLyogYm9vbCAgICAgKi8gMFxyXG5dKTtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4vKipcclxuICogVmFyaW91cyB1dGlsaXR5IGZ1bmN0aW9ucy5cclxuICogQG5hbWVzcGFjZVxyXG4gKi9cclxudmFyIHV0aWwgPSBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCIuL3V0aWwvbWluaW1hbFwiKTtcclxuXHJcbnV0aWwuY29kZWdlbiA9IHJlcXVpcmUoXCJAcHJvdG9idWZqcy9jb2RlZ2VuXCIpO1xyXG51dGlsLmZldGNoICAgPSByZXF1aXJlKFwiQHByb3RvYnVmanMvZmV0Y2hcIik7XHJcbnV0aWwucGF0aCAgICA9IHJlcXVpcmUoXCJAcHJvdG9idWZqcy9wYXRoXCIpO1xyXG5cclxuLyoqXHJcbiAqIE5vZGUncyBmcyBtb2R1bGUgaWYgYXZhaWxhYmxlLlxyXG4gKiBAdHlwZSB7T2JqZWN0LjxzdHJpbmcsKj59XHJcbiAqL1xyXG51dGlsLmZzID0gdXRpbC5pbnF1aXJlKFwiZnNcIik7XHJcblxyXG4vKipcclxuICogQ29udmVydHMgYW4gb2JqZWN0J3MgdmFsdWVzIHRvIGFuIGFycmF5LlxyXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCo+fSBvYmplY3QgT2JqZWN0IHRvIGNvbnZlcnRcclxuICogQHJldHVybnMge0FycmF5LjwqPn0gQ29udmVydGVkIGFycmF5XHJcbiAqL1xyXG51dGlsLnRvQXJyYXkgPSBmdW5jdGlvbiB0b0FycmF5KG9iamVjdCkge1xyXG4gICAgdmFyIGFycmF5ID0gW107XHJcbiAgICBpZiAob2JqZWN0KVxyXG4gICAgICAgIGZvciAodmFyIGtleXMgPSBPYmplY3Qua2V5cyhvYmplY3QpLCBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyArK2kpXHJcbiAgICAgICAgICAgIGFycmF5LnB1c2gob2JqZWN0W2tleXNbaV1dKTtcclxuICAgIHJldHVybiBhcnJheTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZXR1cm5zIGEgc2FmZSBwcm9wZXJ0eSBhY2Nlc3NvciBmb3IgdGhlIHNwZWNpZmllZCBwcm9wZXJseSBuYW1lLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gcHJvcCBQcm9wZXJ0eSBuYW1lXHJcbiAqIEByZXR1cm5zIHtzdHJpbmd9IFNhZmUgYWNjZXNzb3JcclxuICovXHJcbnV0aWwuc2FmZVByb3AgPSBmdW5jdGlvbiBzYWZlUHJvcChwcm9wKSB7XHJcbiAgICByZXR1cm4gXCJbXFxcIlwiICsgcHJvcC5yZXBsYWNlKC9cXFxcL2csIFwiXFxcXFxcXFxcIikucmVwbGFjZSgvXCIvZywgXCJcXFxcXFxcIlwiKSArIFwiXFxcIl1cIjtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDb252ZXJ0cyB0aGUgZmlyc3QgY2hhcmFjdGVyIG9mIGEgc3RyaW5nIHRvIHVwcGVyIGNhc2UuXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBzdHIgU3RyaW5nIHRvIGNvbnZlcnRcclxuICogQHJldHVybnMge3N0cmluZ30gQ29udmVydGVkIHN0cmluZ1xyXG4gKi9cclxudXRpbC51Y0ZpcnN0ID0gZnVuY3Rpb24gdWNGaXJzdChzdHIpIHtcclxuICAgIHJldHVybiBzdHIuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBzdHIuc3Vic3RyaW5nKDEpO1xyXG59O1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxubW9kdWxlLmV4cG9ydHMgPSBMb25nQml0cztcclxuXHJcbnZhciB1dGlsID0gcmVxdWlyZShcIi4uL3V0aWwvbWluaW1hbFwiKTtcclxuXHJcbi8qKlxyXG4gKiBBbnkgY29tcGF0aWJsZSBMb25nIGluc3RhbmNlLlxyXG4gKiBcclxuICogVGhpcyBpcyBhIG1pbmltYWwgc3RhbmQtYWxvbmUgZGVmaW5pdGlvbiBvZiBhIExvbmcgaW5zdGFuY2UuIFRoZSBhY3R1YWwgdHlwZSBpcyB0aGF0IGV4cG9ydGVkIGJ5IGxvbmcuanMuXHJcbiAqIEB0eXBlZGVmIExvbmdcclxuICogQHR5cGUge09iamVjdH1cclxuICogQHByb3BlcnR5IHtudW1iZXJ9IGxvdyBMb3cgYml0c1xyXG4gKiBAcHJvcGVydHkge251bWJlcn0gaGlnaCBIaWdoIGJpdHNcclxuICogQHByb3BlcnR5IHtib29sZWFufSB1bnNpZ25lZCBXaGV0aGVyIHVuc2lnbmVkIG9yIG5vdFxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBDb25zdHJ1Y3RzIG5ldyBsb25nIGJpdHMuXHJcbiAqIEBjbGFzc2Rlc2MgSGVscGVyIGNsYXNzIGZvciB3b3JraW5nIHdpdGggdGhlIGxvdyBhbmQgaGlnaCBiaXRzIG9mIGEgNjQgYml0IHZhbHVlLlxyXG4gKiBAbWVtYmVyb2YgdXRpbFxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQHBhcmFtIHtudW1iZXJ9IGxvIExvdyAzMiBiaXRzLCB1bnNpZ25lZFxyXG4gKiBAcGFyYW0ge251bWJlcn0gaGkgSGlnaCAzMiBiaXRzLCB1bnNpZ25lZFxyXG4gKi9cclxuZnVuY3Rpb24gTG9uZ0JpdHMobG8sIGhpKSB7XHJcblxyXG4gICAgLy8gbm90ZSB0aGF0IHRoZSBjYXN0cyBiZWxvdyBhcmUgdGhlb3JldGljYWxseSB1bm5lY2Vzc2FyeSBhcyBvZiB0b2RheSwgYnV0IG9sZGVyIHN0YXRpY2FsbHlcclxuICAgIC8vIGdlbmVyYXRlZCBjb252ZXJ0ZXIgY29kZSBtaWdodCBzdGlsbCBjYWxsIHRoZSBjdG9yIHdpdGggc2lnbmVkIDMyYml0cy4ga2VwdCBmb3IgY29tcGF0LlxyXG5cclxuICAgIC8qKlxyXG4gICAgICogTG93IGJpdHMuXHJcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxyXG4gICAgICovXHJcbiAgICB0aGlzLmxvID0gbG8gPj4+IDA7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBIaWdoIGJpdHMuXHJcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxyXG4gICAgICovXHJcbiAgICB0aGlzLmhpID0gaGkgPj4+IDA7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBaZXJvIGJpdHMuXHJcbiAqIEBtZW1iZXJvZiB1dGlsLkxvbmdCaXRzXHJcbiAqIEB0eXBlIHt1dGlsLkxvbmdCaXRzfVxyXG4gKi9cclxudmFyIHplcm8gPSBMb25nQml0cy56ZXJvID0gbmV3IExvbmdCaXRzKDAsIDApO1xyXG5cclxuemVyby50b051bWJlciA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcclxuemVyby56ekVuY29kZSA9IHplcm8uenpEZWNvZGUgPSBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXM7IH07XHJcbnplcm8ubGVuZ3RoID0gZnVuY3Rpb24oKSB7IHJldHVybiAxOyB9O1xyXG5cclxuLyoqXHJcbiAqIFplcm8gaGFzaC5cclxuICogQG1lbWJlcm9mIHV0aWwuTG9uZ0JpdHNcclxuICogQHR5cGUge3N0cmluZ31cclxuICovXHJcbnZhciB6ZXJvSGFzaCA9IExvbmdCaXRzLnplcm9IYXNoID0gXCJcXDBcXDBcXDBcXDBcXDBcXDBcXDBcXDBcIjtcclxuXHJcbi8qKlxyXG4gKiBDb25zdHJ1Y3RzIG5ldyBsb25nIGJpdHMgZnJvbSB0aGUgc3BlY2lmaWVkIG51bWJlci5cclxuICogQHBhcmFtIHtudW1iZXJ9IHZhbHVlIFZhbHVlXHJcbiAqIEByZXR1cm5zIHt1dGlsLkxvbmdCaXRzfSBJbnN0YW5jZVxyXG4gKi9cclxuTG9uZ0JpdHMuZnJvbU51bWJlciA9IGZ1bmN0aW9uIGZyb21OdW1iZXIodmFsdWUpIHtcclxuICAgIGlmICh2YWx1ZSA9PT0gMClcclxuICAgICAgICByZXR1cm4gemVybztcclxuICAgIHZhciBzaWduID0gdmFsdWUgPCAwO1xyXG4gICAgaWYgKHNpZ24pXHJcbiAgICAgICAgdmFsdWUgPSAtdmFsdWU7XHJcbiAgICB2YXIgbG8gPSB2YWx1ZSA+Pj4gMCxcclxuICAgICAgICBoaSA9ICh2YWx1ZSAtIGxvKSAvIDQyOTQ5NjcyOTYgPj4+IDA7IFxyXG4gICAgaWYgKHNpZ24pIHtcclxuICAgICAgICBoaSA9IH5oaSA+Pj4gMDtcclxuICAgICAgICBsbyA9IH5sbyA+Pj4gMDtcclxuICAgICAgICBpZiAoKytsbyA+IDQyOTQ5NjcyOTUpIHtcclxuICAgICAgICAgICAgbG8gPSAwO1xyXG4gICAgICAgICAgICBpZiAoKytoaSA+IDQyOTQ5NjcyOTUpXHJcbiAgICAgICAgICAgICAgICBoaSA9IDA7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIG5ldyBMb25nQml0cyhsbywgaGkpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENvbnN0cnVjdHMgbmV3IGxvbmcgYml0cyBmcm9tIGEgbnVtYmVyLCBsb25nIG9yIHN0cmluZy5cclxuICogQHBhcmFtIHtMb25nfG51bWJlcnxzdHJpbmd9IHZhbHVlIFZhbHVlXHJcbiAqIEByZXR1cm5zIHt1dGlsLkxvbmdCaXRzfSBJbnN0YW5jZVxyXG4gKi9cclxuTG9uZ0JpdHMuZnJvbSA9IGZ1bmN0aW9uIGZyb20odmFsdWUpIHtcclxuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IFwibnVtYmVyXCIpXHJcbiAgICAgICAgcmV0dXJuIExvbmdCaXRzLmZyb21OdW1iZXIodmFsdWUpO1xyXG4gICAgaWYgKHV0aWwuaXNTdHJpbmcodmFsdWUpKSB7XHJcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIGVsc2UgKi9cclxuICAgICAgICBpZiAodXRpbC5Mb25nKVxyXG4gICAgICAgICAgICB2YWx1ZSA9IHV0aWwuTG9uZy5mcm9tU3RyaW5nKHZhbHVlKTtcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgIHJldHVybiBMb25nQml0cy5mcm9tTnVtYmVyKHBhcnNlSW50KHZhbHVlLCAxMCkpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHZhbHVlLmxvdyB8fCB2YWx1ZS5oaWdoID8gbmV3IExvbmdCaXRzKHZhbHVlLmxvdyA+Pj4gMCwgdmFsdWUuaGlnaCA+Pj4gMCkgOiB6ZXJvO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENvbnZlcnRzIHRoaXMgbG9uZyBiaXRzIHRvIGEgcG9zc2libHkgdW5zYWZlIEphdmFTY3JpcHQgbnVtYmVyLlxyXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFt1bnNpZ25lZD1mYWxzZV0gV2hldGhlciB1bnNpZ25lZCBvciBub3RcclxuICogQHJldHVybnMge251bWJlcn0gUG9zc2libHkgdW5zYWZlIG51bWJlclxyXG4gKi9cclxuTG9uZ0JpdHMucHJvdG90eXBlLnRvTnVtYmVyID0gZnVuY3Rpb24gdG9OdW1iZXIodW5zaWduZWQpIHtcclxuICAgIGlmICghdW5zaWduZWQgJiYgdGhpcy5oaSA+Pj4gMzEpIHtcclxuICAgICAgICB2YXIgbG8gPSB+dGhpcy5sbyArIDEgPj4+IDAsXHJcbiAgICAgICAgICAgIGhpID0gfnRoaXMuaGkgICAgID4+PiAwO1xyXG4gICAgICAgIGlmICghbG8pXHJcbiAgICAgICAgICAgIGhpID0gaGkgKyAxID4+PiAwO1xyXG4gICAgICAgIHJldHVybiAtKGxvICsgaGkgKiA0Mjk0OTY3Mjk2KTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLmxvICsgdGhpcy5oaSAqIDQyOTQ5NjcyOTY7XHJcbn07XHJcblxyXG4vKipcclxuICogQ29udmVydHMgdGhpcyBsb25nIGJpdHMgdG8gYSBsb25nLlxyXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFt1bnNpZ25lZD1mYWxzZV0gV2hldGhlciB1bnNpZ25lZCBvciBub3RcclxuICogQHJldHVybnMge0xvbmd9IExvbmdcclxuICovXHJcbkxvbmdCaXRzLnByb3RvdHlwZS50b0xvbmcgPSBmdW5jdGlvbiB0b0xvbmcodW5zaWduZWQpIHtcclxuICAgIHJldHVybiB1dGlsLkxvbmdcclxuICAgICAgICA/IG5ldyB1dGlsLkxvbmcodGhpcy5sbyB8IDAsIHRoaXMuaGkgfCAwLCBCb29sZWFuKHVuc2lnbmVkKSlcclxuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgICAgIDogeyBsb3c6IHRoaXMubG8gfCAwLCBoaWdoOiB0aGlzLmhpIHwgMCwgdW5zaWduZWQ6IEJvb2xlYW4odW5zaWduZWQpIH07XHJcbn07XHJcblxyXG52YXIgY2hhckNvZGVBdCA9IFN0cmluZy5wcm90b3R5cGUuY2hhckNvZGVBdDtcclxuXHJcbi8qKlxyXG4gKiBDb25zdHJ1Y3RzIG5ldyBsb25nIGJpdHMgZnJvbSB0aGUgc3BlY2lmaWVkIDggY2hhcmFjdGVycyBsb25nIGhhc2guXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBoYXNoIEhhc2hcclxuICogQHJldHVybnMge3V0aWwuTG9uZ0JpdHN9IEJpdHNcclxuICovXHJcbkxvbmdCaXRzLmZyb21IYXNoID0gZnVuY3Rpb24gZnJvbUhhc2goaGFzaCkge1xyXG4gICAgaWYgKGhhc2ggPT09IHplcm9IYXNoKVxyXG4gICAgICAgIHJldHVybiB6ZXJvO1xyXG4gICAgcmV0dXJuIG5ldyBMb25nQml0cyhcclxuICAgICAgICAoIGNoYXJDb2RlQXQuY2FsbChoYXNoLCAwKVxyXG4gICAgICAgIHwgY2hhckNvZGVBdC5jYWxsKGhhc2gsIDEpIDw8IDhcclxuICAgICAgICB8IGNoYXJDb2RlQXQuY2FsbChoYXNoLCAyKSA8PCAxNlxyXG4gICAgICAgIHwgY2hhckNvZGVBdC5jYWxsKGhhc2gsIDMpIDw8IDI0KSA+Pj4gMFxyXG4gICAgLFxyXG4gICAgICAgICggY2hhckNvZGVBdC5jYWxsKGhhc2gsIDQpXHJcbiAgICAgICAgfCBjaGFyQ29kZUF0LmNhbGwoaGFzaCwgNSkgPDwgOFxyXG4gICAgICAgIHwgY2hhckNvZGVBdC5jYWxsKGhhc2gsIDYpIDw8IDE2XHJcbiAgICAgICAgfCBjaGFyQ29kZUF0LmNhbGwoaGFzaCwgNykgPDwgMjQpID4+PiAwXHJcbiAgICApO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENvbnZlcnRzIHRoaXMgbG9uZyBiaXRzIHRvIGEgOCBjaGFyYWN0ZXJzIGxvbmcgaGFzaC5cclxuICogQHJldHVybnMge3N0cmluZ30gSGFzaFxyXG4gKi9cclxuTG9uZ0JpdHMucHJvdG90eXBlLnRvSGFzaCA9IGZ1bmN0aW9uIHRvSGFzaCgpIHtcclxuICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKFxyXG4gICAgICAgIHRoaXMubG8gICAgICAgICYgMjU1LFxyXG4gICAgICAgIHRoaXMubG8gPj4+IDggICYgMjU1LFxyXG4gICAgICAgIHRoaXMubG8gPj4+IDE2ICYgMjU1LFxyXG4gICAgICAgIHRoaXMubG8gPj4+IDI0ICAgICAgLFxyXG4gICAgICAgIHRoaXMuaGkgICAgICAgICYgMjU1LFxyXG4gICAgICAgIHRoaXMuaGkgPj4+IDggICYgMjU1LFxyXG4gICAgICAgIHRoaXMuaGkgPj4+IDE2ICYgMjU1LFxyXG4gICAgICAgIHRoaXMuaGkgPj4+IDI0XHJcbiAgICApO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFppZy16YWcgZW5jb2RlcyB0aGlzIGxvbmcgYml0cy5cclxuICogQHJldHVybnMge3V0aWwuTG9uZ0JpdHN9IGB0aGlzYFxyXG4gKi9cclxuTG9uZ0JpdHMucHJvdG90eXBlLnp6RW5jb2RlID0gZnVuY3Rpb24genpFbmNvZGUoKSB7XHJcbiAgICB2YXIgbWFzayA9ICAgdGhpcy5oaSA+PiAzMTtcclxuICAgIHRoaXMuaGkgID0gKCh0aGlzLmhpIDw8IDEgfCB0aGlzLmxvID4+PiAzMSkgXiBtYXNrKSA+Pj4gMDtcclxuICAgIHRoaXMubG8gID0gKCB0aGlzLmxvIDw8IDEgICAgICAgICAgICAgICAgICAgXiBtYXNrKSA+Pj4gMDtcclxuICAgIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFppZy16YWcgZGVjb2RlcyB0aGlzIGxvbmcgYml0cy5cclxuICogQHJldHVybnMge3V0aWwuTG9uZ0JpdHN9IGB0aGlzYFxyXG4gKi9cclxuTG9uZ0JpdHMucHJvdG90eXBlLnp6RGVjb2RlID0gZnVuY3Rpb24genpEZWNvZGUoKSB7XHJcbiAgICB2YXIgbWFzayA9IC0odGhpcy5sbyAmIDEpO1xyXG4gICAgdGhpcy5sbyAgPSAoKHRoaXMubG8gPj4+IDEgfCB0aGlzLmhpIDw8IDMxKSBeIG1hc2spID4+PiAwO1xyXG4gICAgdGhpcy5oaSAgPSAoIHRoaXMuaGkgPj4+IDEgICAgICAgICAgICAgICAgICBeIG1hc2spID4+PiAwO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG4vKipcclxuICogQ2FsY3VsYXRlcyB0aGUgbGVuZ3RoIG9mIHRoaXMgbG9uZ2JpdHMgd2hlbiBlbmNvZGVkIGFzIGEgdmFyaW50LlxyXG4gKiBAcmV0dXJucyB7bnVtYmVyfSBMZW5ndGhcclxuICovXHJcbkxvbmdCaXRzLnByb3RvdHlwZS5sZW5ndGggPSBmdW5jdGlvbiBsZW5ndGgoKSB7XHJcbiAgICB2YXIgcGFydDAgPSAgdGhpcy5sbyxcclxuICAgICAgICBwYXJ0MSA9ICh0aGlzLmxvID4+PiAyOCB8IHRoaXMuaGkgPDwgNCkgPj4+IDAsXHJcbiAgICAgICAgcGFydDIgPSAgdGhpcy5oaSA+Pj4gMjQ7XHJcbiAgICByZXR1cm4gcGFydDIgPT09IDBcclxuICAgICAgICAgPyBwYXJ0MSA9PT0gMFxyXG4gICAgICAgICAgID8gcGFydDAgPCAxNjM4NFxyXG4gICAgICAgICAgICAgPyBwYXJ0MCA8IDEyOCA/IDEgOiAyXHJcbiAgICAgICAgICAgICA6IHBhcnQwIDwgMjA5NzE1MiA/IDMgOiA0XHJcbiAgICAgICAgICAgOiBwYXJ0MSA8IDE2Mzg0XHJcbiAgICAgICAgICAgICA/IHBhcnQxIDwgMTI4ID8gNSA6IDZcclxuICAgICAgICAgICAgIDogcGFydDEgPCAyMDk3MTUyID8gNyA6IDhcclxuICAgICAgICAgOiBwYXJ0MiA8IDEyOCA/IDkgOiAxMDtcclxufTtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbnZhciB1dGlsID0gZXhwb3J0cztcclxuXHJcbi8vIHVzZWQgdG8gcmV0dXJuIGEgUHJvbWlzZSB3aGVyZSBjYWxsYmFjayBpcyBvbWl0dGVkXHJcbnV0aWwuYXNQcm9taXNlID0gcmVxdWlyZShcIkBwcm90b2J1ZmpzL2FzcHJvbWlzZVwiKTtcclxuXHJcbi8vIGNvbnZlcnRzIHRvIC8gZnJvbSBiYXNlNjQgZW5jb2RlZCBzdHJpbmdzXHJcbnV0aWwuYmFzZTY0ID0gcmVxdWlyZShcIkBwcm90b2J1ZmpzL2Jhc2U2NFwiKTtcclxuXHJcbi8vIGJhc2UgY2xhc3Mgb2YgcnBjLlNlcnZpY2VcclxudXRpbC5FdmVudEVtaXR0ZXIgPSByZXF1aXJlKFwiQHByb3RvYnVmanMvZXZlbnRlbWl0dGVyXCIpO1xyXG5cclxuLy8gcmVxdWlyZXMgbW9kdWxlcyBvcHRpb25hbGx5IGFuZCBoaWRlcyB0aGUgY2FsbCBmcm9tIGJ1bmRsZXJzXHJcbnV0aWwuaW5xdWlyZSA9IHJlcXVpcmUoXCJAcHJvdG9idWZqcy9pbnF1aXJlXCIpO1xyXG5cclxuLy8gY29udmVydCB0byAvIGZyb20gdXRmOCBlbmNvZGVkIHN0cmluZ3NcclxudXRpbC51dGY4ID0gcmVxdWlyZShcIkBwcm90b2J1ZmpzL3V0ZjhcIik7XHJcblxyXG4vLyBwcm92aWRlcyBhIG5vZGUtbGlrZSBidWZmZXIgcG9vbCBpbiB0aGUgYnJvd3NlclxyXG51dGlsLnBvb2wgPSByZXF1aXJlKFwiQHByb3RvYnVmanMvcG9vbFwiKTtcclxuXHJcbi8vIHV0aWxpdHkgdG8gd29yayB3aXRoIHRoZSBsb3cgYW5kIGhpZ2ggYml0cyBvZiBhIDY0IGJpdCB2YWx1ZVxyXG51dGlsLkxvbmdCaXRzID0gcmVxdWlyZShcIi4vbG9uZ2JpdHNcIik7XHJcblxyXG4vKipcclxuICogQW4gaW1tdWFibGUgZW1wdHkgYXJyYXkuXHJcbiAqIEBtZW1iZXJvZiB1dGlsXHJcbiAqIEB0eXBlIHtBcnJheS48Kj59XHJcbiAqL1xyXG51dGlsLmVtcHR5QXJyYXkgPSBPYmplY3QuZnJlZXplID8gT2JqZWN0LmZyZWV6ZShbXSkgOiAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqLyBbXTsgLy8gdXNlZCBvbiBwcm90b3R5cGVzXHJcblxyXG4vKipcclxuICogQW4gaW1tdXRhYmxlIGVtcHR5IG9iamVjdC5cclxuICogQHR5cGUge09iamVjdH1cclxuICovXHJcbnV0aWwuZW1wdHlPYmplY3QgPSBPYmplY3QuZnJlZXplID8gT2JqZWN0LmZyZWV6ZSh7fSkgOiAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqLyB7fTsgLy8gdXNlZCBvbiBwcm90b3R5cGVzXHJcblxyXG4vKipcclxuICogV2hldGhlciBydW5uaW5nIHdpdGhpbiBub2RlIG9yIG5vdC5cclxuICogQG1lbWJlcm9mIHV0aWxcclxuICogQHR5cGUge2Jvb2xlYW59XHJcbiAqL1xyXG51dGlsLmlzTm9kZSA9IEJvb2xlYW4oZ2xvYmFsLnByb2Nlc3MgJiYgZ2xvYmFsLnByb2Nlc3MudmVyc2lvbnMgJiYgZ2xvYmFsLnByb2Nlc3MudmVyc2lvbnMubm9kZSk7XHJcblxyXG4vKipcclxuICogVGVzdHMgaWYgdGhlIHNwZWNpZmllZCB2YWx1ZSBpcyBhbiBpbnRlZ2VyLlxyXG4gKiBAZnVuY3Rpb25cclxuICogQHBhcmFtIHsqfSB2YWx1ZSBWYWx1ZSB0byB0ZXN0XHJcbiAqIEByZXR1cm5zIHtib29sZWFufSBgdHJ1ZWAgaWYgdGhlIHZhbHVlIGlzIGFuIGludGVnZXJcclxuICovXHJcbnV0aWwuaXNJbnRlZ2VyID0gTnVtYmVyLmlzSW50ZWdlciB8fCAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqLyBmdW5jdGlvbiBpc0ludGVnZXIodmFsdWUpIHtcclxuICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09IFwibnVtYmVyXCIgJiYgaXNGaW5pdGUodmFsdWUpICYmIE1hdGguZmxvb3IodmFsdWUpID09PSB2YWx1ZTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBUZXN0cyBpZiB0aGUgc3BlY2lmaWVkIHZhbHVlIGlzIGEgc3RyaW5nLlxyXG4gKiBAcGFyYW0geyp9IHZhbHVlIFZhbHVlIHRvIHRlc3RcclxuICogQHJldHVybnMge2Jvb2xlYW59IGB0cnVlYCBpZiB0aGUgdmFsdWUgaXMgYSBzdHJpbmdcclxuICovXHJcbnV0aWwuaXNTdHJpbmcgPSBmdW5jdGlvbiBpc1N0cmluZyh2YWx1ZSkge1xyXG4gICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gXCJzdHJpbmdcIiB8fCB2YWx1ZSBpbnN0YW5jZW9mIFN0cmluZztcclxufTtcclxuXHJcbi8qKlxyXG4gKiBUZXN0cyBpZiB0aGUgc3BlY2lmaWVkIHZhbHVlIGlzIGEgbm9uLW51bGwgb2JqZWN0LlxyXG4gKiBAcGFyYW0geyp9IHZhbHVlIFZhbHVlIHRvIHRlc3RcclxuICogQHJldHVybnMge2Jvb2xlYW59IGB0cnVlYCBpZiB0aGUgdmFsdWUgaXMgYSBub24tbnVsbCBvYmplY3RcclxuICovXHJcbnV0aWwuaXNPYmplY3QgPSBmdW5jdGlvbiBpc09iamVjdCh2YWx1ZSkge1xyXG4gICAgcmV0dXJuIHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gXCJvYmplY3RcIjtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBOb2RlJ3MgQnVmZmVyIGNsYXNzIGlmIGF2YWlsYWJsZS5cclxuICogQHR5cGUgez9mdW5jdGlvbihuZXc6IEJ1ZmZlcil9XHJcbiAqL1xyXG51dGlsLkJ1ZmZlciA9IChmdW5jdGlvbigpIHtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgdmFyIEJ1ZmZlciA9IHV0aWwuaW5xdWlyZShcImJ1ZmZlclwiKS5CdWZmZXI7XHJcbiAgICAgICAgLy8gcmVmdXNlIHRvIHVzZSBub24tbm9kZSBidWZmZXJzIGlmIG5vdCBleHBsaWNpdGx5IGFzc2lnbmVkIChwZXJmIHJlYXNvbnMpOlxyXG4gICAgICAgIHJldHVybiBCdWZmZXIucHJvdG90eXBlLnV0ZjhXcml0ZSA/IEJ1ZmZlciA6IC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovIG51bGw7XHJcbiAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxufSkoKTtcclxuXHJcbi8qKlxyXG4gKiBJbnRlcm5hbCBhbGlhcyBvZiBvciBwb2x5ZnVsbCBmb3IgQnVmZmVyLmZyb20uXHJcbiAqIEB0eXBlIHs/ZnVuY3Rpb259XHJcbiAqIEBwYXJhbSB7c3RyaW5nfG51bWJlcltdfSB2YWx1ZSBWYWx1ZVxyXG4gKiBAcGFyYW0ge3N0cmluZ30gW2VuY29kaW5nXSBFbmNvZGluZyBpZiB2YWx1ZSBpcyBhIHN0cmluZ1xyXG4gKiBAcmV0dXJucyB7VWludDhBcnJheX1cclxuICogQHByaXZhdGVcclxuICovXHJcbnV0aWwuX0J1ZmZlcl9mcm9tID0gbnVsbDtcclxuXHJcbi8qKlxyXG4gKiBJbnRlcm5hbCBhbGlhcyBvZiBvciBwb2x5ZmlsbCBmb3IgQnVmZmVyLmFsbG9jVW5zYWZlLlxyXG4gKiBAdHlwZSB7P2Z1bmN0aW9ufVxyXG4gKiBAcGFyYW0ge251bWJlcn0gc2l6ZSBCdWZmZXIgc2l6ZVxyXG4gKiBAcmV0dXJucyB7VWludDhBcnJheX1cclxuICogQHByaXZhdGVcclxuICovXHJcbnV0aWwuX0J1ZmZlcl9hbGxvY1Vuc2FmZSA9IG51bGw7XHJcblxyXG4vKipcclxuICogQ3JlYXRlcyBhIG5ldyBidWZmZXIgb2Ygd2hhdGV2ZXIgdHlwZSBzdXBwb3J0ZWQgYnkgdGhlIGVudmlyb25tZW50LlxyXG4gKiBAcGFyYW0ge251bWJlcnxudW1iZXJbXX0gW3NpemVPckFycmF5PTBdIEJ1ZmZlciBzaXplIG9yIG51bWJlciBhcnJheVxyXG4gKiBAcmV0dXJucyB7VWludDhBcnJheXxCdWZmZXJ9IEJ1ZmZlclxyXG4gKi9cclxudXRpbC5uZXdCdWZmZXIgPSBmdW5jdGlvbiBuZXdCdWZmZXIoc2l6ZU9yQXJyYXkpIHtcclxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICByZXR1cm4gdHlwZW9mIHNpemVPckFycmF5ID09PSBcIm51bWJlclwiXHJcbiAgICAgICAgPyB1dGlsLkJ1ZmZlclxyXG4gICAgICAgICAgICA/IHV0aWwuX0J1ZmZlcl9hbGxvY1Vuc2FmZShzaXplT3JBcnJheSlcclxuICAgICAgICAgICAgOiBuZXcgdXRpbC5BcnJheShzaXplT3JBcnJheSlcclxuICAgICAgICA6IHV0aWwuQnVmZmVyXHJcbiAgICAgICAgICAgID8gdXRpbC5fQnVmZmVyX2Zyb20oc2l6ZU9yQXJyYXkpXHJcbiAgICAgICAgICAgIDogdHlwZW9mIFVpbnQ4QXJyYXkgPT09IFwidW5kZWZpbmVkXCJcclxuICAgICAgICAgICAgICAgID8gc2l6ZU9yQXJyYXlcclxuICAgICAgICAgICAgICAgIDogbmV3IFVpbnQ4QXJyYXkoc2l6ZU9yQXJyYXkpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEFycmF5IGltcGxlbWVudGF0aW9uIHVzZWQgaW4gdGhlIGJyb3dzZXIuIGBVaW50OEFycmF5YCBpZiBzdXBwb3J0ZWQsIG90aGVyd2lzZSBgQXJyYXlgLlxyXG4gKiBAdHlwZSB7P2Z1bmN0aW9uKG5ldzogVWludDhBcnJheSwgKil9XHJcbiAqL1xyXG51dGlsLkFycmF5ID0gdHlwZW9mIFVpbnQ4QXJyYXkgIT09IFwidW5kZWZpbmVkXCIgPyBVaW50OEFycmF5IC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovIDogQXJyYXk7XHJcblxyXG4vKipcclxuICogTG9uZy5qcydzIExvbmcgY2xhc3MgaWYgYXZhaWxhYmxlLlxyXG4gKiBAdHlwZSB7P2Z1bmN0aW9uKG5ldzogTG9uZyl9XHJcbiAqL1xyXG51dGlsLkxvbmcgPSAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqLyBnbG9iYWwuZGNvZGVJTyAmJiAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqLyBnbG9iYWwuZGNvZGVJTy5Mb25nIHx8IHV0aWwuaW5xdWlyZShcImxvbmdcIik7XHJcblxyXG4vKipcclxuICogQ29udmVydHMgYSBudW1iZXIgb3IgbG9uZyB0byBhbiA4IGNoYXJhY3RlcnMgbG9uZyBoYXNoIHN0cmluZy5cclxuICogQHBhcmFtIHtMb25nfG51bWJlcn0gdmFsdWUgVmFsdWUgdG8gY29udmVydFxyXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBIYXNoXHJcbiAqL1xyXG51dGlsLmxvbmdUb0hhc2ggPSBmdW5jdGlvbiBsb25nVG9IYXNoKHZhbHVlKSB7XHJcbiAgICByZXR1cm4gdmFsdWVcclxuICAgICAgICA/IHV0aWwuTG9uZ0JpdHMuZnJvbSh2YWx1ZSkudG9IYXNoKClcclxuICAgICAgICA6IHV0aWwuTG9uZ0JpdHMuemVyb0hhc2g7XHJcbn07XHJcblxyXG4vKipcclxuICogQ29udmVydHMgYW4gOCBjaGFyYWN0ZXJzIGxvbmcgaGFzaCBzdHJpbmcgdG8gYSBsb25nIG9yIG51bWJlci5cclxuICogQHBhcmFtIHtzdHJpbmd9IGhhc2ggSGFzaFxyXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFt1bnNpZ25lZD1mYWxzZV0gV2hldGhlciB1bnNpZ25lZCBvciBub3RcclxuICogQHJldHVybnMge0xvbmd8bnVtYmVyfSBPcmlnaW5hbCB2YWx1ZVxyXG4gKi9cclxudXRpbC5sb25nRnJvbUhhc2ggPSBmdW5jdGlvbiBsb25nRnJvbUhhc2goaGFzaCwgdW5zaWduZWQpIHtcclxuICAgIHZhciBiaXRzID0gdXRpbC5Mb25nQml0cy5mcm9tSGFzaChoYXNoKTtcclxuICAgIGlmICh1dGlsLkxvbmcpXHJcbiAgICAgICAgcmV0dXJuIHV0aWwuTG9uZy5mcm9tQml0cyhiaXRzLmxvLCBiaXRzLmhpLCB1bnNpZ25lZCk7XHJcbiAgICByZXR1cm4gYml0cy50b051bWJlcihCb29sZWFuKHVuc2lnbmVkKSk7XHJcbn07XHJcblxyXG4vKipcclxuICogTWVyZ2VzIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBzb3VyY2Ugb2JqZWN0IGludG8gdGhlIGRlc3RpbmF0aW9uIG9iamVjdC5cclxuICogQHBhcmFtIHtPYmplY3QuPHN0cmluZywqPn0gZHN0IERlc3RpbmF0aW9uIG9iamVjdFxyXG4gKiBAcGFyYW0ge09iamVjdC48c3RyaW5nLCo+fSBzcmMgU291cmNlIG9iamVjdFxyXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtpZk5vdFNldD1mYWxzZV0gTWVyZ2VzIG9ubHkgaWYgdGhlIGtleSBpcyBub3QgYWxyZWFkeSBzZXRcclxuICogQHJldHVybnMge09iamVjdC48c3RyaW5nLCo+fSBEZXN0aW5hdGlvbiBvYmplY3RcclxuICovXHJcbnV0aWwubWVyZ2UgPSBmdW5jdGlvbiBtZXJnZShkc3QsIHNyYywgaWZOb3RTZXQpIHsgLy8gdXNlZCBieSBjb252ZXJ0ZXJzXHJcbiAgICBmb3IgKHZhciBrZXlzID0gT2JqZWN0LmtleXMoc3JjKSwgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgKytpKVxyXG4gICAgICAgIGlmIChkc3Rba2V5c1tpXV0gPT09IHVuZGVmaW5lZCB8fCAhaWZOb3RTZXQpXHJcbiAgICAgICAgICAgIGRzdFtrZXlzW2ldXSA9IHNyY1trZXlzW2ldXTtcclxuICAgIHJldHVybiBkc3Q7XHJcbn07XHJcblxyXG4vKipcclxuICogQ29udmVydHMgdGhlIGZpcnN0IGNoYXJhY3RlciBvZiBhIHN0cmluZyB0byBsb3dlciBjYXNlLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyIFN0cmluZyB0byBjb252ZXJ0XHJcbiAqIEByZXR1cm5zIHtzdHJpbmd9IENvbnZlcnRlZCBzdHJpbmdcclxuICovXHJcbnV0aWwubGNGaXJzdCA9IGZ1bmN0aW9uIGxjRmlyc3Qoc3RyKSB7XHJcbiAgICByZXR1cm4gc3RyLmNoYXJBdCgwKS50b0xvd2VyQ2FzZSgpICsgc3RyLnN1YnN0cmluZygxKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBCdWlsZHMgYSBnZXR0ZXIgZm9yIGEgb25lb2YncyBwcmVzZW50IGZpZWxkIG5hbWUuXHJcbiAqIEBwYXJhbSB7c3RyaW5nW119IGZpZWxkTmFtZXMgRmllbGQgbmFtZXNcclxuICogQHJldHVybnMge2Z1bmN0aW9uKCk6c3RyaW5nfHVuZGVmaW5lZH0gVW5ib3VuZCBnZXR0ZXJcclxuICovXHJcbnV0aWwub25lT2ZHZXR0ZXIgPSBmdW5jdGlvbiBnZXRPbmVPZihmaWVsZE5hbWVzKSB7XHJcbiAgICB2YXIgZmllbGRNYXAgPSB7fTtcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZmllbGROYW1lcy5sZW5ndGg7ICsraSlcclxuICAgICAgICBmaWVsZE1hcFtmaWVsZE5hbWVzW2ldXSA9IDE7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfHVuZGVmaW5lZH0gU2V0IGZpZWxkIG5hbWUsIGlmIGFueVxyXG4gICAgICogQHRoaXMgT2JqZWN0XHJcbiAgICAgKiBAaWdub3JlXHJcbiAgICAgKi9cclxuICAgIHJldHVybiBmdW5jdGlvbigpIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBjb25zaXN0ZW50LXJldHVyblxyXG4gICAgICAgIGZvciAodmFyIGtleXMgPSBPYmplY3Qua2V5cyh0aGlzKSwgaSA9IGtleXMubGVuZ3RoIC0gMTsgaSA+IC0xOyAtLWkpXHJcbiAgICAgICAgICAgIGlmIChmaWVsZE1hcFtrZXlzW2ldXSA9PT0gMSAmJiB0aGlzW2tleXNbaV1dICE9PSB1bmRlZmluZWQgJiYgdGhpc1trZXlzW2ldXSAhPT0gbnVsbClcclxuICAgICAgICAgICAgICAgIHJldHVybiBrZXlzW2ldO1xyXG4gICAgfTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBCdWlsZHMgYSBzZXR0ZXIgZm9yIGEgb25lb2YncyBwcmVzZW50IGZpZWxkIG5hbWUuXHJcbiAqIEBwYXJhbSB7c3RyaW5nW119IGZpZWxkTmFtZXMgRmllbGQgbmFtZXNcclxuICogQHJldHVybnMge2Z1bmN0aW9uKD9zdHJpbmcpOnVuZGVmaW5lZH0gVW5ib3VuZCBzZXR0ZXJcclxuICovXHJcbnV0aWwub25lT2ZTZXR0ZXIgPSBmdW5jdGlvbiBzZXRPbmVPZihmaWVsZE5hbWVzKSB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBGaWVsZCBuYW1lXHJcbiAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxyXG4gICAgICogQHRoaXMgT2JqZWN0XHJcbiAgICAgKiBAaWdub3JlXHJcbiAgICAgKi9cclxuICAgIHJldHVybiBmdW5jdGlvbihuYW1lKSB7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBmaWVsZE5hbWVzLmxlbmd0aDsgKytpKVxyXG4gICAgICAgICAgICBpZiAoZmllbGROYW1lc1tpXSAhPT0gbmFtZSlcclxuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzW2ZpZWxkTmFtZXNbaV1dO1xyXG4gICAgfTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBMYXppbHkgcmVzb2x2ZXMgZnVsbHkgcXVhbGlmaWVkIHR5cGUgbmFtZXMgYWdhaW5zdCB0aGUgc3BlY2lmaWVkIHJvb3QuXHJcbiAqIEBwYXJhbSB7Um9vdH0gcm9vdCBSb290IGluc3RhbmNlb2ZcclxuICogQHBhcmFtIHtPYmplY3QuPG51bWJlcixzdHJpbmd8UmVmbGVjdGlvbk9iamVjdD59IGxhenlUeXBlcyBUeXBlIG5hbWVzXHJcbiAqIEByZXR1cm5zIHt1bmRlZmluZWR9XHJcbiAqL1xyXG51dGlsLmxhenlSZXNvbHZlID0gZnVuY3Rpb24gbGF6eVJlc29sdmUocm9vdCwgbGF6eVR5cGVzKSB7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxhenlUeXBlcy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgIGZvciAodmFyIGtleXMgPSBPYmplY3Qua2V5cyhsYXp5VHlwZXNbaV0pLCBqID0gMDsgaiA8IGtleXMubGVuZ3RoOyArK2opIHtcclxuICAgICAgICAgICAgdmFyIHBhdGggPSBsYXp5VHlwZXNbaV1ba2V5c1tqXV0uc3BsaXQoXCIuXCIpLFxyXG4gICAgICAgICAgICAgICAgcHRyICA9IHJvb3Q7XHJcbiAgICAgICAgICAgIHdoaWxlIChwYXRoLmxlbmd0aClcclxuICAgICAgICAgICAgICAgIHB0ciA9IHB0cltwYXRoLnNoaWZ0KCldO1xyXG4gICAgICAgICAgICBsYXp5VHlwZXNbaV1ba2V5c1tqXV0gPSBwdHI7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIERlZmF1bHQgY29udmVyc2lvbiBvcHRpb25zIHVzZWQgZm9yIHRvSlNPTiBpbXBsZW1lbnRhdGlvbnMuIENvbnZlcnRzIGxvbmdzLCBlbnVtcyBhbmQgYnl0ZXMgdG8gc3RyaW5ncy5cclxuICogQHR5cGUge0NvbnZlcnNpb25PcHRpb25zfVxyXG4gKi9cclxudXRpbC50b0pTT05PcHRpb25zID0ge1xyXG4gICAgbG9uZ3M6IFN0cmluZyxcclxuICAgIGVudW1zOiBTdHJpbmcsXHJcbiAgICBieXRlczogU3RyaW5nXHJcbn07XHJcblxyXG51dGlsLl9jb25maWd1cmUgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBCdWZmZXIgPSB1dGlsLkJ1ZmZlcjtcclxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xyXG4gICAgaWYgKCFCdWZmZXIpIHtcclxuICAgICAgICB1dGlsLl9CdWZmZXJfZnJvbSA9IHV0aWwuX0J1ZmZlcl9hbGxvY1Vuc2FmZSA9IG51bGw7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgLy8gYmVjYXVzZSBub2RlIDQueCBidWZmZXJzIGFyZSBpbmNvbXBhdGlibGUgJiBpbW11dGFibGVcclxuICAgIC8vIHNlZTogaHR0cHM6Ly9naXRodWIuY29tL2Rjb2RlSU8vcHJvdG9idWYuanMvcHVsbC82NjVcclxuICAgIHV0aWwuX0J1ZmZlcl9mcm9tID0gQnVmZmVyLmZyb20gIT09IFVpbnQ4QXJyYXkuZnJvbSAmJiBCdWZmZXIuZnJvbSB8fFxyXG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICAgICAgZnVuY3Rpb24gQnVmZmVyX2Zyb20odmFsdWUsIGVuY29kaW5nKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBuZXcgQnVmZmVyKHZhbHVlLCBlbmNvZGluZyk7XHJcbiAgICAgICAgfTtcclxuICAgIHV0aWwuX0J1ZmZlcl9hbGxvY1Vuc2FmZSA9IEJ1ZmZlci5hbGxvY1Vuc2FmZSB8fFxyXG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICAgICAgZnVuY3Rpb24gQnVmZmVyX2FsbG9jVW5zYWZlKHNpemUpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBCdWZmZXIoc2l6ZSk7XHJcbiAgICAgICAgfTtcclxufTtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbm1vZHVsZS5leHBvcnRzID0gdmVyaWZpZXI7XHJcblxyXG52YXIgRW51bSAgICAgID0gcmVxdWlyZShcIi4vZW51bVwiKSxcclxuICAgIHV0aWwgICAgICA9IHJlcXVpcmUoXCIuL3V0aWxcIik7XHJcblxyXG5mdW5jdGlvbiBpbnZhbGlkKGZpZWxkLCBleHBlY3RlZCkge1xyXG4gICAgcmV0dXJuIGZpZWxkLm5hbWUgKyBcIjogXCIgKyBleHBlY3RlZCArIChmaWVsZC5yZXBlYXRlZCAmJiBleHBlY3RlZCAhPT0gXCJhcnJheVwiID8gXCJbXVwiIDogZmllbGQubWFwICYmIGV4cGVjdGVkICE9PSBcIm9iamVjdFwiID8gXCJ7azpcIitmaWVsZC5rZXlUeXBlK1wifVwiIDogXCJcIikgKyBcIiBleHBlY3RlZFwiO1xyXG59XHJcblxyXG4vKipcclxuICogR2VuZXJhdGVzIGEgcGFydGlhbCB2YWx1ZSB2ZXJpZmllci5cclxuICogQHBhcmFtIHtDb2RlZ2VufSBnZW4gQ29kZWdlbiBpbnN0YW5jZVxyXG4gKiBAcGFyYW0ge0ZpZWxkfSBmaWVsZCBSZWZsZWN0ZWQgZmllbGRcclxuICogQHBhcmFtIHtudW1iZXJ9IGZpZWxkSW5kZXggRmllbGQgaW5kZXhcclxuICogQHBhcmFtIHtzdHJpbmd9IHJlZiBWYXJpYWJsZSByZWZlcmVuY2VcclxuICogQHJldHVybnMge0NvZGVnZW59IENvZGVnZW4gaW5zdGFuY2VcclxuICogQGlnbm9yZVxyXG4gKi9cclxuZnVuY3Rpb24gZ2VuVmVyaWZ5VmFsdWUoZ2VuLCBmaWVsZCwgZmllbGRJbmRleCwgcmVmKSB7XHJcbiAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby11bmV4cGVjdGVkLW11bHRpbGluZSAqL1xyXG4gICAgaWYgKGZpZWxkLnJlc29sdmVkVHlwZSkge1xyXG4gICAgICAgIGlmIChmaWVsZC5yZXNvbHZlZFR5cGUgaW5zdGFuY2VvZiBFbnVtKSB7IGdlblxyXG4gICAgICAgICAgICAoXCJzd2l0Y2goJXMpe1wiLCByZWYpXHJcbiAgICAgICAgICAgICAgICAoXCJkZWZhdWx0OlwiKVxyXG4gICAgICAgICAgICAgICAgICAgIChcInJldHVybiVqXCIsIGludmFsaWQoZmllbGQsIFwiZW51bSB2YWx1ZVwiKSk7XHJcbiAgICAgICAgICAgIGZvciAodmFyIGtleXMgPSBPYmplY3Qua2V5cyhmaWVsZC5yZXNvbHZlZFR5cGUudmFsdWVzKSwgaiA9IDA7IGogPCBrZXlzLmxlbmd0aDsgKytqKSBnZW5cclxuICAgICAgICAgICAgICAgIChcImNhc2UgJWQ6XCIsIGZpZWxkLnJlc29sdmVkVHlwZS52YWx1ZXNba2V5c1tqXV0pO1xyXG4gICAgICAgICAgICBnZW5cclxuICAgICAgICAgICAgICAgICAgICAoXCJicmVha1wiKVxyXG4gICAgICAgICAgICAoXCJ9XCIpO1xyXG4gICAgICAgIH0gZWxzZSBnZW5cclxuICAgICAgICAgICAgKFwidmFyIGU9dHlwZXNbJWRdLnZlcmlmeSglcyk7XCIsIGZpZWxkSW5kZXgsIHJlZilcclxuICAgICAgICAgICAgKFwiaWYoZSlcIilcclxuICAgICAgICAgICAgICAgIChcInJldHVybiVqK2VcIiwgZmllbGQubmFtZSArIFwiLlwiKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgc3dpdGNoIChmaWVsZC50eXBlKSB7XHJcbiAgICAgICAgICAgIGNhc2UgXCJpbnQzMlwiOlxyXG4gICAgICAgICAgICBjYXNlIFwidWludDMyXCI6XHJcbiAgICAgICAgICAgIGNhc2UgXCJzaW50MzJcIjpcclxuICAgICAgICAgICAgY2FzZSBcImZpeGVkMzJcIjpcclxuICAgICAgICAgICAgY2FzZSBcInNmaXhlZDMyXCI6IGdlblxyXG4gICAgICAgICAgICAgICAgKFwiaWYoIXV0aWwuaXNJbnRlZ2VyKCVzKSlcIiwgcmVmKVxyXG4gICAgICAgICAgICAgICAgICAgIChcInJldHVybiVqXCIsIGludmFsaWQoZmllbGQsIFwiaW50ZWdlclwiKSk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBcImludDY0XCI6XHJcbiAgICAgICAgICAgIGNhc2UgXCJ1aW50NjRcIjpcclxuICAgICAgICAgICAgY2FzZSBcInNpbnQ2NFwiOlxyXG4gICAgICAgICAgICBjYXNlIFwiZml4ZWQ2NFwiOlxyXG4gICAgICAgICAgICBjYXNlIFwic2ZpeGVkNjRcIjogZ2VuXHJcbiAgICAgICAgICAgICAgICAoXCJpZighdXRpbC5pc0ludGVnZXIoJXMpJiYhKCVzJiZ1dGlsLmlzSW50ZWdlciglcy5sb3cpJiZ1dGlsLmlzSW50ZWdlciglcy5oaWdoKSkpXCIsIHJlZiwgcmVmLCByZWYsIHJlZilcclxuICAgICAgICAgICAgICAgICAgICAoXCJyZXR1cm4lalwiLCBpbnZhbGlkKGZpZWxkLCBcImludGVnZXJ8TG9uZ1wiKSk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBcImZsb2F0XCI6XHJcbiAgICAgICAgICAgIGNhc2UgXCJkb3VibGVcIjogZ2VuXHJcbiAgICAgICAgICAgICAgICAoXCJpZih0eXBlb2YgJXMhPT1cXFwibnVtYmVyXFxcIilcIiwgcmVmKVxyXG4gICAgICAgICAgICAgICAgICAgIChcInJldHVybiVqXCIsIGludmFsaWQoZmllbGQsIFwibnVtYmVyXCIpKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIFwiYm9vbFwiOiBnZW5cclxuICAgICAgICAgICAgICAgIChcImlmKHR5cGVvZiAlcyE9PVxcXCJib29sZWFuXFxcIilcIiwgcmVmKVxyXG4gICAgICAgICAgICAgICAgICAgIChcInJldHVybiVqXCIsIGludmFsaWQoZmllbGQsIFwiYm9vbGVhblwiKSk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBcInN0cmluZ1wiOiBnZW5cclxuICAgICAgICAgICAgICAgIChcImlmKCF1dGlsLmlzU3RyaW5nKCVzKSlcIiwgcmVmKVxyXG4gICAgICAgICAgICAgICAgICAgIChcInJldHVybiVqXCIsIGludmFsaWQoZmllbGQsIFwic3RyaW5nXCIpKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIFwiYnl0ZXNcIjogZ2VuXHJcbiAgICAgICAgICAgICAgICAoXCJpZighKCVzJiZ0eXBlb2YgJXMubGVuZ3RoPT09XFxcIm51bWJlclxcXCJ8fHV0aWwuaXNTdHJpbmcoJXMpKSlcIiwgcmVmLCByZWYsIHJlZilcclxuICAgICAgICAgICAgICAgICAgICAoXCJyZXR1cm4lalwiLCBpbnZhbGlkKGZpZWxkLCBcImJ1ZmZlclwiKSk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZ2VuO1xyXG4gICAgLyogZXNsaW50LWVuYWJsZSBuby11bmV4cGVjdGVkLW11bHRpbGluZSAqL1xyXG59XHJcblxyXG4vKipcclxuICogR2VuZXJhdGVzIGEgcGFydGlhbCBrZXkgdmVyaWZpZXIuXHJcbiAqIEBwYXJhbSB7Q29kZWdlbn0gZ2VuIENvZGVnZW4gaW5zdGFuY2VcclxuICogQHBhcmFtIHtGaWVsZH0gZmllbGQgUmVmbGVjdGVkIGZpZWxkXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSByZWYgVmFyaWFibGUgcmVmZXJlbmNlXHJcbiAqIEByZXR1cm5zIHtDb2RlZ2VufSBDb2RlZ2VuIGluc3RhbmNlXHJcbiAqIEBpZ25vcmVcclxuICovXHJcbmZ1bmN0aW9uIGdlblZlcmlmeUtleShnZW4sIGZpZWxkLCByZWYpIHtcclxuICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLXVuZXhwZWN0ZWQtbXVsdGlsaW5lICovXHJcbiAgICBzd2l0Y2ggKGZpZWxkLmtleVR5cGUpIHtcclxuICAgICAgICBjYXNlIFwiaW50MzJcIjpcclxuICAgICAgICBjYXNlIFwidWludDMyXCI6XHJcbiAgICAgICAgY2FzZSBcInNpbnQzMlwiOlxyXG4gICAgICAgIGNhc2UgXCJmaXhlZDMyXCI6XHJcbiAgICAgICAgY2FzZSBcInNmaXhlZDMyXCI6IGdlblxyXG4gICAgICAgICAgICAoXCJpZighL14tPyg/OjB8WzEtOV1bMC05XSopJC8udGVzdCglcykpXCIsIHJlZikgLy8gaXQncyBpbXBvcnRhbnQgbm90IHRvIHVzZSBhbnkgbGl0ZXJhbHMgaGVyZSB0aGF0IG1pZ2h0IGJlIGNvbmZ1c2VkIHdpdGggc2hvcnQgdmFyaWFibGUgbmFtZXMgYnkgcGJqcycgYmVhdXRpZnlcclxuICAgICAgICAgICAgICAgIChcInJldHVybiVqXCIsIGludmFsaWQoZmllbGQsIFwiaW50ZWdlciBrZXlcIikpO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIFwiaW50NjRcIjpcclxuICAgICAgICBjYXNlIFwidWludDY0XCI6XHJcbiAgICAgICAgY2FzZSBcInNpbnQ2NFwiOlxyXG4gICAgICAgIGNhc2UgXCJmaXhlZDY0XCI6XHJcbiAgICAgICAgY2FzZSBcInNmaXhlZDY0XCI6IGdlblxyXG4gICAgICAgICAgICAoXCJpZighL14oPzpbXFxcXHgwMC1cXFxceGZmXXs4fXwtPyg/OjB8WzEtOV1bMC05XSopKSQvLnRlc3QoJXMpKVwiLCByZWYpIC8vIHNlZSBjb21tZW50IGFib3ZlOiB4IGlzIG9rLCBkIGlzIG5vdFxyXG4gICAgICAgICAgICAgICAgKFwicmV0dXJuJWpcIiwgaW52YWxpZChmaWVsZCwgXCJpbnRlZ2VyfExvbmcga2V5XCIpKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBcImJvb2xcIjogZ2VuXHJcbiAgICAgICAgICAgIChcImlmKCEvXnRydWV8ZmFsc2V8MHwxJC8udGVzdCglcykpXCIsIHJlZilcclxuICAgICAgICAgICAgICAgIChcInJldHVybiVqXCIsIGludmFsaWQoZmllbGQsIFwiYm9vbGVhbiBrZXlcIikpO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgIH1cclxuICAgIHJldHVybiBnZW47XHJcbiAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLXVuZXhwZWN0ZWQtbXVsdGlsaW5lICovXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBHZW5lcmF0ZXMgYSB2ZXJpZmllciBzcGVjaWZpYyB0byB0aGUgc3BlY2lmaWVkIG1lc3NhZ2UgdHlwZS5cclxuICogQHBhcmFtIHtUeXBlfSBtdHlwZSBNZXNzYWdlIHR5cGVcclxuICogQHJldHVybnMge0NvZGVnZW59IENvZGVnZW4gaW5zdGFuY2VcclxuICovXHJcbmZ1bmN0aW9uIHZlcmlmaWVyKG10eXBlKSB7XHJcbiAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby11bmV4cGVjdGVkLW11bHRpbGluZSAqL1xyXG5cclxuICAgIHZhciBnZW4gPSB1dGlsLmNvZGVnZW4oXCJtXCIpXHJcbiAgICAoXCJpZih0eXBlb2YgbSE9PVxcXCJvYmplY3RcXFwifHxtPT09bnVsbClcIilcclxuICAgICAgICAoXCJyZXR1cm4lalwiLCBcIm9iamVjdCBleHBlY3RlZFwiKTtcclxuXHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IC8qIGluaXRpYWxpemVzICovIG10eXBlLmZpZWxkc0FycmF5Lmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgdmFyIGZpZWxkID0gbXR5cGUuX2ZpZWxkc0FycmF5W2ldLnJlc29sdmUoKSxcclxuICAgICAgICAgICAgcmVmICAgPSBcIm1cIiArIHV0aWwuc2FmZVByb3AoZmllbGQubmFtZSk7XHJcblxyXG4gICAgICAgIC8vIG1hcCBmaWVsZHNcclxuICAgICAgICBpZiAoZmllbGQubWFwKSB7IGdlblxyXG4gICAgICAgICAgICAoXCJpZiglcyE9PXVuZGVmaW5lZCl7XCIsIHJlZilcclxuICAgICAgICAgICAgICAgIChcImlmKCF1dGlsLmlzT2JqZWN0KCVzKSlcIiwgcmVmKVxyXG4gICAgICAgICAgICAgICAgICAgIChcInJldHVybiVqXCIsIGludmFsaWQoZmllbGQsIFwib2JqZWN0XCIpKVxyXG4gICAgICAgICAgICAgICAgKFwidmFyIGs9T2JqZWN0LmtleXMoJXMpXCIsIHJlZilcclxuICAgICAgICAgICAgICAgIChcImZvcih2YXIgaT0wO2k8ay5sZW5ndGg7KytpKXtcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgZ2VuVmVyaWZ5S2V5KGdlbiwgZmllbGQsIFwia1tpXVwiKTtcclxuICAgICAgICAgICAgICAgICAgICBnZW5WZXJpZnlWYWx1ZShnZW4sIGZpZWxkLCBpLCByZWYgKyBcIltrW2ldXVwiKVxyXG4gICAgICAgICAgICAgICAgKFwifVwiKVxyXG4gICAgICAgICAgICAoXCJ9XCIpO1xyXG5cclxuICAgICAgICAvLyByZXBlYXRlZCBmaWVsZHNcclxuICAgICAgICB9IGVsc2UgaWYgKGZpZWxkLnJlcGVhdGVkKSB7IGdlblxyXG4gICAgICAgICAgICAoXCJpZiglcyE9PXVuZGVmaW5lZCl7XCIsIHJlZilcclxuICAgICAgICAgICAgICAgIChcImlmKCFBcnJheS5pc0FycmF5KCVzKSlcIiwgcmVmKVxyXG4gICAgICAgICAgICAgICAgICAgIChcInJldHVybiVqXCIsIGludmFsaWQoZmllbGQsIFwiYXJyYXlcIikpXHJcbiAgICAgICAgICAgICAgICAoXCJmb3IodmFyIGk9MDtpPCVzLmxlbmd0aDsrK2kpe1wiLCByZWYpO1xyXG4gICAgICAgICAgICAgICAgICAgIGdlblZlcmlmeVZhbHVlKGdlbiwgZmllbGQsIGksIHJlZiArIFwiW2ldXCIpXHJcbiAgICAgICAgICAgICAgICAoXCJ9XCIpXHJcbiAgICAgICAgICAgIChcIn1cIik7XHJcblxyXG4gICAgICAgIC8vIHJlcXVpcmVkIG9yIHByZXNlbnQgZmllbGRzXHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgaWYgKCFmaWVsZC5yZXF1aXJlZCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGZpZWxkLnJlc29sdmVkVHlwZSAmJiAhKGZpZWxkLnJlc29sdmVkVHlwZSBpbnN0YW5jZW9mIEVudW0pKSBnZW5cclxuICAgICAgICAgICAgKFwiaWYoJXMhPT11bmRlZmluZWQmJiVzIT09bnVsbCl7XCIsIHJlZiwgcmVmKTtcclxuICAgICAgICAgICAgICAgIGVsc2UgZ2VuXHJcbiAgICAgICAgICAgIChcImlmKCVzIT09dW5kZWZpbmVkKXtcIiwgcmVmKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZ2VuVmVyaWZ5VmFsdWUoZ2VuLCBmaWVsZCwgaSwgcmVmKTtcclxuICAgICAgICAgICAgaWYgKCFmaWVsZC5yZXF1aXJlZCkgZ2VuXHJcbiAgICAgICAgICAgIChcIn1cIik7XHJcbiAgICAgICAgfVxyXG4gICAgfSByZXR1cm4gZ2VuXHJcbiAgICAoXCJyZXR1cm4gbnVsbFwiKTtcclxuICAgIC8qIGVzbGludC1lbmFibGUgbm8tdW5leHBlY3RlZC1tdWx0aWxpbmUgKi9cclxufSIsIlwidXNlIHN0cmljdFwiO1xyXG5tb2R1bGUuZXhwb3J0cyA9IFdyaXRlcjtcclxuXHJcbnZhciB1dGlsICAgICAgPSByZXF1aXJlKFwiLi91dGlsL21pbmltYWxcIik7XHJcblxyXG52YXIgQnVmZmVyV3JpdGVyOyAvLyBjeWNsaWNcclxuXHJcbnZhciBMb25nQml0cyAgPSB1dGlsLkxvbmdCaXRzLFxyXG4gICAgYmFzZTY0ICAgID0gdXRpbC5iYXNlNjQsXHJcbiAgICB1dGY4ICAgICAgPSB1dGlsLnV0Zjg7XHJcblxyXG4vKipcclxuICogQ29uc3RydWN0cyBhIG5ldyB3cml0ZXIgb3BlcmF0aW9uIGluc3RhbmNlLlxyXG4gKiBAY2xhc3NkZXNjIFNjaGVkdWxlZCB3cml0ZXIgb3BlcmF0aW9uLlxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQHBhcmFtIHtmdW5jdGlvbigqLCBVaW50OEFycmF5LCBudW1iZXIpfSBmbiBGdW5jdGlvbiB0byBjYWxsXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBsZW4gVmFsdWUgYnl0ZSBsZW5ndGhcclxuICogQHBhcmFtIHsqfSB2YWwgVmFsdWUgdG8gd3JpdGVcclxuICogQGlnbm9yZVxyXG4gKi9cclxuZnVuY3Rpb24gT3AoZm4sIGxlbiwgdmFsKSB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGdW5jdGlvbiB0byBjYWxsLlxyXG4gICAgICogQHR5cGUge2Z1bmN0aW9uKFVpbnQ4QXJyYXksIG51bWJlciwgKil9XHJcbiAgICAgKi9cclxuICAgIHRoaXMuZm4gPSBmbjtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFZhbHVlIGJ5dGUgbGVuZ3RoLlxyXG4gICAgICogQHR5cGUge251bWJlcn1cclxuICAgICAqL1xyXG4gICAgdGhpcy5sZW4gPSBsZW47XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBOZXh0IG9wZXJhdGlvbi5cclxuICAgICAqIEB0eXBlIHtXcml0ZXIuT3B8dW5kZWZpbmVkfVxyXG4gICAgICovXHJcbiAgICB0aGlzLm5leHQgPSB1bmRlZmluZWQ7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBWYWx1ZSB0byB3cml0ZS5cclxuICAgICAqIEB0eXBlIHsqfVxyXG4gICAgICovXHJcbiAgICB0aGlzLnZhbCA9IHZhbDsgLy8gdHlwZSB2YXJpZXNcclxufVxyXG5cclxuLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuZnVuY3Rpb24gbm9vcCgpIHt9IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tZW1wdHktZnVuY3Rpb25cclxuXHJcbi8qKlxyXG4gKiBDb25zdHJ1Y3RzIGEgbmV3IHdyaXRlciBzdGF0ZSBpbnN0YW5jZS5cclxuICogQGNsYXNzZGVzYyBDb3BpZWQgd3JpdGVyIHN0YXRlLlxyXG4gKiBAbWVtYmVyb2YgV3JpdGVyXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKiBAcGFyYW0ge1dyaXRlcn0gd3JpdGVyIFdyaXRlciB0byBjb3B5IHN0YXRlIGZyb21cclxuICogQHByaXZhdGVcclxuICogQGlnbm9yZVxyXG4gKi9cclxuZnVuY3Rpb24gU3RhdGUod3JpdGVyKSB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDdXJyZW50IGhlYWQuXHJcbiAgICAgKiBAdHlwZSB7V3JpdGVyLk9wfVxyXG4gICAgICovXHJcbiAgICB0aGlzLmhlYWQgPSB3cml0ZXIuaGVhZDtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEN1cnJlbnQgdGFpbC5cclxuICAgICAqIEB0eXBlIHtXcml0ZXIuT3B9XHJcbiAgICAgKi9cclxuICAgIHRoaXMudGFpbCA9IHdyaXRlci50YWlsO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3VycmVudCBidWZmZXIgbGVuZ3RoLlxyXG4gICAgICogQHR5cGUge251bWJlcn1cclxuICAgICAqL1xyXG4gICAgdGhpcy5sZW4gPSB3cml0ZXIubGVuO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogTmV4dCBzdGF0ZS5cclxuICAgICAqIEB0eXBlIHs/U3RhdGV9XHJcbiAgICAgKi9cclxuICAgIHRoaXMubmV4dCA9IHdyaXRlci5zdGF0ZXM7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb25zdHJ1Y3RzIGEgbmV3IHdyaXRlciBpbnN0YW5jZS5cclxuICogQGNsYXNzZGVzYyBXaXJlIGZvcm1hdCB3cml0ZXIgdXNpbmcgYFVpbnQ4QXJyYXlgIGlmIGF2YWlsYWJsZSwgb3RoZXJ3aXNlIGBBcnJheWAuXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKi9cclxuZnVuY3Rpb24gV3JpdGVyKCkge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3VycmVudCBsZW5ndGguXHJcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxyXG4gICAgICovXHJcbiAgICB0aGlzLmxlbiA9IDA7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBPcGVyYXRpb25zIGhlYWQuXHJcbiAgICAgKiBAdHlwZSB7T2JqZWN0fVxyXG4gICAgICovXHJcbiAgICB0aGlzLmhlYWQgPSBuZXcgT3Aobm9vcCwgMCwgMCk7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBPcGVyYXRpb25zIHRhaWxcclxuICAgICAqIEB0eXBlIHtPYmplY3R9XHJcbiAgICAgKi9cclxuICAgIHRoaXMudGFpbCA9IHRoaXMuaGVhZDtcclxuXHJcbiAgICAvKipcclxuICAgICAqIExpbmtlZCBmb3JrZWQgc3RhdGVzLlxyXG4gICAgICogQHR5cGUgez9PYmplY3R9XHJcbiAgICAgKi9cclxuICAgIHRoaXMuc3RhdGVzID0gbnVsbDtcclxuXHJcbiAgICAvLyBXaGVuIGEgdmFsdWUgaXMgd3JpdHRlbiwgdGhlIHdyaXRlciBjYWxjdWxhdGVzIGl0cyBieXRlIGxlbmd0aCBhbmQgcHV0cyBpdCBpbnRvIGEgbGlua2VkXHJcbiAgICAvLyBsaXN0IG9mIG9wZXJhdGlvbnMgdG8gcGVyZm9ybSB3aGVuIGZpbmlzaCgpIGlzIGNhbGxlZC4gVGhpcyBib3RoIGFsbG93cyB1cyB0byBhbGxvY2F0ZVxyXG4gICAgLy8gYnVmZmVycyBvZiB0aGUgZXhhY3QgcmVxdWlyZWQgc2l6ZSBhbmQgcmVkdWNlcyB0aGUgYW1vdW50IG9mIHdvcmsgd2UgaGF2ZSB0byBkbyBjb21wYXJlZFxyXG4gICAgLy8gdG8gZmlyc3QgY2FsY3VsYXRpbmcgb3ZlciBvYmplY3RzIGFuZCB0aGVuIGVuY29kaW5nIG92ZXIgb2JqZWN0cy4gSW4gb3VyIGNhc2UsIHRoZSBlbmNvZGluZ1xyXG4gICAgLy8gcGFydCBpcyBqdXN0IGEgbGlua2VkIGxpc3Qgd2FsayBjYWxsaW5nIG9wZXJhdGlvbnMgd2l0aCBhbHJlYWR5IHByZXBhcmVkIHZhbHVlcy5cclxufVxyXG5cclxuLyoqXHJcbiAqIENyZWF0ZXMgYSBuZXcgd3JpdGVyLlxyXG4gKiBAZnVuY3Rpb25cclxuICogQHJldHVybnMge0J1ZmZlcldyaXRlcnxXcml0ZXJ9IEEge0BsaW5rIEJ1ZmZlcldyaXRlcn0gd2hlbiBCdWZmZXJzIGFyZSBzdXBwb3J0ZWQsIG90aGVyd2lzZSBhIHtAbGluayBXcml0ZXJ9XHJcbiAqL1xyXG5Xcml0ZXIuY3JlYXRlID0gdXRpbC5CdWZmZXJcclxuICAgID8gZnVuY3Rpb24gY3JlYXRlX2J1ZmZlcl9zZXR1cCgpIHtcclxuICAgICAgICByZXR1cm4gKFdyaXRlci5jcmVhdGUgPSBmdW5jdGlvbiBjcmVhdGVfYnVmZmVyKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gbmV3IEJ1ZmZlcldyaXRlcigpO1xyXG4gICAgICAgIH0pKCk7XHJcbiAgICB9XHJcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgOiBmdW5jdGlvbiBjcmVhdGVfYXJyYXkoKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBXcml0ZXIoKTtcclxuICAgIH07XHJcblxyXG4vKipcclxuICogQWxsb2NhdGVzIGEgYnVmZmVyIG9mIHRoZSBzcGVjaWZpZWQgc2l6ZS5cclxuICogQHBhcmFtIHtudW1iZXJ9IHNpemUgQnVmZmVyIHNpemVcclxuICogQHJldHVybnMge1VpbnQ4QXJyYXl9IEJ1ZmZlclxyXG4gKi9cclxuV3JpdGVyLmFsbG9jID0gZnVuY3Rpb24gYWxsb2Moc2l6ZSkge1xyXG4gICAgcmV0dXJuIG5ldyB1dGlsLkFycmF5KHNpemUpO1xyXG59O1xyXG5cclxuLy8gVXNlIFVpbnQ4QXJyYXkgYnVmZmVyIHBvb2wgaW4gdGhlIGJyb3dzZXIsIGp1c3QgbGlrZSBub2RlIGRvZXMgd2l0aCBidWZmZXJzXHJcbi8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICovXHJcbmlmICh1dGlsLkFycmF5ICE9PSBBcnJheSlcclxuICAgIFdyaXRlci5hbGxvYyA9IHV0aWwucG9vbChXcml0ZXIuYWxsb2MsIHV0aWwuQXJyYXkucHJvdG90eXBlLnN1YmFycmF5KTtcclxuXHJcbi8qKlxyXG4gKiBQdXNoZXMgYSBuZXcgb3BlcmF0aW9uIHRvIHRoZSBxdWV1ZS5cclxuICogQHBhcmFtIHtmdW5jdGlvbihVaW50OEFycmF5LCBudW1iZXIsICopfSBmbiBGdW5jdGlvbiB0byBjYWxsXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBsZW4gVmFsdWUgYnl0ZSBsZW5ndGhcclxuICogQHBhcmFtIHtudW1iZXJ9IHZhbCBWYWx1ZSB0byB3cml0ZVxyXG4gKiBAcmV0dXJucyB7V3JpdGVyfSBgdGhpc2BcclxuICovXHJcbldyaXRlci5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uIHB1c2goZm4sIGxlbiwgdmFsKSB7XHJcbiAgICB0aGlzLnRhaWwgPSB0aGlzLnRhaWwubmV4dCA9IG5ldyBPcChmbiwgbGVuLCB2YWwpO1xyXG4gICAgdGhpcy5sZW4gKz0gbGVuO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG5mdW5jdGlvbiB3cml0ZUJ5dGUodmFsLCBidWYsIHBvcykge1xyXG4gICAgYnVmW3Bvc10gPSB2YWwgJiAyNTU7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlVmFyaW50MzIodmFsLCBidWYsIHBvcykge1xyXG4gICAgd2hpbGUgKHZhbCA+IDEyNykge1xyXG4gICAgICAgIGJ1Zltwb3MrK10gPSB2YWwgJiAxMjcgfCAxMjg7XHJcbiAgICAgICAgdmFsID4+Pj0gNztcclxuICAgIH1cclxuICAgIGJ1Zltwb3NdID0gdmFsO1xyXG59XHJcblxyXG4vKipcclxuICogQ29uc3RydWN0cyBhIG5ldyB2YXJpbnQgd3JpdGVyIG9wZXJhdGlvbiBpbnN0YW5jZS5cclxuICogQGNsYXNzZGVzYyBTY2hlZHVsZWQgdmFyaW50IHdyaXRlciBvcGVyYXRpb24uXHJcbiAqIEBleHRlbmRzIE9wXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKiBAcGFyYW0ge251bWJlcn0gbGVuIFZhbHVlIGJ5dGUgbGVuZ3RoXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSB2YWwgVmFsdWUgdG8gd3JpdGVcclxuICogQGlnbm9yZVxyXG4gKi9cclxuZnVuY3Rpb24gVmFyaW50T3AobGVuLCB2YWwpIHtcclxuICAgIHRoaXMubGVuID0gbGVuO1xyXG4gICAgdGhpcy5uZXh0ID0gdW5kZWZpbmVkO1xyXG4gICAgdGhpcy52YWwgPSB2YWw7XHJcbn1cclxuXHJcblZhcmludE9wLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoT3AucHJvdG90eXBlKTtcclxuVmFyaW50T3AucHJvdG90eXBlLmZuID0gd3JpdGVWYXJpbnQzMjtcclxuXHJcbi8qKlxyXG4gKiBXcml0ZXMgYW4gdW5zaWduZWQgMzIgYml0IHZhbHVlIGFzIGEgdmFyaW50LlxyXG4gKiBAcGFyYW0ge251bWJlcn0gdmFsdWUgVmFsdWUgdG8gd3JpdGVcclxuICogQHJldHVybnMge1dyaXRlcn0gYHRoaXNgXHJcbiAqL1xyXG5Xcml0ZXIucHJvdG90eXBlLnVpbnQzMiA9IGZ1bmN0aW9uIHdyaXRlX3VpbnQzMih2YWx1ZSkge1xyXG4gICAgLy8gaGVyZSwgdGhlIGNhbGwgdG8gdGhpcy5wdXNoIGhhcyBiZWVuIGlubGluZWQgYW5kIGEgdmFyaW50IHNwZWNpZmljIE9wIHN1YmNsYXNzIGlzIHVzZWQuXHJcbiAgICAvLyB1aW50MzIgaXMgYnkgZmFyIHRoZSBtb3N0IGZyZXF1ZW50bHkgdXNlZCBvcGVyYXRpb24gYW5kIGJlbmVmaXRzIHNpZ25pZmljYW50bHkgZnJvbSB0aGlzLlxyXG4gICAgdGhpcy5sZW4gKz0gKHRoaXMudGFpbCA9IHRoaXMudGFpbC5uZXh0ID0gbmV3IFZhcmludE9wKFxyXG4gICAgICAgICh2YWx1ZSA9IHZhbHVlID4+PiAwKVxyXG4gICAgICAgICAgICAgICAgPCAxMjggICAgICAgPyAxXHJcbiAgICAgICAgOiB2YWx1ZSA8IDE2Mzg0ICAgICA/IDJcclxuICAgICAgICA6IHZhbHVlIDwgMjA5NzE1MiAgID8gM1xyXG4gICAgICAgIDogdmFsdWUgPCAyNjg0MzU0NTYgPyA0XHJcbiAgICAgICAgOiAgICAgICAgICAgICAgICAgICAgIDUsXHJcbiAgICB2YWx1ZSkpLmxlbjtcclxuICAgIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFdyaXRlcyBhIHNpZ25lZCAzMiBiaXQgdmFsdWUgYXMgYSB2YXJpbnQuXHJcbiAqIEBmdW5jdGlvblxyXG4gKiBAcGFyYW0ge251bWJlcn0gdmFsdWUgVmFsdWUgdG8gd3JpdGVcclxuICogQHJldHVybnMge1dyaXRlcn0gYHRoaXNgXHJcbiAqL1xyXG5Xcml0ZXIucHJvdG90eXBlLmludDMyID0gZnVuY3Rpb24gd3JpdGVfaW50MzIodmFsdWUpIHtcclxuICAgIHJldHVybiB2YWx1ZSA8IDBcclxuICAgICAgICA/IHRoaXMucHVzaCh3cml0ZVZhcmludDY0LCAxMCwgTG9uZ0JpdHMuZnJvbU51bWJlcih2YWx1ZSkpIC8vIDEwIGJ5dGVzIHBlciBzcGVjXHJcbiAgICAgICAgOiB0aGlzLnVpbnQzMih2YWx1ZSk7XHJcbn07XHJcblxyXG4vKipcclxuICogV3JpdGVzIGEgMzIgYml0IHZhbHVlIGFzIGEgdmFyaW50LCB6aWctemFnIGVuY29kZWQuXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSB2YWx1ZSBWYWx1ZSB0byB3cml0ZVxyXG4gKiBAcmV0dXJucyB7V3JpdGVyfSBgdGhpc2BcclxuICovXHJcbldyaXRlci5wcm90b3R5cGUuc2ludDMyID0gZnVuY3Rpb24gd3JpdGVfc2ludDMyKHZhbHVlKSB7XHJcbiAgICByZXR1cm4gdGhpcy51aW50MzIoKHZhbHVlIDw8IDEgXiB2YWx1ZSA+PiAzMSkgPj4+IDApO1xyXG59O1xyXG5cclxuZnVuY3Rpb24gd3JpdGVWYXJpbnQ2NCh2YWwsIGJ1ZiwgcG9zKSB7XHJcbiAgICB3aGlsZSAodmFsLmhpKSB7XHJcbiAgICAgICAgYnVmW3BvcysrXSA9IHZhbC5sbyAmIDEyNyB8IDEyODtcclxuICAgICAgICB2YWwubG8gPSAodmFsLmxvID4+PiA3IHwgdmFsLmhpIDw8IDI1KSA+Pj4gMDtcclxuICAgICAgICB2YWwuaGkgPj4+PSA3O1xyXG4gICAgfVxyXG4gICAgd2hpbGUgKHZhbC5sbyA+IDEyNykge1xyXG4gICAgICAgIGJ1Zltwb3MrK10gPSB2YWwubG8gJiAxMjcgfCAxMjg7XHJcbiAgICAgICAgdmFsLmxvID0gdmFsLmxvID4+PiA3O1xyXG4gICAgfVxyXG4gICAgYnVmW3BvcysrXSA9IHZhbC5sbztcclxufVxyXG5cclxuLyoqXHJcbiAqIFdyaXRlcyBhbiB1bnNpZ25lZCA2NCBiaXQgdmFsdWUgYXMgYSB2YXJpbnQuXHJcbiAqIEBwYXJhbSB7TG9uZ3xudW1iZXJ8c3RyaW5nfSB2YWx1ZSBWYWx1ZSB0byB3cml0ZVxyXG4gKiBAcmV0dXJucyB7V3JpdGVyfSBgdGhpc2BcclxuICogQHRocm93cyB7VHlwZUVycm9yfSBJZiBgdmFsdWVgIGlzIGEgc3RyaW5nIGFuZCBubyBsb25nIGxpYnJhcnkgaXMgcHJlc2VudC5cclxuICovXHJcbldyaXRlci5wcm90b3R5cGUudWludDY0ID0gZnVuY3Rpb24gd3JpdGVfdWludDY0KHZhbHVlKSB7XHJcbiAgICB2YXIgYml0cyA9IExvbmdCaXRzLmZyb20odmFsdWUpO1xyXG4gICAgcmV0dXJuIHRoaXMucHVzaCh3cml0ZVZhcmludDY0LCBiaXRzLmxlbmd0aCgpLCBiaXRzKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBXcml0ZXMgYSBzaWduZWQgNjQgYml0IHZhbHVlIGFzIGEgdmFyaW50LlxyXG4gKiBAZnVuY3Rpb25cclxuICogQHBhcmFtIHtMb25nfG51bWJlcnxzdHJpbmd9IHZhbHVlIFZhbHVlIHRvIHdyaXRlXHJcbiAqIEByZXR1cm5zIHtXcml0ZXJ9IGB0aGlzYFxyXG4gKiBAdGhyb3dzIHtUeXBlRXJyb3J9IElmIGB2YWx1ZWAgaXMgYSBzdHJpbmcgYW5kIG5vIGxvbmcgbGlicmFyeSBpcyBwcmVzZW50LlxyXG4gKi9cclxuV3JpdGVyLnByb3RvdHlwZS5pbnQ2NCA9IFdyaXRlci5wcm90b3R5cGUudWludDY0O1xyXG5cclxuLyoqXHJcbiAqIFdyaXRlcyBhIHNpZ25lZCA2NCBiaXQgdmFsdWUgYXMgYSB2YXJpbnQsIHppZy16YWcgZW5jb2RlZC5cclxuICogQHBhcmFtIHtMb25nfG51bWJlcnxzdHJpbmd9IHZhbHVlIFZhbHVlIHRvIHdyaXRlXHJcbiAqIEByZXR1cm5zIHtXcml0ZXJ9IGB0aGlzYFxyXG4gKiBAdGhyb3dzIHtUeXBlRXJyb3J9IElmIGB2YWx1ZWAgaXMgYSBzdHJpbmcgYW5kIG5vIGxvbmcgbGlicmFyeSBpcyBwcmVzZW50LlxyXG4gKi9cclxuV3JpdGVyLnByb3RvdHlwZS5zaW50NjQgPSBmdW5jdGlvbiB3cml0ZV9zaW50NjQodmFsdWUpIHtcclxuICAgIHZhciBiaXRzID0gTG9uZ0JpdHMuZnJvbSh2YWx1ZSkuenpFbmNvZGUoKTtcclxuICAgIHJldHVybiB0aGlzLnB1c2god3JpdGVWYXJpbnQ2NCwgYml0cy5sZW5ndGgoKSwgYml0cyk7XHJcbn07XHJcblxyXG4vKipcclxuICogV3JpdGVzIGEgYm9vbGlzaCB2YWx1ZSBhcyBhIHZhcmludC5cclxuICogQHBhcmFtIHtib29sZWFufSB2YWx1ZSBWYWx1ZSB0byB3cml0ZVxyXG4gKiBAcmV0dXJucyB7V3JpdGVyfSBgdGhpc2BcclxuICovXHJcbldyaXRlci5wcm90b3R5cGUuYm9vbCA9IGZ1bmN0aW9uIHdyaXRlX2Jvb2wodmFsdWUpIHtcclxuICAgIHJldHVybiB0aGlzLnB1c2god3JpdGVCeXRlLCAxLCB2YWx1ZSA/IDEgOiAwKTtcclxufTtcclxuXHJcbmZ1bmN0aW9uIHdyaXRlRml4ZWQzMih2YWwsIGJ1ZiwgcG9zKSB7XHJcbiAgICBidWZbcG9zKytdID0gIHZhbCAgICAgICAgICYgMjU1O1xyXG4gICAgYnVmW3BvcysrXSA9ICB2YWwgPj4+IDggICAmIDI1NTtcclxuICAgIGJ1Zltwb3MrK10gPSAgdmFsID4+PiAxNiAgJiAyNTU7XHJcbiAgICBidWZbcG9zICBdID0gIHZhbCA+Pj4gMjQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBXcml0ZXMgYW4gdW5zaWduZWQgMzIgYml0IHZhbHVlIGFzIGZpeGVkIDMyIGJpdHMuXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSB2YWx1ZSBWYWx1ZSB0byB3cml0ZVxyXG4gKiBAcmV0dXJucyB7V3JpdGVyfSBgdGhpc2BcclxuICovXHJcbldyaXRlci5wcm90b3R5cGUuZml4ZWQzMiA9IGZ1bmN0aW9uIHdyaXRlX2ZpeGVkMzIodmFsdWUpIHtcclxuICAgIHJldHVybiB0aGlzLnB1c2god3JpdGVGaXhlZDMyLCA0LCB2YWx1ZSA+Pj4gMCk7XHJcbn07XHJcblxyXG4vKipcclxuICogV3JpdGVzIGEgc2lnbmVkIDMyIGJpdCB2YWx1ZSBhcyBmaXhlZCAzMiBiaXRzLlxyXG4gKiBAZnVuY3Rpb25cclxuICogQHBhcmFtIHtudW1iZXJ9IHZhbHVlIFZhbHVlIHRvIHdyaXRlXHJcbiAqIEByZXR1cm5zIHtXcml0ZXJ9IGB0aGlzYFxyXG4gKi9cclxuV3JpdGVyLnByb3RvdHlwZS5zZml4ZWQzMiA9IFdyaXRlci5wcm90b3R5cGUuZml4ZWQzMjtcclxuXHJcbi8qKlxyXG4gKiBXcml0ZXMgYW4gdW5zaWduZWQgNjQgYml0IHZhbHVlIGFzIGZpeGVkIDY0IGJpdHMuXHJcbiAqIEBwYXJhbSB7TG9uZ3xudW1iZXJ8c3RyaW5nfSB2YWx1ZSBWYWx1ZSB0byB3cml0ZVxyXG4gKiBAcmV0dXJucyB7V3JpdGVyfSBgdGhpc2BcclxuICogQHRocm93cyB7VHlwZUVycm9yfSBJZiBgdmFsdWVgIGlzIGEgc3RyaW5nIGFuZCBubyBsb25nIGxpYnJhcnkgaXMgcHJlc2VudC5cclxuICovXHJcbldyaXRlci5wcm90b3R5cGUuZml4ZWQ2NCA9IGZ1bmN0aW9uIHdyaXRlX2ZpeGVkNjQodmFsdWUpIHtcclxuICAgIHZhciBiaXRzID0gTG9uZ0JpdHMuZnJvbSh2YWx1ZSk7XHJcbiAgICByZXR1cm4gdGhpcy5wdXNoKHdyaXRlRml4ZWQzMiwgNCwgYml0cy5sbykucHVzaCh3cml0ZUZpeGVkMzIsIDQsIGJpdHMuaGkpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFdyaXRlcyBhIHNpZ25lZCA2NCBiaXQgdmFsdWUgYXMgZml4ZWQgNjQgYml0cy5cclxuICogQGZ1bmN0aW9uXHJcbiAqIEBwYXJhbSB7TG9uZ3xudW1iZXJ8c3RyaW5nfSB2YWx1ZSBWYWx1ZSB0byB3cml0ZVxyXG4gKiBAcmV0dXJucyB7V3JpdGVyfSBgdGhpc2BcclxuICogQHRocm93cyB7VHlwZUVycm9yfSBJZiBgdmFsdWVgIGlzIGEgc3RyaW5nIGFuZCBubyBsb25nIGxpYnJhcnkgaXMgcHJlc2VudC5cclxuICovXHJcbldyaXRlci5wcm90b3R5cGUuc2ZpeGVkNjQgPSBXcml0ZXIucHJvdG90eXBlLmZpeGVkNjQ7XHJcblxyXG52YXIgd3JpdGVGbG9hdCA9IHR5cGVvZiBGbG9hdDMyQXJyYXkgIT09IFwidW5kZWZpbmVkXCJcclxuICAgID8gKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHZhciBmMzIgPSBuZXcgRmxvYXQzMkFycmF5KDEpLFxyXG4gICAgICAgICAgICBmOGIgPSBuZXcgVWludDhBcnJheShmMzIuYnVmZmVyKTtcclxuICAgICAgICBmMzJbMF0gPSAtMDtcclxuICAgICAgICByZXR1cm4gZjhiWzNdIC8vIGFscmVhZHkgbGU/XHJcbiAgICAgICAgICAgID8gZnVuY3Rpb24gd3JpdGVGbG9hdF9mMzIodmFsLCBidWYsIHBvcykge1xyXG4gICAgICAgICAgICAgICAgZjMyWzBdID0gdmFsO1xyXG4gICAgICAgICAgICAgICAgYnVmW3BvcysrXSA9IGY4YlswXTtcclxuICAgICAgICAgICAgICAgIGJ1Zltwb3MrK10gPSBmOGJbMV07XHJcbiAgICAgICAgICAgICAgICBidWZbcG9zKytdID0gZjhiWzJdO1xyXG4gICAgICAgICAgICAgICAgYnVmW3BvcyAgXSA9IGY4YlszXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgICAgICAgICA6IGZ1bmN0aW9uIHdyaXRlRmxvYXRfZjMyX2xlKHZhbCwgYnVmLCBwb3MpIHtcclxuICAgICAgICAgICAgICAgIGYzMlswXSA9IHZhbDtcclxuICAgICAgICAgICAgICAgIGJ1Zltwb3MrK10gPSBmOGJbM107XHJcbiAgICAgICAgICAgICAgICBidWZbcG9zKytdID0gZjhiWzJdO1xyXG4gICAgICAgICAgICAgICAgYnVmW3BvcysrXSA9IGY4YlsxXTtcclxuICAgICAgICAgICAgICAgIGJ1Zltwb3MgIF0gPSBmOGJbMF07XHJcbiAgICAgICAgICAgIH07XHJcbiAgICB9KSgpXHJcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgOiBmdW5jdGlvbiB3cml0ZUZsb2F0X2llZWU3NTQodmFsdWUsIGJ1ZiwgcG9zKSB7XHJcbiAgICAgICAgdmFyIHNpZ24gPSB2YWx1ZSA8IDAgPyAxIDogMDtcclxuICAgICAgICBpZiAoc2lnbilcclxuICAgICAgICAgICAgdmFsdWUgPSAtdmFsdWU7XHJcbiAgICAgICAgaWYgKHZhbHVlID09PSAwKVxyXG4gICAgICAgICAgICB3cml0ZUZpeGVkMzIoMSAvIHZhbHVlID4gMCA/IC8qIHBvc2l0aXZlICovIDAgOiAvKiBuZWdhdGl2ZSAwICovIDIxNDc0ODM2NDgsIGJ1ZiwgcG9zKTtcclxuICAgICAgICBlbHNlIGlmIChpc05hTih2YWx1ZSkpXHJcbiAgICAgICAgICAgIHdyaXRlRml4ZWQzMigyMTQ3NDgzNjQ3LCBidWYsIHBvcyk7XHJcbiAgICAgICAgZWxzZSBpZiAodmFsdWUgPiAzLjQwMjgyMzQ2NjM4NTI4ODZlKzM4KSAvLyArLUluZmluaXR5XHJcbiAgICAgICAgICAgIHdyaXRlRml4ZWQzMigoc2lnbiA8PCAzMSB8IDIxMzkwOTUwNDApID4+PiAwLCBidWYsIHBvcyk7XHJcbiAgICAgICAgZWxzZSBpZiAodmFsdWUgPCAxLjE3NTQ5NDM1MDgyMjI4NzVlLTM4KSAvLyBkZW5vcm1hbFxyXG4gICAgICAgICAgICB3cml0ZUZpeGVkMzIoKHNpZ24gPDwgMzEgfCBNYXRoLnJvdW5kKHZhbHVlIC8gMS40MDEyOTg0NjQzMjQ4MTdlLTQ1KSkgPj4+IDAsIGJ1ZiwgcG9zKTtcclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdmFyIGV4cG9uZW50ID0gTWF0aC5mbG9vcihNYXRoLmxvZyh2YWx1ZSkgLyBNYXRoLkxOMiksXHJcbiAgICAgICAgICAgICAgICBtYW50aXNzYSA9IE1hdGgucm91bmQodmFsdWUgKiBNYXRoLnBvdygyLCAtZXhwb25lbnQpICogODM4ODYwOCkgJiA4Mzg4NjA3O1xyXG4gICAgICAgICAgICB3cml0ZUZpeGVkMzIoKHNpZ24gPDwgMzEgfCBleHBvbmVudCArIDEyNyA8PCAyMyB8IG1hbnRpc3NhKSA+Pj4gMCwgYnVmLCBwb3MpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4vKipcclxuICogV3JpdGVzIGEgZmxvYXQgKDMyIGJpdCkuXHJcbiAqIEBmdW5jdGlvblxyXG4gKiBAcGFyYW0ge251bWJlcn0gdmFsdWUgVmFsdWUgdG8gd3JpdGVcclxuICogQHJldHVybnMge1dyaXRlcn0gYHRoaXNgXHJcbiAqL1xyXG5Xcml0ZXIucHJvdG90eXBlLmZsb2F0ID0gZnVuY3Rpb24gd3JpdGVfZmxvYXQodmFsdWUpIHtcclxuICAgIHJldHVybiB0aGlzLnB1c2god3JpdGVGbG9hdCwgNCwgdmFsdWUpO1xyXG59O1xyXG5cclxudmFyIHdyaXRlRG91YmxlID0gdHlwZW9mIEZsb2F0NjRBcnJheSAhPT0gXCJ1bmRlZmluZWRcIlxyXG4gICAgPyAoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyIGY2NCA9IG5ldyBGbG9hdDY0QXJyYXkoMSksXHJcbiAgICAgICAgICAgIGY4YiA9IG5ldyBVaW50OEFycmF5KGY2NC5idWZmZXIpO1xyXG4gICAgICAgIGY2NFswXSA9IC0wO1xyXG4gICAgICAgIHJldHVybiBmOGJbN10gLy8gYWxyZWFkeSBsZT9cclxuICAgICAgICAgICAgPyBmdW5jdGlvbiB3cml0ZURvdWJsZV9mNjQodmFsLCBidWYsIHBvcykge1xyXG4gICAgICAgICAgICAgICAgZjY0WzBdID0gdmFsO1xyXG4gICAgICAgICAgICAgICAgYnVmW3BvcysrXSA9IGY4YlswXTtcclxuICAgICAgICAgICAgICAgIGJ1Zltwb3MrK10gPSBmOGJbMV07XHJcbiAgICAgICAgICAgICAgICBidWZbcG9zKytdID0gZjhiWzJdO1xyXG4gICAgICAgICAgICAgICAgYnVmW3BvcysrXSA9IGY4YlszXTtcclxuICAgICAgICAgICAgICAgIGJ1Zltwb3MrK10gPSBmOGJbNF07XHJcbiAgICAgICAgICAgICAgICBidWZbcG9zKytdID0gZjhiWzVdO1xyXG4gICAgICAgICAgICAgICAgYnVmW3BvcysrXSA9IGY4Yls2XTtcclxuICAgICAgICAgICAgICAgIGJ1Zltwb3MgIF0gPSBmOGJbN107XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgICAgICAgICAgOiBmdW5jdGlvbiB3cml0ZURvdWJsZV9mNjRfbGUodmFsLCBidWYsIHBvcykge1xyXG4gICAgICAgICAgICAgICAgZjY0WzBdID0gdmFsO1xyXG4gICAgICAgICAgICAgICAgYnVmW3BvcysrXSA9IGY4Yls3XTtcclxuICAgICAgICAgICAgICAgIGJ1Zltwb3MrK10gPSBmOGJbNl07XHJcbiAgICAgICAgICAgICAgICBidWZbcG9zKytdID0gZjhiWzVdO1xyXG4gICAgICAgICAgICAgICAgYnVmW3BvcysrXSA9IGY4Yls0XTtcclxuICAgICAgICAgICAgICAgIGJ1Zltwb3MrK10gPSBmOGJbM107XHJcbiAgICAgICAgICAgICAgICBidWZbcG9zKytdID0gZjhiWzJdO1xyXG4gICAgICAgICAgICAgICAgYnVmW3BvcysrXSA9IGY4YlsxXTtcclxuICAgICAgICAgICAgICAgIGJ1Zltwb3MgIF0gPSBmOGJbMF07XHJcbiAgICAgICAgICAgIH07XHJcbiAgICB9KSgpXHJcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgOiBmdW5jdGlvbiB3cml0ZURvdWJsZV9pZWVlNzU0KHZhbHVlLCBidWYsIHBvcykge1xyXG4gICAgICAgIHZhciBzaWduID0gdmFsdWUgPCAwID8gMSA6IDA7XHJcbiAgICAgICAgaWYgKHNpZ24pXHJcbiAgICAgICAgICAgIHZhbHVlID0gLXZhbHVlO1xyXG4gICAgICAgIGlmICh2YWx1ZSA9PT0gMCkge1xyXG4gICAgICAgICAgICB3cml0ZUZpeGVkMzIoMCwgYnVmLCBwb3MpO1xyXG4gICAgICAgICAgICB3cml0ZUZpeGVkMzIoMSAvIHZhbHVlID4gMCA/IC8qIHBvc2l0aXZlICovIDAgOiAvKiBuZWdhdGl2ZSAwICovIDIxNDc0ODM2NDgsIGJ1ZiwgcG9zICsgNCk7XHJcbiAgICAgICAgfSBlbHNlIGlmIChpc05hTih2YWx1ZSkpIHtcclxuICAgICAgICAgICAgd3JpdGVGaXhlZDMyKDQyOTQ5NjcyOTUsIGJ1ZiwgcG9zKTtcclxuICAgICAgICAgICAgd3JpdGVGaXhlZDMyKDIxNDc0ODM2NDcsIGJ1ZiwgcG9zICsgNCk7XHJcbiAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSA+IDEuNzk3NjkzMTM0ODYyMzE1N2UrMzA4KSB7IC8vICstSW5maW5pdHlcclxuICAgICAgICAgICAgd3JpdGVGaXhlZDMyKDAsIGJ1ZiwgcG9zKTtcclxuICAgICAgICAgICAgd3JpdGVGaXhlZDMyKChzaWduIDw8IDMxIHwgMjE0NjQzNTA3MikgPj4+IDAsIGJ1ZiwgcG9zICsgNCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdmFyIG1hbnRpc3NhO1xyXG4gICAgICAgICAgICBpZiAodmFsdWUgPCAyLjIyNTA3Mzg1ODUwNzIwMTRlLTMwOCkgeyAvLyBkZW5vcm1hbFxyXG4gICAgICAgICAgICAgICAgbWFudGlzc2EgPSB2YWx1ZSAvIDVlLTMyNDtcclxuICAgICAgICAgICAgICAgIHdyaXRlRml4ZWQzMihtYW50aXNzYSA+Pj4gMCwgYnVmLCBwb3MpO1xyXG4gICAgICAgICAgICAgICAgd3JpdGVGaXhlZDMyKChzaWduIDw8IDMxIHwgbWFudGlzc2EgLyA0Mjk0OTY3Mjk2KSA+Pj4gMCwgYnVmLCBwb3MgKyA0KTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHZhciBleHBvbmVudCA9IE1hdGguZmxvb3IoTWF0aC5sb2codmFsdWUpIC8gTWF0aC5MTjIpO1xyXG4gICAgICAgICAgICAgICAgaWYgKGV4cG9uZW50ID09PSAxMDI0KVxyXG4gICAgICAgICAgICAgICAgICAgIGV4cG9uZW50ID0gMTAyMztcclxuICAgICAgICAgICAgICAgIG1hbnRpc3NhID0gdmFsdWUgKiBNYXRoLnBvdygyLCAtZXhwb25lbnQpO1xyXG4gICAgICAgICAgICAgICAgd3JpdGVGaXhlZDMyKG1hbnRpc3NhICogNDUwMzU5OTYyNzM3MDQ5NiA+Pj4gMCwgYnVmLCBwb3MpO1xyXG4gICAgICAgICAgICAgICAgd3JpdGVGaXhlZDMyKChzaWduIDw8IDMxIHwgZXhwb25lbnQgKyAxMDIzIDw8IDIwIHwgbWFudGlzc2EgKiAxMDQ4NTc2ICYgMTA0ODU3NSkgPj4+IDAsIGJ1ZiwgcG9zICsgNCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuLyoqXHJcbiAqIFdyaXRlcyBhIGRvdWJsZSAoNjQgYml0IGZsb2F0KS5cclxuICogQGZ1bmN0aW9uXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSB2YWx1ZSBWYWx1ZSB0byB3cml0ZVxyXG4gKiBAcmV0dXJucyB7V3JpdGVyfSBgdGhpc2BcclxuICovXHJcbldyaXRlci5wcm90b3R5cGUuZG91YmxlID0gZnVuY3Rpb24gd3JpdGVfZG91YmxlKHZhbHVlKSB7XHJcbiAgICByZXR1cm4gdGhpcy5wdXNoKHdyaXRlRG91YmxlLCA4LCB2YWx1ZSk7XHJcbn07XHJcblxyXG52YXIgd3JpdGVCeXRlcyA9IHV0aWwuQXJyYXkucHJvdG90eXBlLnNldFxyXG4gICAgPyBmdW5jdGlvbiB3cml0ZUJ5dGVzX3NldCh2YWwsIGJ1ZiwgcG9zKSB7XHJcbiAgICAgICAgYnVmLnNldCh2YWwsIHBvcyk7IC8vIGFsc28gd29ya3MgZm9yIHBsYWluIGFycmF5IHZhbHVlc1xyXG4gICAgfVxyXG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgIDogZnVuY3Rpb24gd3JpdGVCeXRlc19mb3IodmFsLCBidWYsIHBvcykge1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdmFsLmxlbmd0aDsgKytpKVxyXG4gICAgICAgICAgICBidWZbcG9zICsgaV0gPSB2YWxbaV07XHJcbiAgICB9O1xyXG5cclxuLyoqXHJcbiAqIFdyaXRlcyBhIHNlcXVlbmNlIG9mIGJ5dGVzLlxyXG4gKiBAcGFyYW0ge1VpbnQ4QXJyYXl8c3RyaW5nfSB2YWx1ZSBCdWZmZXIgb3IgYmFzZTY0IGVuY29kZWQgc3RyaW5nIHRvIHdyaXRlXHJcbiAqIEByZXR1cm5zIHtXcml0ZXJ9IGB0aGlzYFxyXG4gKi9cclxuV3JpdGVyLnByb3RvdHlwZS5ieXRlcyA9IGZ1bmN0aW9uIHdyaXRlX2J5dGVzKHZhbHVlKSB7XHJcbiAgICB2YXIgbGVuID0gdmFsdWUubGVuZ3RoID4+PiAwO1xyXG4gICAgaWYgKCFsZW4pXHJcbiAgICAgICAgcmV0dXJuIHRoaXMucHVzaCh3cml0ZUJ5dGUsIDEsIDApO1xyXG4gICAgaWYgKHV0aWwuaXNTdHJpbmcodmFsdWUpKSB7XHJcbiAgICAgICAgdmFyIGJ1ZiA9IFdyaXRlci5hbGxvYyhsZW4gPSBiYXNlNjQubGVuZ3RoKHZhbHVlKSk7XHJcbiAgICAgICAgYmFzZTY0LmRlY29kZSh2YWx1ZSwgYnVmLCAwKTtcclxuICAgICAgICB2YWx1ZSA9IGJ1ZjtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLnVpbnQzMihsZW4pLnB1c2god3JpdGVCeXRlcywgbGVuLCB2YWx1ZSk7XHJcbn07XHJcblxyXG4vKipcclxuICogV3JpdGVzIGEgc3RyaW5nLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gdmFsdWUgVmFsdWUgdG8gd3JpdGVcclxuICogQHJldHVybnMge1dyaXRlcn0gYHRoaXNgXHJcbiAqL1xyXG5Xcml0ZXIucHJvdG90eXBlLnN0cmluZyA9IGZ1bmN0aW9uIHdyaXRlX3N0cmluZyh2YWx1ZSkge1xyXG4gICAgdmFyIGxlbiA9IHV0ZjgubGVuZ3RoKHZhbHVlKTtcclxuICAgIHJldHVybiBsZW5cclxuICAgICAgICA/IHRoaXMudWludDMyKGxlbikucHVzaCh1dGY4LndyaXRlLCBsZW4sIHZhbHVlKVxyXG4gICAgICAgIDogdGhpcy5wdXNoKHdyaXRlQnl0ZSwgMSwgMCk7XHJcbn07XHJcblxyXG4vKipcclxuICogRm9ya3MgdGhpcyB3cml0ZXIncyBzdGF0ZSBieSBwdXNoaW5nIGl0IHRvIGEgc3RhY2suXHJcbiAqIENhbGxpbmcge0BsaW5rIFdyaXRlciNyZXNldHxyZXNldH0gb3Ige0BsaW5rIFdyaXRlciNsZGVsaW18bGRlbGltfSByZXNldHMgdGhlIHdyaXRlciB0byB0aGUgcHJldmlvdXMgc3RhdGUuXHJcbiAqIEByZXR1cm5zIHtXcml0ZXJ9IGB0aGlzYFxyXG4gKi9cclxuV3JpdGVyLnByb3RvdHlwZS5mb3JrID0gZnVuY3Rpb24gZm9yaygpIHtcclxuICAgIHRoaXMuc3RhdGVzID0gbmV3IFN0YXRlKHRoaXMpO1xyXG4gICAgdGhpcy5oZWFkID0gdGhpcy50YWlsID0gbmV3IE9wKG5vb3AsIDAsIDApO1xyXG4gICAgdGhpcy5sZW4gPSAwO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG4vKipcclxuICogUmVzZXRzIHRoaXMgaW5zdGFuY2UgdG8gdGhlIGxhc3Qgc3RhdGUuXHJcbiAqIEByZXR1cm5zIHtXcml0ZXJ9IGB0aGlzYFxyXG4gKi9cclxuV3JpdGVyLnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uIHJlc2V0KCkge1xyXG4gICAgaWYgKHRoaXMuc3RhdGVzKSB7XHJcbiAgICAgICAgdGhpcy5oZWFkICAgPSB0aGlzLnN0YXRlcy5oZWFkO1xyXG4gICAgICAgIHRoaXMudGFpbCAgID0gdGhpcy5zdGF0ZXMudGFpbDtcclxuICAgICAgICB0aGlzLmxlbiAgICA9IHRoaXMuc3RhdGVzLmxlbjtcclxuICAgICAgICB0aGlzLnN0YXRlcyA9IHRoaXMuc3RhdGVzLm5leHQ7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMuaGVhZCA9IHRoaXMudGFpbCA9IG5ldyBPcChub29wLCAwLCAwKTtcclxuICAgICAgICB0aGlzLmxlbiAgPSAwO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG4vKipcclxuICogUmVzZXRzIHRvIHRoZSBsYXN0IHN0YXRlIGFuZCBhcHBlbmRzIHRoZSBmb3JrIHN0YXRlJ3MgY3VycmVudCB3cml0ZSBsZW5ndGggYXMgYSB2YXJpbnQgZm9sbG93ZWQgYnkgaXRzIG9wZXJhdGlvbnMuXHJcbiAqIEByZXR1cm5zIHtXcml0ZXJ9IGB0aGlzYFxyXG4gKi9cclxuV3JpdGVyLnByb3RvdHlwZS5sZGVsaW0gPSBmdW5jdGlvbiBsZGVsaW0oKSB7XHJcbiAgICB2YXIgaGVhZCA9IHRoaXMuaGVhZCxcclxuICAgICAgICB0YWlsID0gdGhpcy50YWlsLFxyXG4gICAgICAgIGxlbiAgPSB0aGlzLmxlbjtcclxuICAgIHRoaXMucmVzZXQoKS51aW50MzIobGVuKTtcclxuICAgIGlmIChsZW4pIHtcclxuICAgICAgICB0aGlzLnRhaWwubmV4dCA9IGhlYWQubmV4dDsgLy8gc2tpcCBub29wXHJcbiAgICAgICAgdGhpcy50YWlsID0gdGFpbDtcclxuICAgICAgICB0aGlzLmxlbiArPSBsZW47XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcztcclxufTtcclxuXHJcbi8qKlxyXG4gKiBGaW5pc2hlcyB0aGUgd3JpdGUgb3BlcmF0aW9uLlxyXG4gKiBAcmV0dXJucyB7VWludDhBcnJheX0gRmluaXNoZWQgYnVmZmVyXHJcbiAqL1xyXG5Xcml0ZXIucHJvdG90eXBlLmZpbmlzaCA9IGZ1bmN0aW9uIGZpbmlzaCgpIHtcclxuICAgIHZhciBoZWFkID0gdGhpcy5oZWFkLm5leHQsIC8vIHNraXAgbm9vcFxyXG4gICAgICAgIGJ1ZiAgPSB0aGlzLmNvbnN0cnVjdG9yLmFsbG9jKHRoaXMubGVuKSxcclxuICAgICAgICBwb3MgID0gMDtcclxuICAgIHdoaWxlIChoZWFkKSB7XHJcbiAgICAgICAgaGVhZC5mbihoZWFkLnZhbCwgYnVmLCBwb3MpO1xyXG4gICAgICAgIHBvcyArPSBoZWFkLmxlbjtcclxuICAgICAgICBoZWFkID0gaGVhZC5uZXh0O1xyXG4gICAgfVxyXG4gICAgLy8gdGhpcy5oZWFkID0gdGhpcy50YWlsID0gbnVsbDtcclxuICAgIHJldHVybiBidWY7XHJcbn07XHJcblxyXG5Xcml0ZXIuX2NvbmZpZ3VyZSA9IGZ1bmN0aW9uKEJ1ZmZlcldyaXRlcl8pIHtcclxuICAgIEJ1ZmZlcldyaXRlciA9IEJ1ZmZlcldyaXRlcl87XHJcbn07XHJcbiIsIlwidXNlIHN0cmljdFwiO1xyXG5tb2R1bGUuZXhwb3J0cyA9IEJ1ZmZlcldyaXRlcjtcclxuXHJcbi8vIGV4dGVuZHMgV3JpdGVyXHJcbnZhciBXcml0ZXIgPSByZXF1aXJlKFwiLi93cml0ZXJcIik7XHJcbihCdWZmZXJXcml0ZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShXcml0ZXIucHJvdG90eXBlKSkuY29uc3RydWN0b3IgPSBCdWZmZXJXcml0ZXI7XHJcblxyXG52YXIgdXRpbCA9IHJlcXVpcmUoXCIuL3V0aWwvbWluaW1hbFwiKTtcclxuXHJcbnZhciBCdWZmZXIgPSB1dGlsLkJ1ZmZlcjtcclxuXHJcbi8qKlxyXG4gKiBDb25zdHJ1Y3RzIGEgbmV3IGJ1ZmZlciB3cml0ZXIgaW5zdGFuY2UuXHJcbiAqIEBjbGFzc2Rlc2MgV2lyZSBmb3JtYXQgd3JpdGVyIHVzaW5nIG5vZGUgYnVmZmVycy5cclxuICogQGV4dGVuZHMgV3JpdGVyXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKi9cclxuZnVuY3Rpb24gQnVmZmVyV3JpdGVyKCkge1xyXG4gICAgV3JpdGVyLmNhbGwodGhpcyk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBbGxvY2F0ZXMgYSBidWZmZXIgb2YgdGhlIHNwZWNpZmllZCBzaXplLlxyXG4gKiBAcGFyYW0ge251bWJlcn0gc2l6ZSBCdWZmZXIgc2l6ZVxyXG4gKiBAcmV0dXJucyB7QnVmZmVyfSBCdWZmZXJcclxuICovXHJcbkJ1ZmZlcldyaXRlci5hbGxvYyA9IGZ1bmN0aW9uIGFsbG9jX2J1ZmZlcihzaXplKSB7XHJcbiAgICByZXR1cm4gKEJ1ZmZlcldyaXRlci5hbGxvYyA9IHV0aWwuX0J1ZmZlcl9hbGxvY1Vuc2FmZSkoc2l6ZSk7XHJcbn07XHJcblxyXG52YXIgd3JpdGVCeXRlc0J1ZmZlciA9IEJ1ZmZlciAmJiBCdWZmZXIucHJvdG90eXBlIGluc3RhbmNlb2YgVWludDhBcnJheSAmJiBCdWZmZXIucHJvdG90eXBlLnNldC5uYW1lID09PSBcInNldFwiXHJcbiAgICA/IGZ1bmN0aW9uIHdyaXRlQnl0ZXNCdWZmZXJfc2V0KHZhbCwgYnVmLCBwb3MpIHtcclxuICAgICAgICBidWYuc2V0KHZhbCwgcG9zKTsgLy8gZmFzdGVyIHRoYW4gY29weSAocmVxdWlyZXMgbm9kZSA+PSA0IHdoZXJlIEJ1ZmZlcnMgZXh0ZW5kIFVpbnQ4QXJyYXkgYW5kIHNldCBpcyBwcm9wZXJseSBpbmhlcml0ZWQpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFsc28gd29ya3MgZm9yIHBsYWluIGFycmF5IHZhbHVlc1xyXG4gICAgfVxyXG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICAgIDogZnVuY3Rpb24gd3JpdGVCeXRlc0J1ZmZlcl9jb3B5KHZhbCwgYnVmLCBwb3MpIHtcclxuICAgICAgICBpZiAodmFsLmNvcHkpIC8vIEJ1ZmZlciB2YWx1ZXNcclxuICAgICAgICAgICAgdmFsLmNvcHkoYnVmLCBwb3MsIDAsIHZhbC5sZW5ndGgpO1xyXG4gICAgICAgIGVsc2UgZm9yICh2YXIgaSA9IDA7IGkgPCB2YWwubGVuZ3RoOykgLy8gcGxhaW4gYXJyYXkgdmFsdWVzXHJcbiAgICAgICAgICAgIGJ1Zltwb3MrK10gPSB2YWxbaSsrXTtcclxuICAgIH07XHJcblxyXG4vKipcclxuICogQG92ZXJyaWRlXHJcbiAqL1xyXG5CdWZmZXJXcml0ZXIucHJvdG90eXBlLmJ5dGVzID0gZnVuY3Rpb24gd3JpdGVfYnl0ZXNfYnVmZmVyKHZhbHVlKSB7XHJcbiAgICBpZiAodXRpbC5pc1N0cmluZyh2YWx1ZSkpXHJcbiAgICAgICAgdmFsdWUgPSB1dGlsLl9CdWZmZXJfZnJvbSh2YWx1ZSwgXCJiYXNlNjRcIik7XHJcbiAgICB2YXIgbGVuID0gdmFsdWUubGVuZ3RoID4+PiAwO1xyXG4gICAgdGhpcy51aW50MzIobGVuKTtcclxuICAgIGlmIChsZW4pXHJcbiAgICAgICAgdGhpcy5wdXNoKHdyaXRlQnl0ZXNCdWZmZXIsIGxlbiwgdmFsdWUpO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG5mdW5jdGlvbiB3cml0ZVN0cmluZ0J1ZmZlcih2YWwsIGJ1ZiwgcG9zKSB7XHJcbiAgICBpZiAodmFsLmxlbmd0aCA8IDQwKSAvLyBwbGFpbiBqcyBpcyBmYXN0ZXIgZm9yIHNob3J0IHN0cmluZ3MgKHByb2JhYmx5IGR1ZSB0byByZWR1bmRhbnQgYXNzZXJ0aW9ucylcclxuICAgICAgICB1dGlsLnV0Zjgud3JpdGUodmFsLCBidWYsIHBvcyk7XHJcbiAgICBlbHNlXHJcbiAgICAgICAgYnVmLnV0ZjhXcml0ZSh2YWwsIHBvcyk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBAb3ZlcnJpZGVcclxuICovXHJcbkJ1ZmZlcldyaXRlci5wcm90b3R5cGUuc3RyaW5nID0gZnVuY3Rpb24gd3JpdGVfc3RyaW5nX2J1ZmZlcih2YWx1ZSkge1xyXG4gICAgdmFyIGxlbiA9IEJ1ZmZlci5ieXRlTGVuZ3RoKHZhbHVlKTtcclxuICAgIHRoaXMudWludDMyKGxlbik7XHJcbiAgICBpZiAobGVuKVxyXG4gICAgICAgIHRoaXMucHVzaCh3cml0ZVN0cmluZ0J1ZmZlciwgbGVuLCB2YWx1ZSk7XHJcbiAgICByZXR1cm4gdGhpcztcclxufTtcclxuXHJcblxyXG4vKipcclxuICogRmluaXNoZXMgdGhlIHdyaXRlIG9wZXJhdGlvbi5cclxuICogQG5hbWUgQnVmZmVyV3JpdGVyI2ZpbmlzaFxyXG4gKiBAZnVuY3Rpb25cclxuICogQHJldHVybnMge0J1ZmZlcn0gRmluaXNoZWQgYnVmZmVyXHJcbiAqL1xyXG4iLCJpbXBvcnQgUm9vdCBmcm9tICcuL21vZGVscy9yb290J1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQ290aG9yaXR5UHJvdG9idWYge1xyXG4gIFxyXG4gIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgdGhpcy5yb290ID0gUm9vdDtcclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogRW5jb2RlIGEgbW9kZWwgdG8gYmUgdHJhbnNtaXR0ZWQgb3ZlciB3ZWJzb2NrZXRcclxuICAgKiBAcGFyYW0gbmFtZVxyXG4gICAqIEBwYXJhbSBmaWVsZHNcclxuICAgKiBAcmV0dXJucyB7KnxCdWZmZXJ8VWludDhBcnJheX1cclxuICAgKi9cclxuICBlbmNvZGVNZXNzYWdlKG5hbWUsIGZpZWxkcykge1xyXG4gICAgY29uc3QgbW9kZWwgPSB0aGlzLmdldE1vZGVsKG5hbWUpO1xyXG4gICAgXHJcbiAgICAvLyBDcmVhdGUgdGhlIG1lc3NhZ2Ugd2l0aCB0aGUgbW9kZWxcclxuICAgIGNvbnN0IG1zZyA9IG1vZGVsLmNyZWF0ZShmaWVsZHMpO1xyXG5cclxuICAgIC8vIEVuY29kZSB0aGUgbWVzc2FnZSBpbiBhIEJ1ZmZlckFycmF5XHJcbiAgICByZXR1cm4gbW9kZWwuZW5jb2RlKG1zZykuZmluaXNoKCk7XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIERlY29kZSBhIG1lc3NhZ2UgY29taW5nIGZyb20gYSB3ZWJzb2NrZXRcclxuICAgKiBAcGFyYW0gbmFtZVxyXG4gICAqIEBwYXJhbSBidWZmZXJcclxuICAgKi9cclxuICBkZWNvZGVNZXNzYWdlKG5hbWUsIGJ1ZmZlcikge1xyXG4gICAgY29uc3QgbW9kZWwgPSB0aGlzLmdldE1vZGVsKG5hbWUpO1xyXG4gICAgcmV0dXJuIG1vZGVsLmRlY29kZShidWZmZXIpO1xyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBSZXR1cm4gdGhlIHByb3RvYnVmIGxvYWRlZCBtb2RlbFxyXG4gICAqIEBwYXJhbSBuYW1lXHJcbiAgICogQHJldHVybnMge1JlZmxlY3Rpb25PYmplY3R8P1JlZmxlY3Rpb25PYmplY3R8c3RyaW5nfVxyXG4gICAqL1xyXG4gIGdldE1vZGVsKG5hbWUpIHtcclxuICAgIHJldHVybiB0aGlzLnJvb3QubG9va3VwKGBjb3Rob3JpdHkuJHtuYW1lfWApO1xyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgQ290aG9yaXR5UHJvdG9idWYgZnJvbSAnLi9jb3Rob3JpdHktcHJvdG9idWYnXHJcblxyXG5jbGFzcyBDb3Rob3JpdHlNZXNzYWdlcyBleHRlbmRzIENvdGhvcml0eVByb3RvYnVmIHtcclxuICBcclxuICAvKipcclxuICAgKiBDcmVhdGUgYW4gZW5jb2RlZCBtZXNzYWdlIHRvIG1ha2UgYSBzaWduIHJlcXVlc3QgdG8gYSBjb3Rob3JpdHkgbm9kZVxyXG4gICAqIEBwYXJhbSBtZXNzYWdlIHRvIHNpZ24gc3RvcmVkIGluIGEgVWludDhBcnJheVxyXG4gICAqIEBwYXJhbSBzZXJ2ZXJzIGxpc3Qgb2YgU2VydmVySWRlbnRpdHlcclxuICAgKiBAcmV0dXJucyB7KnxCdWZmZXJ8VWludDhBcnJheX1cclxuICAgKi9cclxuICBjcmVhdGVTaWduYXR1cmVSZXF1ZXN0KG1lc3NhZ2UsIHNlcnZlcnMpIHtcclxuICAgIGlmICghKG1lc3NhZ2UgaW5zdGFuY2VvZiBVaW50OEFycmF5KSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJtZXNzYWdlIG11c3QgYmUgYSBpbnN0YW5jZSBvZiBVaW50OEFycmF5XCIpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBjb25zdCBmaWVsZHMgPSB7XHJcbiAgICAgIG1lc3NhZ2UsXHJcbiAgICAgIHJvc3Rlcjoge1xyXG4gICAgICAgIGxpc3Q6IHNlcnZlcnNcclxuICAgICAgfVxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgcmV0dXJuIHRoaXMuZW5jb2RlTWVzc2FnZSgnU2lnbmF0dXJlUmVxdWVzdCcsIGZpZWxkcyk7XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIFJldHVybiB0aGUgZGVjb2RlZCByZXNwb25zZVxyXG4gICAqIEBwYXJhbSByZXNwb25zZVxyXG4gICAqIEByZXR1cm5zIHsqfVxyXG4gICAqL1xyXG4gIGRlY29kZVNpZ25hdHVyZVJlc3BvbnNlKHJlc3BvbnNlKSB7XHJcbiAgICByZXNwb25zZSA9IG5ldyBVaW50OEFycmF5KHJlc3BvbnNlKTtcclxuXHJcbiAgICByZXR1cm4gdGhpcy5kZWNvZGVNZXNzYWdlKCdTaWduYXR1cmVSZXNwb25zZScsIHJlc3BvbnNlKTtcclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogUmV0dXJuIHRoZSBkZWNvZGVkIHJlc3BvbnNlXHJcbiAgICogQHBhcmFtIHJlc3BvbnNlXHJcbiAgICogQHJldHVybnMgeyp9XHJcbiAgICovXHJcbiAgZGVjb2RlU3RhdHVzUmVzcG9uc2UocmVzcG9uc2UpIHtcclxuICAgIHJlc3BvbnNlID0gbmV3IFVpbnQ4QXJyYXkocmVzcG9uc2UpO1xyXG5cclxuICAgIHJldHVybiB0aGlzLmRlY29kZU1lc3NhZ2UoJ1N0YXR1c1Jlc3BvbnNlJywgcmVzcG9uc2UpO1xyXG4gIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZSBhbiBlbmNvZGVkIG1lc3NhZ2UgdG8gbWFrZSBhIFBpblJlcXVlc3QgdG8gYSBjb3Rob3JpdHkgbm9kZVxyXG4gICAgICogQHBhcmFtIHBpbiBwcmV2aW91c2x5IGdlbmVyYXRlZCBieSB0aGUgY29ub2RlXHJcbiAgICAgKiBAcGFyYW0gcHVibGljS2V5XHJcbiAgICAgKiBAcmV0dXJucyB7KnxCdWZmZXJ8VWludDhBcnJheX1cclxuICAgICAqL1xyXG4gIGNyZWF0ZVBpblJlcXVlc3QocGluLCBwdWJsaWNLZXkpIHtcclxuICAgIGNvbnN0IGZpZWxkcyA9IHtcclxuICAgICAgcGluOiBwaW4sXHJcbiAgICAgIHB1YmxpYzogcHVibGljS2V5XHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiB0aGlzLmVuY29kZU1lc3NhZ2UoJ1BpblJlcXVlc3QnLCBmaWVsZHMpO1xyXG4gIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZSBhbiBlbmNvZGVkIG1lc3NhZ2UgdG8gc3RvcmUgY29uZmlndXJhdGlvbiBpbmZvcm1hdGlvbiBvZiBhIGdpdmVuIFBvUCBwYXJ0eVxyXG4gICAgICogQHBhcmFtIG5hbWVcclxuICAgICAqIEBwYXJhbSBkYXRlXHJcbiAgICAgKiBAcGFyYW0gbG9jYXRpb25cclxuICAgICAqIEBwYXJhbSBpZFxyXG4gICAgICogQHBhcmFtIHNlcnZlcnNcclxuICAgICAqIEBwYXJhbSBhZ2dyZWdhdGVcclxuICAgICAqIEByZXR1cm5zIHsqfEJ1ZmZlcnxVaW50OEFycmF5fVxyXG4gICAgICovXHJcbiAgY3JlYXRlU3RvcmVDb25maWcobmFtZSwgZGF0ZSwgbG9jYXRpb24sIGlkLCBzZXJ2ZXJzLCBhZ2dyZWdhdGUpIHtcclxuICAgIGNvbnN0IGZpZWxkcyA9IHtcclxuICAgICAgZGVzYzoge1xyXG4gICAgICAgIG5hbWU6IG5hbWUsXHJcbiAgICAgICAgZGF0ZVRpbWU6IGRhdGUsXHJcbiAgICAgICAgbG9jYXRpb246IGxvY2F0aW9uLFxyXG4gICAgICAgIHJvc3Rlcjoge1xyXG4gICAgICAgICAgaWQ6IGlkLFxyXG4gICAgICAgICAgbGlzdDogc2VydmVycyxcclxuICAgICAgICAgIGFnZ3JlZ2F0ZTogYWdncmVnYXRlXHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiB0aGlzLmVuY29kZU1lc3NhZ2UoJ1N0b3JlQ29uZmlnJywgZmllbGRzKTtcclxuICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXR1cm4gdGhlIGRlY29kZWQgcmVzcG9uc2VcclxuICAgICAqIEBwYXJhbSByZXNwb25zZVxyXG4gICAgICogQHJldHVybnMgeyp9XHJcbiAgICAgKi9cclxuICBkZWNjZGVTdG9yZUNvbmZpZ1JlcGx5KHJlc3BvbnNlKSB7XHJcbiAgICByZXNwb25zZSA9IG5ldyBVaW50OEFycmF5KHJlc3BvbnNlKTtcclxuXHJcbiAgICByZXR1cm4gdGhpcy5kZWNvZGVNZXNzYWdlKCdTdG9yZUNvbmZpZ1JlcGx5JywgcmVzcG9uc2UpO1xyXG4gIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZSBhbiBlbmNvZGVkIG1lc3NhZ2UgdG8gZmluYWxpemUgb24gdGhlIGdpdmVuIGRlc2NpZC1wb3Bjb25maWdcclxuICAgICAqIEBwYXJhbSBkZXNjSWRcclxuICAgICAqIEBwYXJhbSBhdHRlbmRlZXNcclxuICAgICAqIEByZXR1cm5zIHsqfEJ1ZmZlcnxVaW50OEFycmF5fVxyXG4gICAgICovXHJcbiAgY3JlYXRlRmluYWxpemVSZXF1ZXN0KGRlc2NJZCwgYXR0ZW5kZWVzKSB7XHJcbiAgICBjb25zdCBmaWVsZHMgPSB7XHJcbiAgICAgIGRlc2NJZDogZGVzY0lkLFxyXG4gICAgICBhdHRlbmRlZXM6IGF0dGVuZGVlc1xyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gdGhpcy5lbmNvZGVNZXNzYWdlKCdGaW5hbGl6ZVJlcXVlc3QnLCBmaWVsZHMpO1xyXG4gIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJldHVybiB0aGUgZGVjb2RlZCByZXNwb25zZVxyXG4gICAgICogQHBhcmFtIHJlc3BvbnNlXHJcbiAgICAgKiBAcmV0dXJucyB7Kn1cclxuICAgICAqL1xyXG4gIGRlY29kZUZpbmFsaXplUmVzcG9uc2UocmVzcG9uc2UpIHtcclxuICAgICAgcmVzcG9uc2UgPSBuZXcgVWludDhBcnJheShyZXNwb25zZSk7XHJcblxyXG4gICAgICByZXR1cm4gdGhpcy5kZWNvZGVNZXNzYWdlKCdGaW5hbGl6ZVJlc3BvbnNlJywgcmVzcG9uc2UpO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgbmV3IENvdGhvcml0eU1lc3NhZ2VzKCk7IiwiaW1wb3J0IHByb3RvYnVmIGZyb20gJ3Byb3RvYnVmanMnXHJcbmNvbnN0IHtUeXBlLCBGaWVsZCwgTWFwRmllbGR9ID0gcHJvdG9idWY7XHJcblxyXG5jb25zdCBTdGF0dXNSZXNwb25zZSA9IG5ldyBUeXBlKCdTdGF0dXNSZXNwb25zZScpXHJcbiAgLmFkZChuZXcgTWFwRmllbGQoJ3N5c3RlbScsIDEsICdzdHJpbmcnLCAnU3RhdHVzJykpXHJcbiAgLmFkZChuZXcgRmllbGQoJ3NlcnZlcicsIDIsICdTZXJ2ZXJJZGVudGl0eScpKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IFN0YXR1c1Jlc3BvbnNlOyIsImltcG9ydCBwcm90b2J1ZiBmcm9tICdwcm90b2J1ZmpzJ1xyXG5jb25zdCB7VHlwZSwgRmllbGR9ID0gcHJvdG9idWY7XHJcblxyXG5jb25zdCBmaW5hbFN0YXRlbWVudCA9IG5ldyBUeXBlKFwiRmluYWxTdGF0ZW1lbnRcIilcclxuICAgIC5hZGQobmV3IEZpZWxkKCdkZXNjJywgMSwgJ3BvcERlc2MnKSlcclxuICAgIC5hZGQobmV3IEZpZWxkKCdhdHRlbmRlZXMnLCAyLCAnYnl0ZXMnKSlcclxuICAgIC5hZGQobmV3IEZpZWxkKCdzaWduYXR1cmUnLCAzLCAnYnl0ZXMnKSk7XHJcblxyXG5cclxuZXhwb3J0IGRlZmF1bHQgZmluYWxTdGF0ZW1lbnQ7IiwiaW1wb3J0IHByb3RvYnVmIGZyb20gJ3Byb3RvYnVmanMnXHJcbmNvbnN0IHtUeXBlLCBGaWVsZH0gPSBwcm90b2J1ZjtcclxuXHJcbmNvbnN0IGZpbmFsaXplUmVxdWVzdCA9IG5ldyBUeXBlKFwiRmluYWxpemVSZXF1ZXN0XCIpXHJcbiAgICAuYWRkKG5ldyBGaWVsZCgnZGVzY0lkJywgMSwgJ2J5dGVzJykpXHJcbiAgICAuYWRkKG5ldyBGaWVsZCgnYXR0ZW5kZWVzJywgMiwgJ2J5dGVzJyApKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGZpbmFsaXplUmVxdWVzdDsiLCJpbXBvcnQgcHJvdG9idWYgZnJvbSAncHJvdG9idWZqcydcclxuY29uc3Qge1R5cGUsIEZpZWxkfSA9IHByb3RvYnVmO1xyXG5cclxuY29uc3QgZmluYWxpemVSZXNwb25zZSA9IG5ldyBUeXBlKFwiRmluYWxpemVSZXNwb25zZVwiKVxyXG4gICAgLmFkZChuZXcgRmllbGQoJ2ZpbmFsJywgMSwgJ2ZpbmFsU3RhdGVtZW50JykpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZmluYWxpemVSZXNwb25zZTsiLCJpbXBvcnQgcHJvdG9idWYgZnJvbSAncHJvdG9idWZqcydcclxuY29uc3Qge1R5cGUsIEZpZWxkfSA9IHByb3RvYnVmO1xyXG5cclxuY29uc3QgcGluUmVxdWVzdCA9IG5ldyBUeXBlKFwiUGluUmVxdWVzdFwiKVxyXG4gICAgLmFkZChuZXcgRmllbGQoJ3BpbicsIDEsICdzdHJpbmcnKSlcclxuICAgIC5hZGQobmV3IEZpZWxkKCdwdWJsaWMnLCAyLCAnYnl0ZXMnKSk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBwaW5SZXF1ZXN0OyIsImltcG9ydCBwcm90b2J1ZiBmcm9tICdwcm90b2J1ZmpzJ1xyXG5jb25zdCB7VHlwZSwgRmllbGR9ID0gcHJvdG9idWY7XHJcblxyXG5jb25zdCBwb3BEZXNjID0gbmV3IFR5cGUoXCJQb3BEZXNjXCIpXHJcbiAgICAuYWRkKG5ldyBGaWVsZCgnbmFtZScsIDEsICdzdHJpbmcnKSlcclxuICAgIC5hZGQobmV3IEZpZWxkKCdkYXRlVGltZScsIDIsICdzdHJpbmcnKSlcclxuICAgIC5hZGQobmV3IEZpZWxkKCdsb2NhdGlvbicsIDMsICdzdHJpbmcnKSlcclxuICAgIC5hZGQobmV3IEZpZWxkKCdyb3N0ZXInLCA0LCAnUm9zdGVyJykpO1xyXG5cclxuXHJcbmV4cG9ydCBkZWZhdWx0IHBvcERlc2M7IiwiaW1wb3J0IHByb3RvYnVmIGZyb20gJ3Byb3RvYnVmanMnXHJcbmNvbnN0IHtUeXBlLCBGaWVsZH0gPSBwcm90b2J1ZjtcclxuXHJcbmNvbnN0IHN0b3JlQ29uZmlnUmVwbHkgPSBuZXcgVHlwZShcIlN0b3JlQ29uZmlnUmVwbHlcIilcclxuICAgIC5hZGQobmV3IEZpZWxkKCdpZCcsIDEsICdieXRlcycpKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IHN0b3JlQ29uZmlnUmVwbHk7IiwiaW1wb3J0IHByb3RvYnVmIGZyb20gJ3Byb3RvYnVmanMnXHJcbmNvbnN0IHtUeXBlLCBGaWVsZH0gPSBwcm90b2J1ZjtcclxuXHJcbmNvbnN0IHN0b3JlQ29uZmlnID0gbmV3IFR5cGUoXCJTdG9yZUNvbmZpZ1wiKVxyXG4gICAgLmFkZChuZXcgRmllbGQoJ2Rlc2MnLCAxLCAncG9wRGVzYycpKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IHN0b3JlQ29uZmlnOyIsImltcG9ydCBwcm90b2J1ZiBmcm9tICdwcm90b2J1ZmpzJ1xyXG5jb25zdCB7Um9vdH0gPSBwcm90b2J1ZjtcclxuXHJcbmltcG9ydCBTdGF0dXNSZXNwb25zZSBmcm9tICcuL1N0YXR1c1Jlc3BvbnNlJ1xyXG5pbXBvcnQgU3RhdHVzIGZyb20gJy4vc3RhdHVzJ1xyXG5pbXBvcnQgU2VydmVySWRlbnRpdHkgZnJvbSAnLi9zZXJ2ZXItaWRlbnRpdHknXHJcbmltcG9ydCBSb3N0ZXIgZnJvbSAnLi9yb3N0ZXInXHJcbmltcG9ydCBTaWduYXR1cmVSZXF1ZXN0IGZyb20gJy4vc2lnbmF0dXJlLXJlcXVlc3QnXHJcbmltcG9ydCBTaWduYXR1cmVSZXNwb25zZSBmcm9tICcuL3NpZ25hdHVyZS1yZXNwb25zZSdcclxuaW1wb3J0IFBpblJlcXVlc3QgZnJvbSAnLi9wb3AvcGluLXJlcXVlc3QnXHJcbmltcG9ydCBTdG9yZUNvbmZpZyBmcm9tICcuL3BvcC9zdG9yZS1jb25maWcnXHJcbmltcG9ydCBTdG9yZUNvbmZpZ1JlcGx5IGZyb20gJy4vcG9wL3N0b3JlLWNvbmZpZy1yZXBseSdcclxuaW1wb3J0IEZpbmFsaXplUmVxdWVzdCBmcm9tICcuL3BvcC9maW5hbGl6ZS1yZXF1ZXN0J1xyXG5pbXBvcnQgRmluYWxpemVSZXNwb25zZSBmcm9tICcuL3BvcC9maW5hbGl6ZS1yZXNwb25zZSdcclxuaW1wb3J0IFBvcERlc2MgZnJvbSAnLi9wb3AvcG9wLWRlc2MnXHJcbmltcG9ydCBGaW5hbFN0YXRlbWVudCBmcm9tICcuL3BvcC9maW5hbC1zdGF0ZW1lbnQnXHJcblxyXG5jb25zdCByb290ID0gbmV3IFJvb3QoKTtcclxucm9vdC5kZWZpbmUoXCJjb3Rob3JpdHlcIilcclxuICAgIC5hZGQoU3RhdHVzKVxyXG4gICAgLmFkZChTZXJ2ZXJJZGVudGl0eSlcclxuICAgIC5hZGQoU3RhdHVzUmVzcG9uc2UpXHJcbiAgICAuYWRkKFJvc3RlcilcclxuICAgIC5hZGQoU2lnbmF0dXJlUmVxdWVzdClcclxuICAgIC5hZGQoU2lnbmF0dXJlUmVzcG9uc2UpXHJcbiAgICAuYWRkKFBpblJlcXVlc3QpXHJcbiAgICAuYWRkKFN0b3JlQ29uZmlnKVxyXG4gICAgLmFkZChTdG9yZUNvbmZpZ1JlcGx5KVxyXG4gICAgLmFkZChGaW5hbGl6ZVJlcXVlc3QpXHJcbiAgICAuYWRkKEZpbmFsaXplUmVzcG9uc2UpXHJcbiAgICAuYWRkKFBvcERlc2MpXHJcbiAgICAuYWRkKEZpbmFsU3RhdGVtZW50KTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IHJvb3Q7IiwiaW1wb3J0IHByb3RvYnVmIGZyb20gJ3Byb3RvYnVmanMnXHJcbmNvbnN0IHtUeXBlLCBGaWVsZH0gPSBwcm90b2J1ZjtcclxuXHJcbmNvbnN0IHJvc3RlciA9IG5ldyBUeXBlKFwiUm9zdGVyXCIpXHJcbiAgLmFkZChuZXcgRmllbGQoJ2lkJywgMSwgJ2J5dGVzJykpXHJcbiAgLmFkZChuZXcgRmllbGQoJ2xpc3QnLCAyLCAnU2VydmVySWRlbnRpdHknLCAncmVwZWF0ZWQnKSlcclxuICAuYWRkKG5ldyBGaWVsZCgnYWdncmVnYXRlJywgMywgJ2J5dGVzJykpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgcm9zdGVyOyIsImltcG9ydCBwcm90b2J1ZiBmcm9tICdwcm90b2J1ZmpzJ1xyXG5jb25zdCB7VHlwZSwgRmllbGR9ID0gcHJvdG9idWY7XHJcblxyXG5jb25zdCBzZXJ2ZXJJZGVudGl0eSA9IG5ldyBUeXBlKCdTZXJ2ZXJJZGVudGl0eScpXHJcbiAgLmFkZChuZXcgRmllbGQoJ3B1YmxpYycsIDEsICdieXRlcycpKVxyXG4gIC5hZGQobmV3IEZpZWxkKCdpZCcsIDIsICdieXRlcycpKVxyXG4gIC5hZGQobmV3IEZpZWxkKCdhZGRyZXNzJywgMywgJ3N0cmluZycpKVxyXG4gIC5hZGQobmV3IEZpZWxkKCdkZXNjcmlwdGlvbicsIDQsICdzdHJpbmcnKSk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBzZXJ2ZXJJZGVudGl0eTsiLCJpbXBvcnQgcHJvdG9idWYgZnJvbSAncHJvdG9idWZqcydcclxuY29uc3Qge1R5cGUsIEZpZWxkfSA9IHByb3RvYnVmO1xyXG5cclxuY29uc3Qgc2lnbmF0dXJlUmVxdWVzdCA9IG5ldyBUeXBlKFwiU2lnbmF0dXJlUmVxdWVzdFwiKVxyXG4gIC5hZGQobmV3IEZpZWxkKCdtZXNzYWdlJywgMSwgJ2J5dGVzJykpXHJcbiAgLmFkZChuZXcgRmllbGQoJ3Jvc3RlcicsIDIsICdSb3N0ZXInKSk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBzaWduYXR1cmVSZXF1ZXN0OyIsImltcG9ydCBwcm90b2J1ZiBmcm9tICdwcm90b2J1ZmpzJ1xyXG5jb25zdCB7VHlwZSwgRmllbGR9ID0gcHJvdG9idWY7XHJcblxyXG5jb25zdCBzaWduYXR1cmVSZXNwb25zZSA9IG5ldyBUeXBlKFwiU2lnbmF0dXJlUmVzcG9uc2VcIilcclxuICAuYWRkKG5ldyBGaWVsZCgnaGFzaCcsIDEsICdieXRlcycsICdyZXF1aXJlZCcpKVxyXG4gIC5hZGQobmV3IEZpZWxkKCdzaWduYXR1cmUnLCAyLCAnYnl0ZXMnLCAncmVxdWlyZWQnKSk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBzaWduYXR1cmVSZXNwb25zZTsiLCJpbXBvcnQgcHJvdG9idWYgZnJvbSAncHJvdG9idWZqcydcclxuY29uc3Qge1R5cGUsIE1hcEZpZWxkfSA9IHByb3RvYnVmO1xyXG5cclxuY29uc3Qgc3RhdHVzID0gbmV3IFR5cGUoJ1N0YXR1cycpXHJcbiAgLmFkZChuZXcgTWFwRmllbGQoJ2ZpZWxkJywgMSwgJ3N0cmluZycsICdzdHJpbmcnKSk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBzdGF0dXM7Il19

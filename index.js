//-*- javascript -*-
/* Copyright 2019 zrajm (GPLv2 license). */

function load(url) {
    return new Promise(function(resolve, reject) {
        let ext = url.split(".").pop();
        let tag = { js: "script", mjs: "script", css: "link" }[ext] || "img";
        let parent = "body";
        let attr = "src";
        let element = document.createElement(tag);
        element.onload  = function() { resolve(url) };
        element.onerror = function() { reject(url)  };
        switch (ext) {
        case "js":
            element.async = true;
            break;
        case "mjs":
            element.async = true;
            element.type = "module";
            break;
        case "css":
            element.rel = "stylesheet";
            attr = "href";
            parent = "head";
            break;
        }
        element[attr] = url;
        document[parent].appendChild(element);
    });
};

// Traverse a tree (list-of-lists) and remove all occurrences of the empty
// string ('') and the empty lists ([]). This will modify the original tree +
// return the same (now modified) tree as a return value.
function pruneTree(tree) {
    var i = 0, t;
    while (i < tree.length) {
        t = tree[i];
        // NOTA BENE: pruneTree() is called recursivelly in comparison.
        if (t === '' || (Array.isArray(t) && pruneTree(t).length === 0)) {
            tree.splice(i, 1);
        } else {
            i += 1;
        }
    }
    return tree;
}

function parse(tokens, tree, stateMachine) {
    let state = stateMachine.startState;
    let max   = tokens.length - 1;
    let postproc = stateMachine.postprocess || function (x) { return x; };
    let newTree = tokens.reduce(function (tree, token, i) {
        if (stateMachine[state] === undefined) {
            throw "Unknown state '" + state + "'";
        }
        let callbacks = stateMachine[state];
        let callback = callbacks[token.toLowerCase()] || callbacks.DEFAULT;
        if (typeof callback !== 'function' && typeof callback !== 'string') {
            throw Error("No rule 'DEFAULT' in state '" + state + "'");
        }
        let newState = (typeof callback === "string")
            ? callback
            : callback(tree, token, {
                state,                    // name of current state
                last: i === max,          // true = last token
            });
        if (newState !== undefined && newState !== state) {
            state = newState;
        }
        return tree;
    }, tree);
    return postproc(newTree);
}

// Prettifies a javascript object, a la Chrome debugging console.
function prettify(x) {
    function prettifyObject(x) {
        if (x === null) {                              // null
            return "null";
        }
        if (x.length === undefined) {                  // object
            return "{ " + Object.keys(x).map((i) => {
                return i + ": " + prettify(x[i]);
            }).join(", ") + " }";
        }
        // Special 'named' list (with name in property '_')
        if (x._ !== undefined) {
            return x._ + "(" + x.map((z) => prettify(z)).concat( // array
                Object.keys(x).sort().reduce((a, i) => {   //   any named properties
                    if (isNaN(parseInt(i, 10)) && i[0] !== '_') {
                        a.push(i + ": " + prettify(x[i]));
                    }
                    return a;
                }, [])
            ).join(", ") + ")";
        }
        return "[" + x.map((z) => prettify(z)).concat( // array
            Object.keys(x).sort().reduce((a, i) => {   //   any named properties
                if (isNaN(parseInt(i, 10)) && i[0] !== '_') {
                    a.push(i + ": " + prettify(x[i]));
                }
                return a;
            }, [])
        ).join(", ") + "]";
    }
    // typeof return values: "undefined", "boolean", "number", "bigint",
    // "string", "symbol", "function", "object" (null is considered "object")
    switch (typeof x) {
        case "undefined": return "undefined";
        case "boolean":   return x.toString();
        case "number":    return x.toString();
        case "bigint":    return x.toString();
        case "string":    return "'" + x + "'"; // FIXME escape 's in x(?)
        case "symbol":    return x.toString();
        case "function":  return x.toString();
        case "object":    return prettifyObject(x);
        default: throw TypeError("Unknown variable type '" + typeof x + "'");
    }
}

// Tokenize a string by splitting it on three groups of characters
// (trailing/leading whitespace is trimmed before this). Types of characters
// are: (a) spaces, (b) special characters and (c) all other characters.
//
// Special characters always occur alone, ie multiple special chars occuring
// next to each other are split into individual tokens (eg '""' becomes '"' +
// '"'), spaces and other characters are lumped together (eg 'apa bepa' becomes
// 'apa' + ' ' + 'bepa').
//
// Special characters are ":{}(),*-
let tokenize = (function () {
    const chr = '":{}(),*-';  // special characters
    const re = new RegExp('(\\s+|[' + chr + ']|[^\\s' + chr + ']+)', 'ug');
    return function tokenize(str) {
        return str.match(re);
    }
})();

var Tree = (function () {
    function Tree() {
        var tree = [];
        var stack = [tree];
        tree.__proto__ = Tree.prototype;
        tree._node = function ()  { return stack[stack.length - 1]; };
        tree._pop  = function ()  { if (stack.length > 1) { stack.pop(); } };
        tree._push = function (a) { stack.push(a); };
        return tree;
    }
    Tree.prototype = []; // (or 'Object.create(Array.prototype);')
    Tree.prototype.name = 'Tree';
    Tree.prototype.constructor = Tree;
    Tree.prototype.last = function () {
        let last = this._node();                   //   in current node
        return last[last.length - 1];
    };
    Tree.prototype.add = function (x) {            // add subnode & enter it
        var a = [];
        [].push.call(this._node(), a);
        this._push(a);
    };
    //Tree.prototype.drop = function () { };       // drop current node
    Tree.prototype.join = function (str) {         // append string to last element
        let last = this._node();                   //   in current node
        if (typeof last[last.length - 1] === "string") {
            last[last.length - 1] += str;
        } else {
            this.push(str);
        }
    };
    Tree.prototype.leave = function () {           // leave current node
        this._pop();
    };
    Tree.prototype.pop = function () {             // remove last element in current node
        return [].pop.call(this._node());
    };
    Tree.prototype.get = function (name) {         // get property in current node
        return this._node()[name];
    };
    Tree.prototype.set = function (name, value) {  // set property in current node
        this._node()[name] = value;
    };
    Tree.prototype.push = function (str) {         // append element to current node
        [].push.call(this._node(), str);
    };
    return Tree;
})();


/******************************************************************************/
function main() {
    if (/[?&]DEBUG(&|$)/.test(location.hash)) { // if 'DEBUG' parameter
        console.log("Running tests...");
        load('tests.mjs');
        return;
    } else {
        console.log("Use parameter '#?DEBUG' to run test suite");
    }
}

load("cash.min.js").then(main);

/*[eof]*/

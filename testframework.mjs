//-*- javascript -*-
/*
  Test framework implementing TAP 'Test Anything Protocol'.
  Copyright 2019 zrajm (GPLv2 license).

  http://testanything.org/tap-version-13-specification.html
  https://node-tap.org/tap-protocol/

  Module test function names are inspired by Perl's Test::Simple and Test::More
  modules. Script is written using ES6 standard (since the test suite does not
  have to work on every browser, only my own).

 */

export {diag, is, ok, output, tests};

let groupLvl = 0;
let outputBuffer = [];

function fmt(...args) {
    const o = (typeof args[args.length - 1] === 'object') ? args.pop() : {};
    return args.join('\n').replace(/{([^{}]*)}/g, function (a, b) {
        const r = o[b];
        return typeof r === 'string' || typeof r === 'number' ? r : a;
    });
};

function tests(desc, func) {
    groupLvl += 1;
    try {
        func();              // tests() may be called recursively in here
    } catch(e) {
        output("not ok ABORTED BECAUSE TEST THREW EXCEPTION: " + e.toString());
    }
    groupLvl -= 1;
    if (groupLvl === 0) {
        const someFailed = outputBuffer.some((x) => /^not ok\b/.test(x));
        if (someFailed) {
            output.raw(desc + ' # SOME FAILED', true, 'fail', console.group)
        } else {
            output.raw(desc + ' # ALL PASSED', true, 'pass', console.groupCollapsed)
        }
        outputBuffer.forEach((x) => output.raw(...x));
        outputBuffer = [];
        console.groupEnd();
    }
}

// |--------------------|-----------------|-------------------------------|
// | Command            |                 | Used for                      |
// |--------------------|-----------------|-------------------------------|
// | console.debug      | 'verbose' mode  |                               |
// | console.{log,info} | 'info' mode     | output 'ok' messages here     |
// | console.warn       | 'warnings' mode | output 'not ok' messages here |
// | console.error      | 'errors' mode   | output '#....' messages here  |
// |--------------------|-----------------|-------------------------------|
const output = (() => {
    const colorCb = {
        pass: (x) => ['%c' + x, 'font-weight: bold; color: green;'],
        fail: (x) => ['%c' + x, 'font-weight: bold; color: red;'],
        none: (x) => [x],
    };
    const x = (str) => {
        return  /^ok\b/.test(str) ? output.pass(str) :
            /^not ok\b/.test(str) ? output.fail(str) : output.info(str);
    };
    x.raw = (str, retval=undefined, color='none', cmd=console.info) => {
        if (groupLvl > 0) {
            outputBuffer.push([str, retval, color, cmd]);
        } else {
            cmd(...colorCb[color](str));
        }
        return retval;
    };
    x.pass = (x) => output.raw(x, true,  'pass');
    x.fail = (x) => output.raw(x, false, 'fail', console.warn);
    x.diag = (x) => output.raw(x, false, 'fail', console.error);
    x.info = (x) => output.raw(x);
    return x;
})();

function diag(...str) {
    return output.diag(fmt(...commentify(...str)));
}

// Insert '# ' first in all strings.
function commentify(...str) {
    return str.map((a) => typeof a === "string" ? "# " + a : a);
}

// Forever increasing counter.
const counter = (function() {
    let c = 0;
    return () => ++ c;
})();

function test_ok(bool, desc, failMsg, failMsgSubst) {
    bool = !!bool;                      // force to boolean
    desc = desc ? desc.toString() : ""; // force to string
    if (/^[\d\s]+$/.test(desc)) {
        diag(
            "You named your test '{desc}'. Don't use numbers for your test names.",
            "It's confusing.",
            { desc },
        );
    }
    return (bool ? 'ok ' : 'not ok ') + counter() +
        (desc ? ' - ' + desc : '') +
        (!bool ? "\n#     Failed test" + (
            desc ? " '" + desc + "'" : ''
        ) : '') + // FIXME in file '{file}', line {line}
        (!bool && failMsg ? fmt('', ...failMsg, failMsgSubst) : '');
}

function ok(bool, desc) {
    return output(test_ok(bool, desc));
}

function is(have, want, desc) {
    have = prettify(have);
    want = prettify(want);
    const pass = have === want;
    return output(test_ok(pass, desc, commentify(
        '         got: {have}',
        '    expected: {want}',
    ), { want, have }));
}

// Explaines a Javascript object, a la Chrome debugging console.
/*
=item B<explain>

  my @dump = explain @diagnostic_message;

Will dump the contents of any references in a human readable format. Usually
you want to pass this into C<note> or C<diag>.

Handy for things like...

    is_deeply($have, $want) || diag explain $have;

or

    note explain \%args;
    Some::Class->method(%args);
*/
function explain(x) {
    function explainObject(x) {
        if (x === null) {                              // null
            return "null";
        }
        if (x.length === undefined) {                  // object
            return "{ " + Object.keys(x).map((i) => {
                return i + ": " + explain(x[i]);
            }).join(", ") + " }";
        }
        // Special 'named' list (with name in property '_')
        if (x._ !== undefined) {
            return x._ + "(" + x.map((z) => explain(z)).concat( // array
                Object.keys(x).sort().reduce((a, i) => {   //   any named properties
                    if (isNaN(parseInt(i, 10)) && i !== '_') {
                        a.push(i + ": " + explain(x[i]));
                    }
                    return a;
                }, [])
            ).join(", ") + ")";
        }
        return "[" + x.map((z) => explain(z)).concat(  // array
            Object.keys(x).sort().reduce((a, i) => {   //   any named properties
                if (isNaN(parseInt(i, 10))) {
                    a.push(i + ": " + explain(x[i]));
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
        case "object":    return explainObject(x);
        default: throw TypeError("Unknown variable type '" + typeof x + "'");
    }
}

/*[eof]*/

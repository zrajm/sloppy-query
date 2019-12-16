//-*- javascript -*-
/* Copyright 2019 zrajm (GPLv2 license). */

import {is, ok, output, tests} from './testframework.mjs';

/* logical operator functions */
function not(v) { return group('not', v); }
function and(...v) { return group('and', ...v); }
function or(...v) { return group('or', ...v); }
function prefix(p, v) { return group('prefix', p, v); }
function group(type, ...values) {
    values._ = type;
    return values;
}

tests("tokenize()", () => {
    is(tokenize('abc  def'),    ['abc', '  ', 'def'],          "maintain space in tokens");
    is(tokenize('((ab) cd)'),   ['(', '(', 'ab', ')', ' ', 'cd', ')'], "multiple special chars");
    is(tokenize('(abc def)'),   ['(', 'abc', ' ', 'def', ')'], "parentheses");
    is(tokenize('"a b" c'),     ['"', 'a', ' ', 'b', '"', ' ', 'c'], "quotes");
    is(tokenize('{abc}'),       ['{','abc', '}'],              "braces");
    is(tokenize("tera'ngan"),   ["tera'ngan"],                 "apostrophe is alphabetic");
    is(tokenize('a-b'),         ['a','-', 'b'],                "split on '-'");
    is(tokenize('":{}(),*-'),   ['"', ':', '{', '}', '(', ')', ',', '*', '-'],
                                                                "all special chars");
    is(tokenize('(åå)'),        ['(', 'åå', ')'],               "Swedish characters");
    is(tokenize('tlh:"ga go"'), ['tlh', ':', '"', 'ga', ' ', 'go', '"'], "colon prefix");
});

tests("Tree()", () => {
    var tree  = new Tree();
    var tree2 = new Tree();
    //info("Tree prototype");
    is(tree instanceof Tree,                true,  'tree instanceof Tree');
    is(tree instanceof Array,               true,  'tree instanceof Array');
    is(Tree.prototype.isPrototypeOf(tree),  true,  'Tree.prototype.isPrototypeOf(tree)');
    is(Array.prototype.isPrototypeOf(tree), true,  'Array.prototype.isPrototypeOf(tree)');
    is(tree.constructor.name,              'Tree', 'tree.constructor.name');
    ok(tree.name,                          'Tree', 'tree.name');
    is(Object.prototype.toString.apply(tree),      '[object Array]',
                                                   'Object.prototype.toString.apply(tree)');
    // info('Tree values');
    is(tree,                            [],         'empty tree');
    is(tree._node(),                    [],         'current stack entry');
    is(tree.last(),                     undefined,  'last() method');
    tree2.add();
    tree2.push('XXX');
    is(tree2,         [['XXX']],            "other tree");
    is(tree2.last(),    'XXX',              "other tree's last element");
    tree.push('a');
    is(tree,          ['a'],                "added 'a'");
    is(tree.last(),    'a',                 "last");
    tree.add();
    is(tree,          ['a', []],            "added subnode");
    is(tree.last(),    undefined,           "last when current subnode empty");
    tree.join('b');
    is(tree,          ['a',  ['b']],        "after joining 'b' to empty node");
    is(tree.last(),    'b',                 "last after adding 'b'");
    tree.leave();
    is(tree,          ['a', ['b']],         "added 'b'");
    is(tree.last(),   ['b'],                "last node ends in node");
    tree.push('c');
    is(tree,          ['a',  ['b'], 'c'],   "added 'c'");
    is(tree.last(),    'c',                 "last after adding 'c'");
    tree.join('c');
    is(tree,          ['a',  ['b'], 'cc'],  "appended 'c'");
    is(tree.last(),     'cc',               "last after appending 'c'");
    is(tree.pop(),      'cc',               "pop return value");
    is(tree, ['a',    ['b']],               "popped last value");
    is(tree.last(),   ['b'],                "last node ends in node");
    tree.join('d');
    is(prettify(tree), "['a', ['b'], 'd']", "appended 'd'");
    is(tree.last(),    'd',                 "last node ends in 'd'");
    tree.set('x', 'y');
    is(tree.get('x'),  'y',                 "set attribute");
    is(prettify(tree), "['a', ['b'], 'd', x: 'y']", "added attribute");
    is(tree.last(),    'd',                 "last after setting attribute");
    is(tree2,         [['XXX']],            "other tree should remain same");
    is(tree2.last(),    'XXX',              "other tree's last element should remain same");
});

tests('pruneTree()', () => {
    {
        let x = [], y = pruneTree(x);
        ok(x === y,                                    'return value refer to same object as arg');
    }
    is(pruneTree([0]),                      [0],          'single non-empty element');
    is(pruneTree(['a']),                    ['a'],        'single non-empty element');
    is(pruneTree([[]]),                     [],           'single empty list element');
    is(pruneTree(['']),                     [],           'single empty string element');
    is(pruneTree(['a', []]),                ['a'],        'something + empty list');
    is(pruneTree(['a', '']),                ['a'],        'something + empty string');
    is(pruneTree(['a', ['b']]),             ['a', ['b']], 'nested list');
    is(pruneTree(['a', ['b', []]]),         ['a', ['b']], 'nested list with empty list');
    is(pruneTree(['a', ['b', ['c']]]),      ['a', ['b', ['c']]], 'nested list with value in');
    is(pruneTree(['a', ['b', [['']]]]),     ['a', ['b']], 'nested list with empty string ');
});

// APPROX IMPLEMENTATION ORDER:
// '-': gotSpecial,
// ',': gotSpecial,
// ':': gotSpecial,
// '{': gotSpecial,
// '}': gotSpecial,
// '*': gotSpecial,
// -(abc) -a"b"c
// -abc
tests("parse()", () => {
    let parser = {
        startState: 'ANY',                     // start state name
        postprocess: pruneTree,                // postprocessing function
        ANY: {                                 // at start & after special
            DEFAULT: joinToken,
            '"': 'QUOTED',
            '(': startParenthesis,
            ')': endParenthesis,
            '-': startNegation,
        },
        SPECIAL_OR_ALPHA: {                    // after space
            DEFAULT: joinToken,
            '"': 'QUOTED',
            '(': startParenthesis,
            ')': endParenthesis,
            '-': startNegation,
        },
        SPECIAL_OR_SPACE: {                    // after word
            DEFAULT: joinToken,
            //'-': joinToken,                  //   handled by 'DEFAULT'
            '"': 'QUOTED',
            '(': startParenthesis,
            ')': endParenthesis,
        },
        NEGATED: {
            DEFAULT: joinToken,
            '"': 'NEGATED_QUOTED',
            '(': startNegatedParenthesis,
        },
        ///////////////////////////////////////////////////////////////////////////////
        // THESE ARE DONE
        QUOTED: {                              // quoted strings
            DEFAULT: addQuotedToken,
            '"': 'ANY',
        },
        NEGATED_QUOTED: {                              // quoted strings
            DEFAULT: addQuotedToken,
            '"': 'NEGATED',
        },
    };
    function startNegation(tree) {
        if (tree.last() === '') {
            tree.pop();
        }
        tree.add();
        tree.set('_', 'not');
        return 'NEGATED';
    }
    function startNegatedParenthesis(tree) {
        tree.add();
        return 'ANY';
    }
    function startParenthesis(tree) {
        if (tree.last() === '') {
            tree.pop();
        }
        if (tree._node()._ === 'not') {    //   terminate negation
            tree.leave();
        }
        tree.add();
        return 'ANY';
    }
    function endParenthesis(tree) {
        if (tree.last() === '') {
            tree.pop();
        }
        tree.leave();
        return 'ANY';
    }
    function joinToken(tree, token, xtra) {
        //output('jointoken', token, xtra);
        if (/^\s+$/.test(token)) {             // unquoted space
            if (tree._node()._ === 'not') {    //   terminate negation
                tree.leave();
            }
            if (!xtra.last) {
                tree.push('');
            }
            return 'SPECIAL_OR_ALPHA';
        };
        if (/^[":{}(),*]$/.test(token)) {
            throw Error(
                "SPECIALS NOT YET IMPLEMENTED IN '" + xtra.state +
                    "' MODE (for token >" + token + "<)");
        }
        if (xtra.state !== 'SPECIAL_OR_SPACE' && /^-$/.test(token)) {
            throw Error(
                "'-' NOT YET IMPLEMENTED IN '" + xtra.state +
                    "' MODE (for token >" + token + "<)");
        }
        tree.join(token);
        return 'SPECIAL_OR_SPACE';
    }
    function addToken(tree, token, xtra) {
        if (/^[":{}(),*-]$/.test(token)) {
            throw Error(
                "SPECIALS NOT YET IMPLEMENTED IN '" + xtra.state +
                    "' MODE (for token >" + token + "<)");
        }
        tree.push(token);
        return 'SPECIAL_OR_SPACE';
    }
    function addQuotedToken(tree, token) {
        tree.join(token);
    }

    is(parse(['abc'], Tree(), parser),             ['abc'],
       'one simple word');
    is(parse(['abc', ' ', 'def'], Tree(), parser), ['abc', 'def'],
       'simple word after word');
    is(parse([' ', 'a', ' '], Tree(), parser),     ['a'],
       'ignore leading/ending space');
    //tests("Quotes", () => {
        is(parse(['"', 'b', ' ', 'c', '"'], Tree(), parser),
           ['b c'], 'quoted words at beginning/end of string');
        is(parse(['a', ' ', '"', 'b', ' ', 'c', '"', ' ', 'd'], Tree(), parser),
           ['a', 'b c', 'd'], 'quoted words surrounded by space');
        is(parse(['a', '"', 'b', ' ', 'c', '"', 'd'], Tree(), parser),
           ['ab cd'], 'quoted part of word');
        is(parse(['"', ':', '{', '}', '(', ')', ',', '*', '-', '"', ' ', 'A'], Tree(), parser),
           [':{}(),*-', 'A'], 'quoted specials');
        is(parse(['"', ' ', 'a', ' ', '"'], Tree(), parser),
           [' a '], 'preserve leading/ending space in quotes');
    //});
    //tests("Parentheses", () => {
        // unbalanced leading parenthesis
        is(parse(['(', 'a'], Tree(), parser),                [['a']],
           'unbalanced leading parenthesis after special/at start');
        is(parse([' ', '(', 'a'], Tree(), parser),           [['a']],
           'unbalanced leading parenthesis after space');
        is(parse(['a', '(', 'b'], Tree(), parser),           ['a', ['b']],
           'unbalanced leading parenthesis after word');
        // trailing paranthesis in balanced gloup
        is(parse(['(', 'a', ')'], Tree(), parser),           [['a']],
           'trailing parenthesis after word in balanced group');
        is(parse(['(', '(', 'a', ')', ')'], Tree(), parser), [[['a']]],
           'trailing parenthesis after special in balanced group');
        is(parse(['(', 'a', ' ', ')'], Tree(), parser),      [['a']],
           'trailing parenthesis after space in balanced group');
        // unbalanced trailing paranthesis
        is(parse(['a', ')'], Tree(), parser),                ['a'],
           'unbalanced trailing parenthesis after word');
        is(parse(['a', ')', ')'], Tree(), parser),           ['a'],
           'unbalanced trailing parenthesis after special');
        is(parse(['a', ' ', ')'], Tree(), parser),           ['a'],
           'unbalanced trailing parenthesis after space');
        is(parse(['('], Tree(), parser),                     [],
           'one unbalanced leading parenthesis');
        is(parse(['(', 'a'], Tree(), parser),                [['a']],
           'one unbalanced leading parenthesis with word after');
        is(parse(['(', '('], Tree(), parser),                [],
           'two unbalanced leading parenthesis');
        is(parse(['(', '(', 'a'], Tree(), parser),           [[['a']]],
           'two unbalanced leading parenthesis with word after');
        is(parse(['(', '(', '('], Tree(), parser),           [],
           'three unbalanced leading parenthesis');
        is(parse(['(', '(', '(', 'a'], Tree(), parser),      [[[['a']]]],
           'three unbalanced leading parenthesis with word after');
        is(parse(['(', '(', '(', ' '], Tree(), parser),       [],
           'three unbalanced leading parenthesis with space space');
    //});
    //tests("Negative search", () => {
        is(parse(['a', '-', 'b'], Tree(), parser),                          ['a-b'],
           'minus sign inside word: a-b');
        is(parse(['"', '-', 'a', '"'], Tree(), parser),                     ['-a'],
           'minus sign in quotes: "-a"');
        is(parse(['-', 'a', ' ', 'b'], Tree(), parser),                     [not('a'), 'b'],
           'negated expression: -a b');
        is(parse(['-', '"', 'a', ' ', 'b', '"', ' ', 'c'], Tree(), parser), [not('a b'), 'c'],
           'negated quoted expression: -"a b" c');
        is(parse([' ', '-', 'a', ' ', 'b'], Tree(), parser),                [not('a'), 'b'],
           'negated expression after space');
        is(parse(['(', 'a', ')', '-', 'b', ' ', 'c'], Tree(), parser),      [['a'], not('b'), 'c'],
           'negated expression after special');
        is(parse(['a', ' ', '-', 'b', '(', 'c', ')'], Tree(), parser),      ['a', not('b'), ['c']],
           'negated expression followed by special');
        is(parse(['(', '-', 'a', ')'], Tree(), parser),                     [[not('a')]],
           'negated expression inside parenthesis');
        is(parse(['-', '(', 'a', ')', ' ', 'b'], Tree(), parser),           [not(['a']), 'b'],
           'negated parenthesis followed by space: -(a) b');
        // is(parse(['-', '(', 'a', ')', 'b'], Tree(), parser),                [not(['a']), 'b'],
        //    'negated parenthesis followed by alpha: -(a)b');

    // FIXME: negated expressions should allow subqueries
    // FIXME: this means that tree.leave() need to restore 'NEGATION' state if
    // going into a negated query.
    // FIXME: ending parentheses in '-(a)b' should exit negation

    // FIXME: merge ANY and 'after word' states? The only diff SHOULD be that
    // 'after word' handles spaces especially, which wouldn't HARM the 'ANY'
    // state -- this doesn't work since '-' after word act as itself, while
    // after space or special it acts as negation

    //});

    //ok(false, 'IGNORE THIS FAKE TEST');
});

/*[eof]*/

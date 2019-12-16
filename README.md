# sloppy-query

Query parser for sloppy search queries. – *Sloppy* in this context means that
the parser will silently do the best it can out of queries with incomplete
parentheses, quotes or similar.

This parses advanced user queries are parsed into a tree structure which can
then be used to search data for a matching result. Queries may contain any kind
of complex structure such as support for logical NOT, AND and OR and parentheses
to indicate operator ordering. Exactly what the syntax look like is defined by
your own parser rules.

## `tokenize()`

Splits the incoming query string into tokens.

## `Tree()`

Small module for building tree structures (using lists of lists) which may then
be used by the parsing rules to build a tree representation of the query.

## `parse()`

A function which processes a set of tokens using your parsing rules, and returns
a tree with the query in machine-executable form.

## And a Set of Parsing Rules

The parsing rules is a set of callbacks used by the parser. The rules themselves
may use any kind of additional logic during the tree building phase.

<!--[eof]-->

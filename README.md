# Did I forget ...?

A small utility to find files highly coupled to the changes in your branch based on git history.
Helps to double-check if you forgot to update something related to the files you worked on.

## Installation

```
$ yarn global add did-i-forget
```

## Usage

```
$ did-i-forget -c
```

## Example output

```
❯ did-i-forget -c -n 3
Getting changed paths... Done.
2 files changed against the origin/master
Is cache valid? Yes!
Processed 401 commits.
Generating report... Enjoy!

  ┌────────────────────┬──────────────────────────────────────────┬────────────────┬────────────┐
  │    Changed file    │               Coupled file               │ Shared commits │ Confidence │
  ├────────────────────┼──────────────────────────────────────────┼────────────────┼────────────┤
  │ src/diagnostics.rs │ src/language_features/cquery.rs          │             13 │       0.72 │
  ├────────────────────┼──────────────────────────────────────────┼────────────────┼────────────┤
  │ src/diagnostics.rs │ src/language_features/document_symbol.rs │              7 │        0.7 │
  ├────────────────────┼──────────────────────────────────────────┼────────────────┼────────────┤
  │ src/diagnostics.rs │ src/language_features/signature_help.rs  │              6 │       0.67 │
  └────────────────────┴──────────────────────────────────────────┴────────────────┴────────────┘
```
In this example `did-i-forget` tells me that I worked on `src/diagnostics.rs` and I might want to look into `src/language_features/cquery.rs` as the former was changed in 72% of commits which addressed `src/language_features/cquery.rs` in the past.

## Options

### Threshold

`-t 0.5`, `--threshold 0.5`

Set a minimum confidence for a coupled file to be reported.

### Top N

`-n 1`, `--ntop 1`

How many top coupled files to show for each changed file.

### Cache

#### Enable git log caching

`-c`, `--cache`

Cache is stamped by a master revision head SHA reference and is invalidated when it changes.
You really want to use it for repeated runs in large repositories as difference can reach orders of magnitude.

#### Custom cache path

`--cache-file .did-i-forget-cache`

### Output format

`-f table`, `--format table`

Print result as a nicely layed out `table` or just a raw `csv`.

### Master revision

`-m origin/master`, `--master origin/master`

Specify a revision (usually a branch) to diff current state against to find out changed files.

### Quiet mode

`-q`, `--quiet`

Don't output progress information, only print result.
Note that logging goes into stderr and result into stdout so you still can pipe result when logging enabled.

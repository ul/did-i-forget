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
❯ did-i-forget -c
Getting changed paths... Done.
2 files changed against the origin/master
Is cache valid? Yes!
Processed 401 commits.
Generating report... Enjoy!

  ┌──────────────────┬───────────────────┬────────────────┬────────────┐
  │   Changed file   │ Top coupled file  │ Shared commits │ Confidence │
  ├──────────────────┼───────────────────┼────────────────┼────────────┤
  │ src/text_sync.rs │ src/controller.rs │       12       │    0.86    │
  └──────────────────┴───────────────────┴────────────────┴────────────┘
```

In this example `did-i-forget` tells me that I worked on `src/text_sync.rs` and I might want to look into `src/controller.rs` as the latter was changed in 86% of commits which addressed `src/text_sync.rs` in the past. Just in case `src/controller.rs` need to be updated as well.


## Options

### Threshold

`-t 0.5`, `--threshold 0.5`

Set a minimum confidence for a coupled file to be reported.

### Cache

#### Enable git log caching

`-c`, `--cache`

Cache is stamped by a master branch head SHA reference and is invalidated when it changes.
You really want to use it for repeated runs in large repositories as difference can reach orders of magnitude.

#### Custom cache path

`--cache-file .did-i-forget-cache`

### Output format

`-f table`, `--format table`

Print result as a nicely layed out `table` or just a raw `csv`.

### Master branch

`-m origin/master`, `--master origin/master`

Specify a branch to diff current state against to find out changed files.

### Quiet mode

`-q`, `--quiet`

Don't output progress information, only print result.
Note that logging goes into stderr and result into stdout so you still can pipe result when logging enabled.
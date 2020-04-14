const child_process = require("child_process");
const crypto = require("crypto");
const commander = require("commander");
const fs = require("fs");
const os = require("os");
const path = require("path");
const table = require("tty-table");
const zlib = require("zlib");

let QUIET = false;
const LOG = (s) => QUIET || process.stderr.write(s);

async function analyze(options) {
  const changedPaths = getChangedPaths(options);
  const gitLog = await getGitLog(options, changedPaths);
  const analysis = await analyzeCoupling(
    groupPathsByCommit(gitLog),
    changedPaths
  );
  return generateReport(analysis, options);
}

const formatConfidence = (x) => Math.round(x * 100) / 100;

function printTable(result) {
  const header = [
    { value: "Changed file", align: "left" },
    { value: "Coupled file", align: "left" },
    { value: "Shared commits", align: "right" },
    { value: "Confidence", align: "right" },
  ];
  const rows = result.map(
    ({ path, coupledPath, sharedCommits, confidence }) => [
      path,
      coupledPath,
      sharedCommits,
      formatConfidence(confidence),
    ]
  );
  const options = {};
  process.stdout.write(table(header, rows, options).render());
  process.stdout.write("\n");
}

function printCSV(result) {
  process.stdout.write("Changed file,Coupled file,Shared commits,Confidence\n");
  for (const { path, coupledPath, sharedCommits, confidence } of result) {
    process.stdout.write(
      `${path},${coupledPath},${sharedCommits},${formatConfidence(
        confidence
      )}\n`
    );
  }
}

/** Generate CSV report with top untouched coupled files above threshold.
 */
function generateReport({ commitCount, frequencies }, { threshold, ntop }) {
  LOG("Generating report...");
  const result = [];
  for (const [path, coupled] of Object.entries(frequencies)) {
    Object.entries(coupled)
      .map(([coupledPath, sharedCommits]) => [
        coupledPath,
        sharedCommits,
        sharedCommits / commitCount[coupledPath],
      ])
      // [2] is confidence
      .filter((x) => x[2] >= threshold)
      .sort((a, b) => b[2] - a[2])
      .slice(0, ntop)
      .forEach(([coupledPath, sharedCommits, confidence]) =>
        result.push({ path, coupledPath, sharedCommits, confidence })
      );
  }
  LOG(" Enjoy!\n");
  return result;
}

/** Stream of paths changed in the same commit.
 *
 * PEG:
 *
 * output <- (commit '\n')*
 * commit <- '\n' (path '\n')*
 * path <- [^\n]+
 */
async function getGitLog(options, changedPaths) {
  if (!options.cache) {
    return getLogFromGit(options, changedPaths);
  }
  LOG("Is cache valid?");
  const masterHash = getMasterHash(options);
  if (fs.existsSync(options.cacheFile)) {
    const f = await splitLines(
      fs.createReadStream(options.cacheFile).pipe(zlib.createGunzip())
    );
    const cacheHash = (await f.next()).value;
    if (cacheHash === masterHash) {
      LOG(" Yes!\n");
      return f;
    }
  }
  LOG(" Nope.\n");
  return withCache(
    getLogFromGit(options, changedPaths),
    options.cacheFile,
    masterHash
  );
}

function getChangedPaths({ master }) {
  LOG("Getting changed paths...");
  const masterDiff = child_process
    .spawnSync("git", ["diff", "--name-only", "--no-renames", `${master}...`], {
      encoding: "utf8",
    })
    .stdout.split("\n");
  const uncommittedDiff = child_process
    .spawnSync("git", ["diff", "--name-only", "--no-renames", "HEAD"], {
      encoding: "utf8",
    })
    .stdout.split("\n");
  const result = masterDiff.concat(uncommittedDiff).filter((x) => x.length > 0);
  LOG(` Done.\n`);
  LOG(`${result.length} files changed against the ${master}\n`);
  return result;
}

async function* getLogFromGit({ master }, changedPaths) {
  const lines = splitLines(
    spawnOut("git", [
      "log",
      "--all",
      "--name-only",
      "--pretty=format:",
      "--no-renames",
      "--no-merges",
      master,
    ])
  );
  const fsCache = {};
  // Even if some files in changedPaths are deleted in the current changeset,
  // we still want to treat them as existing in the log.
  for (const path of changedPaths) {
    fsCache[path] = true;
  }
  const fileExists = (path) => {
    if (!fsCache.hasOwnProperty(path)) {
      fsCache[path] = fs.existsSync(path);
    }
    return fsCache[path];
  };
  for await (const line of lines) {
    if (line.length === 0 || fileExists(line)) {
      yield line;
    }
  }
}

function getMasterHash({ master }) {
  return child_process
    .spawnSync("git", ["rev-parse", master], { encoding: "utf8" })
    .stdout.trim();
}

async function* groupPathsByCommit(lines) {
  let paths = [];
  for await (const line of lines) {
    if (line.length > 0) {
      paths.push(line);
    } else if (paths.length > 0) {
      yield paths;
      paths = [];
    }
  }
}

async function* withCache(lines, cacheFile, key) {
  // This is not secure (ref. https://en.wikipedia.org/wiki/Symlink_race)
  // but good enough for our purposes.
  const tmpCacheFile = path.join(
    os.tmpdir(),
    `did-i-forget-cache-${crypto.randomBytes(8).toString("hex")}`
  );
  const f = fs.createWriteStream(tmpCacheFile);
  let cacheFailed = false;
  f.on("error", () => {
    cacheFailed = true;
  });
  f.on("close", () =>
    cacheFailed
      ? fs.unlinkSync(tmpCacheFile)
      : fs.renameSync(tmpCacheFile, cacheFile)
  );
  const cache = zlib.createGzip();
  cache.pipe(f);
  cache.write(key);
  cache.write("\n");
  for await (const line of lines) {
    cache.write(line);
    cache.write("\n");
    yield line;
  }
  cache.end();
}

async function* splitLines(chunks, maxBuffer = 1024) {
  const NEWLINE = "\n".charCodeAt(0);
  const line = Buffer.alloc(maxBuffer);
  let end = 0;
  for await (const chunk of chunks) {
    for (const byte of chunk) {
      if (byte === NEWLINE) {
        yield line.slice(0, end).toString();
        end = 0;
      } else {
        line[end] = byte;
        end += 1;
      }
    }
  }
}

function partition(xs, p) {
  const t = [];
  const f = [];
  for (const x of xs) {
    (p(x) ? t : f).push(x);
  }
  return [t, f];
}

async function analyzeCoupling(commits, changedPaths) {
  const commitCount = {};
  const frequencies = {};
  for (const p of changedPaths) {
    frequencies[p] = {};
  }
  const changedPathsSet = new Set(changedPaths);
  let progress = 0;
  for await (const paths of commits) {
    const [changedPathsInCommit, unchangedPaths] = partition(paths, (p) =>
      changedPathsSet.has(p)
    );
    for (const path of paths) {
      commitCount[path] = (commitCount[path] || 0) + 1;
    }
    for (const changedPath of changedPathsInCommit) {
      for (const unchangedPath of unchangedPaths) {
        frequencies[changedPath][unchangedPath] =
          (frequencies[changedPath][unchangedPath] || 0) + 1;
      }
    }
    progress += 1;
    if (progress < 1000 || progress % 1000 === 0) {
      LOG(`\rProcessed ${progress} commits...`);
    }
  }
  LOG(`\rProcessed ${progress} commits.  \n`);
  return { commitCount, frequencies };
}

async function* spawnOut(cmd, args = [], options = {}) {
  for await (const chunk of child_process.spawn(cmd, args, {
    ...options,
    stdio: ["ignore", "pipe", "ignore"],
  }).stdout) {
    yield chunk;
  }
}

module.exports = {
  analyze,
  printCSV,
  printTable,
  QUIET,
};

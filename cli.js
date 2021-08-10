#!/usr/bin/env node

const engine = require("./index");
const commander = require("commander");

async function main() {
  const program = new commander.Command();
  program
    .option("-t, --threshold <0..1>", "minimum confidence to report", 0.5)
    .option("-n, --ntop <N>", "show top N coupled files", 1)
    .option("-c, --cache", "cache commit log")
    .option("--cache-file <path>", "path to cache", ".did-i-forget-cache")
    .option("-f, --format <table|csv>", "output format", "table")
    .option("-m, --master <branch>", "analyze against branch", "origin/master")
    .option("-q, --quiet", "reduce logging");
  program.parse(process.argv);
  const options = program.opts();
  engine.QUIET = options.quiet;

  const result = await engine.analyze(options);

  if (options.format === "csv") {
    engine.printCSV(result);
  } else {
    engine.printTable(result);
  }
}

main().catch(console.error);

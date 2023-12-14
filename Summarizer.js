const fs = require("fs");

const DbFilePath = "./DB.json";
const OutputValueDb = "./SummaryVals.json";
const OutputDb = "./Summary.json";

const db = JSON.parse(fs.readFileSync(DbFilePath));

const allowedExtensions = [
  "c",
  "cpp",
  "h",
  "hpp",
  "cc",
  "cxx",
  "hh",
  "inl",
  "ipp",
  "java",
  "py",
  "pyc",
  "pyd",
  "pyo",
  "pyw",
  "pyx",
  "pyi",
  "pyz",
  "js",
  "jsx",
  "mjs",
  "html",
  "htm",
  "xhtml",
  "css",
  "scss",
  "less",
  "sass",
  "rb",
  "ru",
  "rhtml",
  "swift",
  "php",
  "php3",
  "php4",
  "php5",
  "php7",
  "phtml",
  "pl",
  "pm",
  "t",
  "pod",
  "cgi",
  "sh",
  "bash",
  "zsh",
  "fish",
  "go",
  "r",
  "R",
  "Rmd",
  "Rnw",
  "Rhistory",
  "Rprofile",
  "kt",
  "kts",
  "ts",
  "scala",
  "sbt",
  "rs",
  "dart",
  "lua",
  "sql",
  "ddl",
  "dml",
  "asm",
  "s",
  "hs",
  "lhs",
  "groovy",
  "m",
  "fs",
  "fsx",
  "fsi",
  "bat",
  "cmd",
  "yaml",
  "yml",
  "json",
  "xml",
  "xsd",
  "xsl",
  "dts",
  "dockerfile",
  "md",
  "markdown",
  "clj",
  "cljs",
  "cljc",
  "edn",
  "ex",
  "exs",
  "erl",
  "coffee",
  "cr",
  "jl",
  "mm",
  "vhd",
  "vhdl",
  "v",
  "ps1",
  "psm1",
  "psd1",
  "rkt",
  "re",
  "ml",
  "mli",
  "zig",
  "kscript",
  "tf",
  "tfvars",
  "tfstate",
  "hx",
  "pp",
  "e",
  "f",
  "for",
  "f90",
  "f95",
  "f03",
  "f08",
  "cls",
  "graphql",
  "gql",
  "vi",
  "ctl",
  "lvclass",
  "pl",
  "pro",
  "makefile",
  "cbl",
  "cob",
  "toml",
  "scm",
  "hack",
  "cfm",
  "cfc",
  "cfs",
  "nim",
  "nimble",
  "gsp",
  "dm",
  "robot",
  "ebnf",
  "rei",
  "idl",
  "sol",
];

keysFilter = allowedExtensions.map((key) => db[key]).filter((x) => x);

const objMerge = (oldDb, newDb) => {
  Object.keys(newDb).forEach((key) => {
    const newVal = newDb[key];
    const curVal = oldDb[key];
    oldDb[key] = curVal ? curVal + newVal : newVal;
  });
  return oldDb;
};

outDb = keysFilter.reduce(objMerge, {});

function sortObjectKeys(obj) {
  const sortedKeys = Object.keys(obj).sort();
  const sortedObject = Object.fromEntries(
    sortedKeys.map((key) => [key, obj[key]])
  );
  return sortedObject;
}

function sortObjectByNumericValue(obj) {
  const sortedKeys = Object.keys(obj).sort((a, b) => obj[b] - obj[a]);
  const sortedObject = Object.fromEntries(
    sortedKeys.map((key) => [key, obj[key]])
  );
  return sortedObject;
}

outDb = sortObjectKeys(outDb);
outDb2 = sortObjectByNumericValue(outDb);

fs.writeFileSync(OutputDb, JSON.stringify(outDb, null, 2));
fs.writeFileSync(OutputValueDb, JSON.stringify(outDb2, null, 2));

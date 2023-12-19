const fs = require("fs");

const DbFilePath = "./DB.json";
const OutputValueDb = "./SummaryVals.json";
const OutputFullDb = "./Summary.json";
const OutputMiniDb = "./SummaryMini.json";
const OutputStatsTxt = "./SummaryStats.txt";

const db = JSON.parse(fs.readFileSync(DbFilePath));

const summarizeDb = (inpDb) => {
  const returnDb = {};
  Object.keys(inpDb).forEach((ext) => {
    const newVal = inpDb[ext];
    Object.keys(newVal).forEach((char) => {
      if (!returnDb[char]) {
        returnDb[char] = { "-3": {}, "-2": {}, "-1": {}, 0: {} };
      }
      const extCharVal = newVal[char];
      Object.keys(extCharVal).forEach((dist) => {
        const extCharDistVal = extCharVal[dist];
        Object.keys(extCharDistVal).forEach((char_2) => {
          const newExtCharDistCharVal = extCharDistVal[char_2];
          const curVal = returnDb[char][dist][char_2];
          returnDb[char][dist][char_2] = curVal
            ? curVal + newExtCharDistCharVal
            : newExtCharDistCharVal;
        });
      });
    });
  });
  return returnDb;
};

const groupKeys = (keys) => {
  const shiftedChars = {
    "!": "1",
    "@": "2",
    "#": "3",
    $: "4",
    "%": "5",
    "^": "6",
    "&": "7",
    "*": "8",
    "(": "9",
    ")": "0",
    _: "-",
    "+": "=",
    "{": "[",
    "}": "]",
    "|": "\\",
    ":": ";",
    '"': "'",
    "<": ",",
    ">": ".",
    "?": "/",
    "~": "`",
  };

  const groupedKeys = {};

  keys.forEach((key) => {
    const normalizedKey = key.toLowerCase();
    const baseKey = shiftedChars[normalizedKey] || normalizedKey;

    if (!groupedKeys[baseKey]) {
      groupedKeys[baseKey] = [key];
    } else {
      groupedKeys[baseKey].push(key);
    }
  });

  return groupedKeys;
};

// NOTE: Some big issue with the sorting, since numbers are not valid JS idents they move to top
const calcDbStats = (obj) => {
  const totalChars = Object.keys(obj).reduce((acc, v) => acc + obj[v], 0);
  console.log(`Total Chars Witnesses: ${totalChars}\n`);
  const filterUnprintables = Object.keys(obj).filter((key) => {
    const jsonStrRep = JSON.stringify(key);
    if (
      jsonStrRep.includes("\\u") ||
      jsonStrRep.includes("\\r") ||
      jsonStrRep.includes("\\b") ||
      jsonStrRep.includes("\\f") ||
      jsonStrRep.includes("")
    ) {
      console.log("FILTERED: ", jsonStrRep);
      return false;
    }
    return true;
  });
  const groupedKeys = groupKeys(filterUnprintables);
  // Get output
  const groupedPrintableKeys = Object.keys(groupedKeys).map((a) => {
    let aVal = 0;
    groupedKeys[a].forEach((val) => {
      aVal += obj[val];
    });
    return [a, aVal];
  });
  const numPrintableChars = filterUnprintables.reduce(
    (acc, v) => acc + obj[v],
    0
  );
  console.log(`Printable Chars Witnesses: ${numPrintableChars}\n`);
  let retStr = "";
  groupedPrintableKeys
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => {
      retStr +=
        // `Key: '${key}', Freq: ${obj[key] / totalChars}` + "\n";
        JSON.stringify(`Key: '${k}', Freq: ${v / numPrintableChars}`) + "\n";
    });
  return retStr;
};

const minifyDb = (inpDb) => {
  const newDb = {};
  Object.keys(inpDb).forEach((char) => {
    newDb[char] = inpDb[char]["0"][char];
  });
  return newDb;
};

const fullDb = summarizeDb(db);

const minifiedDb = minifyDb(fullDb);

fs.writeFileSync(OutputFullDb, JSON.stringify(fullDb, null, 2));
fs.writeFileSync(OutputMiniDb, JSON.stringify(minifiedDb, null, 2));
fs.writeFileSync(OutputStatsTxt, calcDbStats(minifiedDb));

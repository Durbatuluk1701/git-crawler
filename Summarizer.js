const fs = require("fs");

const DbFilePath = "./DB.json";
const OutputValueDb = "./SummaryVals.json";
const OutputFullDb = "./Summary.json";
const OutputMiniDb = "./SummaryMini.json";
const OutputStatsDb = "./SummaryStats.json";

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

// NOTE: Some big issue with the sorting, since numbers are not valid JS idents they move to top
const calcDbStats = (obj) => {
  const totalChars = Object.keys(obj).reduce((acc, v) => acc + obj[v], 0);
  console.log(`Total Chars Witnesses: ${totalChars}\n`);
  const retDb = {};
  Object.keys(obj)
    .sort((a, b) => obj[b] - obj[a])
    .map((key) => {
      retDb[key] = obj[key] / totalChars;
    });
  return retDb;
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

const dbStats = calcDbStats(minifiedDb);

fs.writeFileSync(OutputFullDb, JSON.stringify(fullDb, null, 2));
fs.writeFileSync(OutputMiniDb, JSON.stringify(minifiedDb, null, 2));
fs.writeFileSync(OutputStatsDb, JSON.stringify(dbStats, null, 2));

const fs = require("fs");

const DbFilePath = "./DB.json";
const OutputValueDb = "./SummaryVals.json";
const OutputFullDb = "./Summary.json";
const OutputFullGroupedDb = "./SummaryGrouped.json";
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
  const groupedKeys = {};

  keys.forEach((key) => {
    const normalizedKey = key.toLowerCase();
    if (!groupedKeys[normalizedKey]) {
      groupedKeys[normalizedKey] = [key];
    } else {
      groupedKeys[normalizedKey].push(key);
    }
  });

  return groupedKeys;
};

// NOTE: Some big issue with the sorting, since numbers are not valid JS idents they move to top
const calcDbStats = (obj, debug = true) => {
  const totalChars = Object.keys(obj).reduce((acc, v) => acc + obj[v], 0);
  debug && console.log(`Total Chars Witnesses: ${totalChars}\n`);
  const filterUnprintables = Object.keys(obj).filter((key) => {
    const jsonStrRep = JSON.stringify(key);
    if (
      jsonStrRep.includes("\\u") ||
      jsonStrRep.includes("\\r") ||
      jsonStrRep.includes("\\b") ||
      jsonStrRep.includes("\\f") ||
      jsonStrRep.includes("")
    ) {
      debug && console.log("FILTERED: ", jsonStrRep);
      return false;
    }
    return true;
  });
  const groupedKeys = groupKeys(filterUnprintables);
  // Get output
  const groupedPrintableKeys = {};
  Object.keys(groupedKeys).forEach((a) => {
    let aVal = 0;
    groupedKeys[a].forEach((val) => {
      aVal += obj[val];
    });
    groupedPrintableKeys[a] = aVal;
  });
  const numPrintableChars = filterUnprintables.reduce(
    (acc, v) => acc + obj[v],
    0
  );
  debug && console.log(`Printable Chars Witnesses: ${numPrintableChars}\n`);
  const retDb = {};
  Object.entries(groupedPrintableKeys)
    .sort(([ak, av], [bk, bv]) => bv - av)
    .forEach(([k, v]) => {
      retDb[k] = v / numPrintableChars;
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

const statDbToPrint = (db) => {
  let retStr = "";
  Object.entries(db)
    .sort(([ak, av], [bk, bv]) => bv - av)
    .forEach(([k, v]) => {
      const strVal = JSON.stringify(`Key: '${k}', Freq: ${v}`);
      retStr += strVal.slice(1) + "\n";
    });
  return retStr;
};

const fullDb = summarizeDb(db);

const mergeObjects = (obj1, obj2) => {
  const result = { ...obj1 };

  for (const key in obj2) {
    if (result.hasOwnProperty(key)) {
      result[key] += obj2[key];
    } else {
      result[key] = obj2[key];
    }
  }

  return result;
};

const fullDbMerge = (obj) => {
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
  console.log("GK", groupedKeys);
  const retDb = {};
  Object.keys(groupedKeys).forEach((key) => {
    const subDbList = groupedKeys[key];
    console.log(subDbList);
    retDb[key] = { "-3": {}, "-2": {}, "-1": {}, 0: {} };
    subDbList.forEach((subDbKey) => {
      // Clean the sub-db for each length
      ["-3", "-2", "-1", "0"].forEach((dist) => {
        retDb[key][dist] = mergeObjects(retDb[key][dist], obj[subDbKey][dist]);
      });
    });
    ["-3", "-2", "-1", "0"].forEach((dist) => {
      retDb[key][dist] = calcDbStats(retDb[key][dist], false);
    });
  });
  return retDb;
};

const minifiedDb = minifyDb(fullDb);

fs.writeFileSync(OutputFullDb, JSON.stringify(fullDb, null, 2));
fs.writeFileSync(OutputMiniDb, JSON.stringify(minifiedDb, null, 2));
fs.writeFileSync(OutputStatsTxt, statDbToPrint(calcDbStats(minifiedDb)));

fs.writeFileSync(
  OutputFullGroupedDb,
  JSON.stringify(fullDbMerge(fullDb), null, 2)
);

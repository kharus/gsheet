function onChange(e) {
  let sheet = SpreadsheetApp.getActiveSheet();
  if (e.changeType=="INSERT_ROW") {
    testWait();
    sheet.getRange(1, 4).setValue("row inserted");
    scanDocIF(sheet);
    sheet.getRange(1, 5).setValue("insert complete");
  }
  else if (e.changeType=="REMOVE_ROW") {
    testWait();
    sheet.getRange(1, 4).setValue("row deleted");
    scanDocIF(sheet);
    sheet.getRange(1, 5).setValue("delete complete");
  }
  else if (e.changeType=="EDIT") {
    sheet.getRange(1, 4).setValue("cell edited");
    sheet.getRange(1, 5).setValue("");
  }
}
function testWait(){
  var lock = LockService.getScriptLock();
  lock.waitLock(3000);
  SpreadsheetApp.flush();
  lock.releaseLock();
}
function scanDocIF(sheet) {
  // If IF detected in a row,
  // check next row for IF and act accordingly
  let c;
  let h = new History();
  let totalRows = 100;
  let totalCols = 3
  let startWord = getNext1 = getNext2 = "";
  for(let i=3; i<=totalRows; i++) {
    for(let j=2; j<=totalCols; j++) {
      c = sheet.getRange(i, j);
      startWord = c.getValue();
      if (startWord=="IF") {
        getNext1 = sheet.getRange(i+1, j).getValue();
        getNext2 = sheet.getRange(i+1, j+1).getValue();
        if (getNext1=="" && getNext2!="IF") {
          sheet.getRange(i, j+1).setValue("");
        }
        else if (getNext1=="" && getNext2=="IF") {
          c = startProcessing(c, h, sheet);
        }
      }
    }
  }
}
function onEdit(e) {
  // Respond to Edit events on spreadsheet.
  let c = e.range;
  let sheet = SpreadsheetApp.getActiveSheet();
  let h = new History();
  if (goodLayout(c) && !c.isBlank()) {
    drawWords(c);
    c = startProcessing(c, h, sheet);
  }
  else if (c.isBlank()) {
    if (e.oldValue=="IF" || e.oldValue=="WHEN"
      || e.oldValue=="IS" || e.oldValue=="MEANS") {
      c.offset(-1,0).clear();
    }
  }
}
function startProcessing(c, h, sheet) {
  let startCell = findStart(c);
  sheet.getRange(1, 1).setValue(startCell.getValue());
  [c, h] = scanDownwards(startCell, h);
  sheet.getRange(1, 2).setValue(c.getA1Notation());
  // Draw bridge only after scanDownwards
  // because h.history required for drawing
  drawBridgeIfAndOr(h, sheet);
  processHistory(h, sheet);
  sheet.getRange(1, 3).setValue(h.history.toString());
  return c;
}
class History {
  constructor(history = []) {
    this.history = history;
  }
}
function findStart(c) {
  // Find the topLeft start of a block of keywords.
  let nextCol = 0;
  let maxCount = 5;
  while (nextCol < maxCount) {
    let getTopRight = c.offset(-1, nextCol);
    let gtr = getTopRight.getValue();
    if (isKeyword(gtr)) {
      c = getTopRight;
      return findStart(c);
    }
    nextCol++;
  }
  if (nextCol == maxCount) {
    let getTopLeft = c.offset(-1, -1);
    let gtl = getTopLeft.getValue();
    if (isKeyword(gtl)) {
      c = getTopLeft;
      return findStart(c);
    }
  }
  return c;
}
function scanDownwards(c, h) {
  // Scan downwards for keywords and
  // put keywords into h.history Array.
  let predValue = c.offset(0,1).getValue();
  if (isKeyword(c.getValue())) {
    h.history[c.getRowIndex()] =
      [c.getColumnIndex(), c.getValue(), predValue];
  }
  let cellCol = 1;
  let columnLimit = cellCol - c.getColumnIndex();
  do {
    let nextCellBelow = c.offset(1,cellCol);
    let ncb = nextCellBelow.getValue();
    if (isKeyword(ncb)) {
      c = nextCellBelow;
      return scanDownwards(c, h);
    }
    cellCol -= 1;
  } while (cellCol >= columnLimit)
  return [c, h];
}
function drawBridgeIfAndOr(h, sheet) {
  // SpreadsheetApp.getUi().alert("drawBridgeIfAndOr");
  // sheet.getRange(1, 6).setValue("drawBridgeIfAndOr");
  let restart = true;
  let rowBegin = rowStop = numOfRows = 0;
  let buildRange = rangeString = "";
  let columnNow = farCol = 1;
  // Get furthest column.
  for (const element of h.history) {
    if (element != null) {
      farCol = getFurthest(farCol, element[0]);
    }
  }
  columnNow = farCol;
  while (columnNow > 1) {
    // SpreadsheetApp.getUi().alert(columnNow);
    for (const element of h.history) {
      if (element != null) {
        let row = h.history.indexOf(element);
        // SpreadsheetApp.getUi().alert("row = " + row);
        let [col, keyword, predicate] = element;
        // Determine start of code block.
        if (columnNow==col && restart &&
          (keyword=="IF" || keyword=="WHEN"
          || keyword=="MEANS" || keyword=="IS")
          && rowBegin<row) {
          restart = false;
          rowBegin = row;
        }
        // Parse code block in BabyLegalSS and 
        // draw bridge.
        // This code section here also redraws AND
        // and adjusts formatting around buildRange
        // which includes IF, WHEN, MEANS and IS.
        if (columnNow==col && !restart) {
          rowStop = getFurthest(rowStop, row);
          numOfRows = rowStop - rowBegin + 1;
          buildRange = sheet.getRange(rowBegin,
            columnNow, numOfRows, 1);
          // rangeString = buildRange.getA1Notation();
          // SpreadsheetApp.getUi().alert(
          //   rangeString + ", " + keyword);
          if (keyword=="OR") {
            // SpreadsheetApp.getUi().alert(keyword);
            buildRange.setBorder(false,false,false,true,false,false,
              "grey",SpreadsheetApp.BorderStyle.SOLID_THICK);
          }
          else if (keyword=="AND") {
            // SpreadsheetApp.getUi().alert(
            //   keyword + ", " + row + ", " + col);
            sheet.getRange(row, col).offset(0,1,1,2)
              .setBorder(true,true,false,false,false,false,
              "grey",SpreadsheetApp.BorderStyle.SOLID_THICK);
            buildRange.setBorder(null,false,false,true,false,false,
              "grey",SpreadsheetApp.BorderStyle.SOLID_THICK);
          }
        }
      }
    }
    columnNow--;
    // SpreadsheetApp.getUi().alert(columnNow);
    restart = true;
    rowStop = rowBegin = 0;
  }
}
function processHistory(h, sheet) {
  // Process the h.history Array.
  let restart = true;
  let rowBegin = rowStop = numOfRows = 0;
  let buildRange = rangeString = "";
  let columnNow = farCol = 1;
  // Get furthest column.
  for (const element of h.history) {
    if (element != null) {
      farCol = getFurthest(farCol, element[0]);
    }
  }
  // Convert the keyword
  // "UNLESS" to "AND", and its predicate to
  // NOT predicate.
  for (const element of h.history) {
    if (element != null) {
      if (element[1]=="UNLESS") {
        element[1] = "AND";
        element[2] = !element[2];
      }
    }
  }
  while (columnNow <= farCol) {
    for (const element of h.history) {
      if (element != null) {
        let row = h.history.indexOf(element);
        let [col, keyword, predicate] = element;
        // Determine start of code block.
        if (columnNow==col && restart &&
          (keyword=="IF" || keyword=="WHEN"
          || keyword=="MEANS" || keyword=="IS")
          && rowBegin<row) {
          restart = false;
          rowBegin = row;
        }
        // parse code block and update topLeft equation.
        if (columnNow==col && !restart) {
          rowStop = getFurthest(rowStop, row);
          numOfRows = rowStop - rowBegin + 1;
          buildRange = sheet.getRange(rowBegin,
            columnNow+1, numOfRows, 1);
          rangeString = buildRange.getA1Notation();
          if (keyword=="OR" || keyword=="AND") {
            sheet.getRange(rowBegin-1, columnNow)
              .setValue("=" + keyword.toLowerCase()
              + "(" + rangeString + ")");
          }
          else {
            sheet.getRange(rowBegin-1, columnNow).clear();
          }
        }
      }
    }
    columnNow++;
    restart = true;
    rowStop = 0;
  }
}
function getFurthest(prevIndex, index) {
  if (prevIndex < index) return index;
  else return prevIndex;
}
function isKeyword(cValue){
  return (cValue=="IF" || cValue=="OR"
    || cValue=="AND" || cValue=="WHEN"
    || cValue=="MEANS" || cValue=="IS"
    || cValue=="IT IS"
    || cValue=="EVERY" || cValue=="PARTY"
    || cValue=="HENCE" || cValue=="LEST"
    || cValue=="UNLESS"
    );
}
function goodLayout(c) {
  if (c.getBackground() != "#ffffff") {
    SpreadsheetApp.getUi().alert(
      "ERROR: Background must be white colour");
    return false;
  }
  if (isKeyword(c.getValue())) {
    if (c.getColumnIndex() < 2) {
      SpreadsheetApp.getUi().alert(
        "ERROR: Keywords must be entered from column B onwards");
      return false;
    }
    if (c.getRowIndex() < 3) {
      SpreadsheetApp.getUi().alert(
        "ERROR: Keywords must be entered from row 3 onwards");
      return false;
    }
  }
  return true;
}
function drawWords(c) {
  // Identify keywords for formatting and drawing.
  cValue = c.getValue();
  if (cValue=="IF" || cValue=="WHEN") {
    c = drawIfWhenTop(c);
    if (c != null) {
      drawIfWhenOr(c);
    }
  }
  else if (cValue=="OR") {
    drawIfWhenOr(c);
  }
  else if (cValue=="AND") {
    drawAnd(c);
  }
  else if (cValue=="IS" || cValue=="MEANS") {
    c = drawIfWhenTop(c);
    if (c != null) {
      drawTeeOverIsMeans(c);
    }
  }
  else if (cValue=="IT IS") {
    drawTeeForITIS(c);
  }
  else if (cValue=="EVERY" || cValue=="PARTY") {
    drawPlusUnderEvery(c);
  }
  else if (cValue=="HENCE" || cValue=="LEST") {
    drawHenceLest(c);
  }
  else if (cValue=="UNLESS") {
    drawUnless(c);
  }
}
function drawIfWhenTop(c) {
  // Check cell above for checkbox.  
  // If no checkbox, move cValue down
  // and insert checkbox in original cell.  
  let topCell = c.offset(-1,0);
  if (topCell.getDataValidation()!=null) {
    if (topCell.getDataValidation().getCriteriaType()
      =="CHECKBOX") {
      return c;
    }
    else return null;
  }
  else if (topCell.isBlank()) {
    let cValue = c.getValue();
    c.clear();
    c.insertCheckboxes();
    c.offset(1,0).setValue(cValue);
    return c.offset(1,0);
  }
}
function drawIfWhenOr(c) {
  if (c.getValue()=="OR") {
    c.offset(0,-1,1,9).clearFormat();
  }
  c.setHorizontalAlignment("right");
  if (c.offset(0,1).isBlank()) {
    c.offset(0,1).insertCheckboxes()
      .setBorder(false,true,false,false,false,false,
      "grey",SpreadsheetApp.BorderStyle.SOLID_THICK);
  }
  c.setBorder(null,null,null,true,false,false,
    "grey",SpreadsheetApp.BorderStyle.SOLID_THICK);
  if (c.offset(0,2).isBlank()) {
    c.offset(0,2).setValue("some condition");
  }
}
function drawAnd(c) {
  c.offset(0,-1,1,9).clearFormat();
  c.setHorizontalAlignment("right");
  if (c.offset(0,1).isBlank()) {
    c.offset(0,1).insertCheckboxes()
      .setBorder(null,true,false, false, false,false,
      "grey",SpreadsheetApp.BorderStyle.SOLID_THICK);
  }
  c.offset(0,1,1,2)
    .setBorder(true,true,false,false,false,false,
    "grey",SpreadsheetApp.BorderStyle.SOLID_THICK);
  c.setBorder(null,null,null,true,false,false,
    "grey",SpreadsheetApp.BorderStyle.SOLID_THICK);
  if (c.offset(0,2).isBlank()) {
    c.offset(0,2).setValue("some condition");
  }
}
function drawTeeOverIsMeans(c) {
  c.offset(0,-1,1,9).clearFormat();
  c.offset(-1,1).setValue("a Defined Term");
  c.offset(0,0,1,3)
    .setBorder(true,false,false,false,false,false,
    "grey",SpreadsheetApp.BorderStyle.SOLID_THICK);
  c.offset(0,0,2,1)
    .setBorder(true,false,false,true,false,false,
    "grey",SpreadsheetApp.BorderStyle.SOLID_THICK);
  c.offset(0,0).setValue(cValue).setHorizontalAlignment("right");
  if (c.offset(0,1).isBlank()) {
    c.offset(0,1).insertCheckboxes();
  }
  c.offset(0,2).setValue("a thing");
  c.offset(1,0).setValue("OR").setHorizontalAlignment("right");
  c.offset(1,1).insertCheckboxes();
  c.offset(1,2).setValue("another thing");
}
function drawTeeForITIS(c) {
  let cValue = c.getValue();
  c.offset(0,-1,3,9).clear();
  c.setValue(cValue).setHorizontalAlignment("right");
  c.offset(0,1).insertCheckboxes();
  c.offset(0,2).setValue("a Defined Situation");
  c.offset(1,0,1,5)
    .setBorder(true,false,false,false,false,false,
    "grey",SpreadsheetApp.BorderStyle.SOLID_THICK);
  c.offset(1,1,2,1)
    .setBorder(true,false,false,true,false,false,
    "grey",SpreadsheetApp.BorderStyle.SOLID_THICK);
  c.offset(1,1).setValue("WHEN").setHorizontalAlignment("right");
  c.offset(1,2).insertCheckboxes();
  c.offset(1,3).setValue("something holds");
  c.offset(2,1).setValue("AND").setHorizontalAlignment("right");
  c.offset(2,2).insertCheckboxes();
  c.offset(2,3).setValue("something else holds");
}
function drawPlusUnderEvery(c) {
  let cValue = c.getValue();
  c.offset(0,-1,3,9).clear();
  c.setValue(cValue).setHorizontalAlignment("right");
  if (cValue == "EVERY") { c.offset(0,1).setValue("Entity"); }
  if (cValue == "PARTY") { c.offset(0,1).setValue("P"); }
  c.offset(1,0).setValue("MUST").setHorizontalAlignment("right");
  c.offset(1,1).setValue("BY").setHorizontalAlignment("right");
  c.offset(1,2).setValue("some deadline");
  c.offset(2,0).setValue("➔").setHorizontalAlignment("right");
  c.offset(2,1).setValue("take").setHorizontalAlignment("right");
  c.offset(2,2).setValue("some Action");
  c.offset(0,0,3).setBorder(false,false,false,true,false,false,
  "grey", SpreadsheetApp.BorderStyle.SOLID_THICK);
  c.offset(1,0,1,4).setBorder(false,false,true,false,false,false,
  "grey", SpreadsheetApp.BorderStyle.SOLID_THICK);
  c.offset(1,0).setBorder( false,false,true,true,false,false,
  "grey", SpreadsheetApp.BorderStyle.SOLID_THICK);
}
function drawHenceLest(c) {
  let cValue = c.getValue();
  c.offset(0,-1,1,9).clearFormat();
  c.setValue(cValue).setHorizontalAlignment("right");
  c.offset(0,1,1,2).setBorder(false,true,true,false,false,false,
  "grey",SpreadsheetApp.BorderStyle.SOLID_THICK);
}
function drawUnless(c) {
  let cValue = c.getValue();
  c.offset(0,-1,1,9).clearFormat();
  c.setValue(cValue).setHorizontalAlignment("right");
  c.offset(0,1).insertCheckboxes()
    .setBorder(true,false,true,true,false,false,
    "grey",SpreadsheetApp.BorderStyle.SOLID_THICK);
  if (c.offset(0,2).isBlank()) {
    c.offset(0,2).setValue("some exception");
  }
}



// http://blog.pamelafox.org/2013/06/exporting-google-spreadsheet-as-json.html
// https://gist.github.com/pamelafox/1878143
// Includes functions for exporting active sheet or all sheets as JSON object (also Python object syntax compatible).
// Tweak the makePrettyJSON_ function to customize what kind of JSON to export.

var FORMAT_ONELINE   = 'One-line';
var FORMAT_MULTILINE = 'Multi-line';
var FORMAT_PRETTY    = 'Pretty';

var LANGUAGE_JS      = 'JavaScript';
var LANGUAGE_PYTHON  = 'Python';

var STRUCTURE_LIST = 'List';
var STRUCTURE_HASH = 'Hash (keyed by "id" column)';

/* Defaults for this particular spreadsheet, change as desired */
var DEFAULT_FORMAT = FORMAT_PRETTY;
var DEFAULT_LANGUAGE = LANGUAGE_JS;
var DEFAULT_STRUCTURE = STRUCTURE_LIST;


function onOpen() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var menuEntries = [
    {name: "Export JSON for this sheet", functionName: "exportSheet"},
    {name: "Export JSON for all sheets", functionName: "exportAllSheets"}
  ];
  ss.addMenu("Export JSON", menuEntries);
}
 
function makeLabel(app, text, id) {
  var lb = app.createLabel(text);
  if (id) lb.setId(id);
  return lb;
}

function makeListBox(app, name, items) {
  var listBox = app.createListBox().setId(name).setName(name);
  listBox.setVisibleItemCount(1);
  
  var cache = CacheService.getPublicCache();
  var selectedValue = cache.get(name);
  Logger.log(selectedValue);
  for (var i = 0; i < items.length; i++) {
    listBox.addItem(items[i]);
    if (items[1] == selectedValue) {
      listBox.setSelectedIndex(i);
    }
  }
  return listBox;
}

function makeButton(app, parent, name, callback) {
  var button = app.createButton(name);
  app.add(button);
  var handler = app.createServerClickHandler(callback).addCallbackElement(parent);;
  button.addClickHandler(handler);
  return button;
}

function makeTextBox(app, name) { 
  var textArea    = app.createTextArea().setWidth('100%').setHeight('200px').setId(name).setName(name);
  return textArea;
}

function exportAllSheets(e) {
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var sheetsData = {};
  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    var rowsData = getRowsData_(sheet, getExportOptions(e));
    var sheetName = sheet.getName(); 
    sheetsData[sheetName] = rowsData;
  }
  var json = makeJSON_(sheetsData, getExportOptions(e));
  displayText_(json);
}

function exportSheet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var rowsData = getRowsData_(sheet, getExportOptions(e));
  var json = makeJSON_(rowsData, getExportOptions(e));
  displayText_(json);
}
  
function getExportOptions(e) {
  var options = {};
  
  options.language = e && e.parameter.language || DEFAULT_LANGUAGE;
  options.format   = e && e.parameter.format || DEFAULT_FORMAT;
  options.structure = e && e.parameter.structure || DEFAULT_STRUCTURE;
  
  var cache = CacheService.getPublicCache();
  cache.put('language', options.language);
  cache.put('format',   options.format);
  cache.put('structure',   options.structure);
  
  Logger.log(options);
  return options;
}

function makeJSON_(object, options) {
  if (options.format == FORMAT_PRETTY) {
    var jsonString = JSON.stringify(object, null, 4);
  } else if (options.format == FORMAT_MULTILINE) {
    var jsonString = Utilities.jsonStringify(object);
    jsonString = jsonString.replace(/},/gi, '},\n');
    jsonString = prettyJSON.replace(/":\[{"/gi, '":\n[{"');
    jsonString = prettyJSON.replace(/}\],/gi, '}],\n');
  } else {
    var jsonString = Utilities.jsonStringify(object);
  }
  if (options.language == LANGUAGE_PYTHON) {
    // add unicode markers
    jsonString = jsonString.replace(/"([a-zA-Z]*)":\s+"/gi, '"$1": u"');
  }
  return jsonString;
}

function displayText_(text) {
  var output = HtmlService.createHtmlOutput("<textarea style='width:100%;' rows='20'>" + text + "</textarea>");
  output.setWidth(400)
  output.setHeight(300);
  SpreadsheetApp.getUi()
      .showModalDialog(output, 'Exported JSON');
}

// getRowsData iterates row by row in the input range and returns an array of objects.
// Each object contains all the data for a given row, indexed by its normalized column name.
// Arguments:
//   - sheet: the sheet object that contains the data to be processed
//   - range: the exact range of cells where the data is stored
//   - columnHeadersRowIndex: specifies the row number where the column names are stored.
//       This argument is optional and it defaults to the row immediately above range; 
// Returns an Array of objects.
function getRowsData_(sheet, options) {
  var headersRange = sheet.getRange(1, 1, 1, sheet.getMaxColumns());
  var headers = headersRange.getValues()[0];
  var dataRange = sheet.getRange(2, 1, sheet.getMaxRows(), sheet.getMaxColumns());
  var objects = getObjects_(dataRange.getValues(), normalizeHeaders_(headers));
  if (options.structure == STRUCTURE_HASH) {
    var objectsById = {};
    objects.forEach(function(object) {
      objectsById[object.id] = object;
    });
    return objectsById;
  } else {
    return objects;
  }
}

// getColumnsData iterates column by column in the input range and returns an array of objects.
// Each object contains all the data for a given column, indexed by its normalized row name.
// Arguments:
//   - sheet: the sheet object that contains the data to be processed
//   - range: the exact range of cells where the data is stored
//   - rowHeadersColumnIndex: specifies the column number where the row names are stored.
//       This argument is optional and it defaults to the column immediately left of the range; 
// Returns an Array of objects.
function getColumnsData_(sheet, range, rowHeadersColumnIndex) {
  rowHeadersColumnIndex = rowHeadersColumnIndex || range.getColumnIndex() - 1;
  var headersTmp = sheet.getRange(range.getRow(), rowHeadersColumnIndex, range.getNumRows(), 1).getValues();
  var headers = normalizeHeaders_(arrayTranspose_(headersTmp)[0]);
  return getObjects(arrayTranspose_(range.getValues()), headers);
}


// For every row of data in data, generates an object that contains the data. Names of
// object fields are defined in keys.
// Arguments:
//   - data: JavaScript 2d array
//   - keys: Array of Strings that define the property names for the objects to create
function getObjects_(data, keys) {
  var objects = [];
  for (var i = 0; i < data.length; ++i) {
    var object = {};
    var hasData = false;
    for (var j = 0; j < data[i].length; ++j) {
      var cellData = data[i][j];
      if (isCellEmpty_(cellData)) {
        continue;
      }
      object[keys[j]] = cellData;
      hasData = true;
    }
    if (hasData) {
      objects.push(object);
    }
  }
  return objects;
}

// Returns an Array of normalized Strings.
// Arguments:
//   - headers: Array of Strings to normalize
function normalizeHeaders_(headers) {
  var keys = [];
  for (var i = 0; i < headers.length; ++i) {
    var key = normalizeHeader_(headers[i]);
    if (key.length > 0) {
      keys.push(key);
    }
  }
  return keys;
}

// Normalizes a string, by removing all alphanumeric characters and using mixed case
// to separate words. The output will always start with a lower case letter.
// This function is designed to produce JavaScript object property names.
// Arguments:
//   - header: string to normalize
// Examples:
//   "First Name" -> "firstName"
//   "Market Cap (millions) -> "marketCapMillions
//   "1 number at the beginning is ignored" -> "numberAtTheBeginningIsIgnored"
function normalizeHeader_(header) {
  var key = "";
  var upperCase = false;
  for (var i = 0; i < header.length; ++i) {
    var letter = header[i];
    if (letter == " " && key.length > 0) {
      upperCase = true;
      continue;
    }
    if (!isAlnum_(letter)) {
      continue;
    }
    if (key.length == 0 && isDigit_(letter)) {
      continue; // first character must be a letter
    }
    if (upperCase) {
      upperCase = false;
      key += letter.toUpperCase();
    } else {
      key += letter.toLowerCase();
    }
  }
  return key;
}

// Returns true if the cell where cellData was read from is empty.
// Arguments:
//   - cellData: string
function isCellEmpty_(cellData) {
  return typeof(cellData) == "string" && cellData == "";
}

// Returns true if the character char is alphabetical, false otherwise.
function isAlnum_(char) {
  return char >= 'A' && char <= 'Z' ||
    char >= 'a' && char <= 'z' ||
    isDigit_(char);
}

// Returns true if the character char is a digit, false otherwise.
function isDigit_(char) {
  return char >= '0' && char <= '9';
}

// Given a JavaScript 2d Array, this function returns the transposed table.
// Arguments:
//   - data: JavaScript 2d Array
// Returns a JavaScript 2d Array
// Example: arrayTranspose([[1,2,3],[4,5,6]]) returns [[1,4],[2,5],[3,6]].
function arrayTranspose_(data) {
  if (data.length == 0 || data[0].length == 0) {
    return null;
  }

  var ret = [];
  for (var i = 0; i < data[0].length; ++i) {
    ret.push([]);
  }

  for (var i = 0; i < data.length; ++i) {
    for (var j = 0; j < data[i].length; ++j) {
      ret[j][i] = data[i][j];
    }
  }

  return ret;
}




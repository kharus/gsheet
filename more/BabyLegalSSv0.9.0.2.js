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
function processHistory(h, sheet) {
  // Process the h.history Array.
  let restart = true;
  let rowBegin = rowStop = numOfRows = 0;
  let buildRange = rangeString = "";
  let columnNow = farCol = 1;
  // Get furthest column and convert the keyword
  // "UNLESS" to "AND", and its predicate to
  // NOT predicate.
  for (const element of h.history) {
    if (element != null) {
      farCol = getFurthest(farCol, element[0]);
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
  c.offset(0,1,1,4).setBorder(false,true,true,false,false,false,
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





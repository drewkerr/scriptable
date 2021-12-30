// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: procedures;
// Configuration
const location = "VIC" // ACT, NSW, NT, QLD, SA, TAS, VIC, WA

// Using data sources from these articles:
// https://www.abc.net.au/news/2020-03-17/coronavirus-cases-data-reveals-how-covid-19-spreads-in-australia/12060704
// https://www.abc.net.au/news/2021-03-02/charting-australias-covid-vaccine-rollout/13197518

function parseCSV(str, len = 0) {
  let arr = [];
  let quote = false;
  let col, c;
  for (let row = col = c = 0; c < str.length && (!!len === row < len); c++) {
    let cc = str[c], nc = str[c+1];
    arr[row] = arr[row] || [];
    arr[row][col] = arr[row][col] || '';
    if (cc == '"' && quote && nc == '"') { arr[row][col] += cc; ++c; continue; }
    if (cc == '"') { quote = !quote; continue; }
    if (cc == ',' && !quote) { ++col; continue; }
    if (cc == '\r' && nc == '\n' && !quote) { ++row; col = 0; ++c; continue; }
    if (cc == '\n' && !quote) { ++row; col = 0; continue; }
    if (cc == '\r' && !quote) { ++row; col = 0; continue; }
    arr[row][col] += cc;
  }
  return arr;
}

function arrayHash(arr) {
  let head = arr[0]
  let body = arr.slice(1)
  return body.map(row => {
    return row.reduce((acc, v, i) => {
      let key = head[i]
      acc[key] = v
      return acc
    }, {})
  })
}

async function getData(url, len = 0) {
  let req = new Request(url)
  let txt = await req.loadString()
  let csv = await parseCSV(txt, len)
  return await arrayHash(csv)
}

// Source: https://docs.google.com/spreadsheets/d/1nUUU5zPRPlhAXM_-8R7lsMnAkK4jaebvIL5agAaKoXk/edit

const url = 'https://covid-sheets-mirror.web.app/api?'
const sid = '1nUUU5zPRPlhAXM_-8R7lsMnAkK4jaebvIL5agAaKoXk'

function params(obj) {
  return Object.entries(obj)
    .map(([key, val]) => `${key}=${encodeURI(val)}`).join("&")
}

async function checkData() {

  const meta = url + params({
    cache: true,
    sheet: sid,
    range: 'Metadata!A:B'
  })

  let data = await getData(meta, 3)
  if (data[0].Value == "TRUE") {
    return data[1].Value
  } else {
    return false
  }
}

async function saveData(updated) {

  const state = url + params({
    cache: true,
    sheet: sid,
    range: 'Active States Daily Count!A:E'
  })

  const hospt = url + params({
    cache: true,
    sheet: sid,
    range: 'Fed Hospitalisation!A1:G9'
  })
  
  const death = url + params({
    cache: true,
    sheet: sid,
    range: 'Deaths!A:C'
  })
  
  const vaccs = 'https://www.abc.net.au/dat/news/interactives/covid19-data/aus-doses-breakdown.csv'

  let stateData = await getData(state)
  let hosptData = await getData(hospt)
  let deathData = await getData(death)
  let vaccsData = await getData(vaccs)
  vaccsData = vaccsData[vaccsData.length - 1]
  
  const numstr = s => parseInt(s).toLocaleString()

  let myStateData = stateData.filter(data => data["State/territory"] == location)
  let newDeaths = deathData.filter(data => data["Date"] == deathData[0].Date)
  let newLocalDeaths = newDeaths.filter(data => data["State/territory"] == location)

  let graph = stateData.reduce((a, b) => {
    let date = b["Date announced"]
    let cases = parseInt(b["New cases"]) || 0
    if (!a[date]) a[date] = cases
    else a[date] += cases
    return a
  }, {})
  let total = stateData.slice(0,8).reduce((a, b) => {
    return a + (parseInt(b["Cumulative confirmed"]) || 0)
  }, 0)
  const month = Object.values(graph)
  const t = 7 // 7 day smoothing period
  const sum = (a, b) => a + b
  const tsum = (n) => month.slice(n * t, t + n * t).reduce(sum)
  const growth = Math.pow(tsum(0) / tsum(1), 1 / t)
  let data = {
    "stats": {
      "Growth factor": growth.toFixed(2),
      "New vaccine doses": numstr(vaccsData["daily"]),
      "Cumulative doses": numstr(vaccsData["total"]),
      "Fully vaccinated": vaccsData["totalSecondPct"]+'%',
      "At least partially": vaccsData["totalFirstPct"]+'%',
      [location+" new cases"]: numstr(myStateData[0]["New cases"]),
      [location+" total cases"]: numstr(myStateData[0]["Cumulative confirmed"]),
      [location+" hospitalised"]: numstr(hosptData.filter(data => data["State/territory"] == location)[0]["Hospitalised "]),
      [location+" ICU"]: numstr(hosptData.filter(data => data["State/territory"] == location)[0]["ICU"]),
      [location+" ventilated"]: numstr(hosptData.filter(data => data["State/territory"] == location)[0]["Ventilated"]),
      [location+" new deaths"]: numstr(newLocalDeaths.length),
      "Australia new cases": numstr(month[0]),
      "Australia hospitalised": numstr(hosptData.reduce((a, b) => a + (parseInt(b["Hospitalised "]) || 0), 0)),
      "Australia ICU": numstr(hosptData.reduce((a, b) => a + (parseInt(b["ICU"]) || 0), 0)),
      "Australia ventilated": numstr(hosptData.reduce((a, b) => a + (parseInt(b["Ventilated"]) || 0), 0)),
      "Australia total cases": numstr(total),
      "Australia new deaths": numstr(newDeaths.length),
      "Australia total deaths": numstr(deathData[0]["Death ID"])
    },
    "widget": {
      "ICU": `${hosptData.reduce((a, b) => a + (parseInt(b["ICU"]) || 0), 0)} / ${hosptData.reduce((a, b) => a + (parseInt(b["Hospitalised "]) || 0), 0)}`,
      [location]: `+${myStateData[0]["New cases"]} -${numstr(newLocalDeaths.length)}`,
      "AUS": `+${month[0].toString()}  -${numstr(newDeaths.length)}`
    },
    "national": month.slice(0,28),
    "state": myStateData.map(a => parseInt(a["New cases"]) || 0).slice(0,28),
    "date": stateData[0]["Date announced"],
    "growth": growth,
    "vacpc": [vaccsData["totalFirstPct"], vaccsData["totalSecondPct"]],
    "updated": updated
  }
  let fm = FileManager.iCloud()
  let path = fm.joinPath(fm.documentsDirectory(), "covid19.json")
  fm.writeString(path, JSON.stringify(data))
  return data
}

function loadData() {
  let fm = FileManager.iCloud()
  let path = fm.joinPath(fm.documentsDirectory(), "covid19.json")
  if (fm.fileExists(path)) {
    let data = fm.readString(path)
    return JSON.parse(data)
  } else {
    return { updated: false }
  }
}

function caseGraph(totdata, subdata, width, height, colour) {
  const max = Math.max(...totdata)
  let context = new DrawContext()
  context.size = new Size(width, height)
  context.opaque = false
  const drawColumns = (value, index, data) => {
    let w = width / (2 * data.length - 1)
    let h = value / max * height
    let x = width - (index * 2 + 1) * w
    let y = height - h
    let rect = new Rect(x, y, w, h)
    context.fillRect(rect)
  }
  context.setFillColor(new Color(colour, 0.5))
  totdata.forEach(drawColumns)
  context.setFillColor(new Color(colour, 1))
  subdata.forEach(drawColumns)
  return context
}

function vaccGraph(firstpc, secondpc, width, height) {
  let context = new DrawContext()
  context.opaque = false
  context.size = new Size(width, height)
  context.setFillColor(new Color("ffffff", 0.2))
  let bg = new Rect(0, 0, width, height)
  context.fillRect(bg)
  context.setFillColor(new Color("ffffff", 0.5))
  let rect1 = new Rect(0, 0, width * firstpc / 100, height)
  context.fillRect(rect1)
  context.setFillColor(new Color("ffffff", 1))
  let rect2 = new Rect(0, 0, width * secondpc / 100, height)
  context.fillRect(rect2)
  return context
}

function createWidget(data) {
  let widget = new ListWidget()
  widget.setPadding(16, 16, 16, 16)
  
  function gradient(start, end) {
    let startColor = new Color(start)
    let endColor = new Color(end)
    let gradient = new LinearGradient()
    gradient.colors = [startColor, endColor]
    gradient.locations = [0.0, 1]
    widget.backgroundGradient = gradient
  }

  let growth = data["growth"]
  if (growth < 1) gradient("37c25a", "1cb943")
  else gradient("ee676c", "eb5056")

  let header = widget.addStack()
  let headText = header.addText("COVID-19")
  headText.textColor = Color.white()
  headText.font = Font.boldSystemFont(10)
  headText.minimumScaleFactor = 0.5
  header.addSpacer()
  let dateText = header.addText(data["date"])
  dateText.textColor = Color.white()
  dateText.textOpacity = 0.8
  dateText.font = Font.regularSystemFont(10)
  dateText.minimumScaleFactor = 0.5

  let col = caseGraph(data["national"], data["state"], 400, 100, "ffffff").getImage()
  widget.addImage(col).applyFillingContentMode()
  let growText = widget.addText(`growth ${data["stats"]["Growth factor"]}`)
  growText.rightAlignText()
  growText.textColor = Color.white()
  growText.textOpacity = 0.8
  growText.font = Font.regularSystemFont(10)
  growText.minimumScaleFactor = 0.5

  widget.addSpacer()
  
  let bar = vaccGraph(data["vacpc"][0], data["vacpc"][1], 232, 3).getImage()
  widget.addImage(bar)
  
  let vaxText = widget.addText(`${data["stats"]["Fully vaccinated"]} vaccinated`)
  vaxText.rightAlignText()
  vaxText.textColor = Color.white()
  vaxText.textOpacity = 0.8
  vaxText.font = Font.regularSystemFont(10)
  vaxText.minimumScaleFactor = 0.5

  widget.addSpacer()

  Object.entries(data["widget"]).forEach(([key, value]) => {
    let stack = widget.addStack()
    stack.spacing = 5
    let labelText = stack.addText(key)
    labelText.textColor = Color.white()
    labelText.textOpacity = 0.6
    labelText.font = Font.regularSystemFont(12)
    labelText.minimumScaleFactor = 0.5
    let bodyText = stack.addText(value)
    bodyText.textColor = Color.white()
    bodyText.font = Font.regularSystemFont(12)
    bodyText.minimumScaleFactor = 0.5
  })

  return widget
}

function createTable(data) {
  let table = new UITable()
  let dark = Device.isUsingDarkAppearance()
  let growth = data["growth"]
  let bgColor =
    growth < 1 && dark ? new Color("003300") :
    dark ? new Color("330000") :
    growth < 1 ? new Color("b8ffb1") :
    new Color("ffb1b1")
  let fgColor = dark ? "ffffff" : "000000"
  let head = new UITableRow()
  head.isHeader = true
  head.addText('COVID-19 Statistics')
  head.addText(data['date']).rightAligned()
  head.backgroundColor = bgColor
  table.addRow(head)
  let row = new UITableRow()
  row.backgroundColor = bgColor
  let image = caseGraph(data["national"], data["state"], 640, 50, fgColor).getImage()
  row.addImage(image)
  table.addRow(row)
  Object.entries(data["stats"]).forEach(([key, value]) => {
    let row = new UITableRow()
    row.addText(key)
    row.addText(value).rightAligned()
    row.backgroundColor = bgColor
    table.addRow(row)
  })
  table.present()
}

function display(data) {
  if (config.runsInWidget) {
    let widget = createWidget(data)
    Script.setWidget(widget)
  } else {
    createTable(data)
  }
  Script.complete()
}

let updated = await checkData()
let data = await loadData()
if (updated) {
  if (data["updated"] != updated) {
    data = await saveData(updated)
    display(data)
  } else {
    display(data)
  }
}

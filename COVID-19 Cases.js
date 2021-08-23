// From ABC News: https://abc.net.au/news/2020-03-17/coronavirus-cases-data-reveals-how-covid-19-spreads-in-australia/12060704

// Configuration
const postcode = "3550"

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

  const cases = url + params({
    cache: true,
    sheet: sid,
    range: 'Deaths Recoveries!A:G'
  })

  const state = url + params({
    cache: true,
    sheet: sid,
    range: 'Daily Count States!A:E'
  })

  const local = url + params({
    cache: true,
    sheet: sid,
    range: 'Vic Postcodes (Auto)!A:I'
  })
  
  const vaccs = 'https://www.abc.net.au/dat/news/interactives/covid19-data/aus-vaccinations-by-administration.csv'
  const vacpc = 'https://www.abc.net.au/dat/news/interactives/covid19-data//aus-doses-breakdown.csv'

  let casesData = await getData(cases, 10)
  let stateData = await getData(state, 28*8+1)
  let localData = await getData(local, 704)
  let vaccsData = await getData(vaccs)
  let vacpcData = await getData(vacpc)
  vaccsData = vaccsData[vaccsData.length - 12]
  vacpcData = vacpcData[vacpcData.length - 9]

  let vicData = stateData.filter(data => data["State/territory"] == "VIC")
  let locData = localData.filter(data => data["postcode"] == postcode)

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
      "New vaccine doses": parseInt(vaccsData["daily"]).toLocaleString(),
      "Cumulative doses": parseInt(vaccsData["total"]).toLocaleString(),
      "Fully vaccinated": vacpcData["totalSecondPct"]+'%',
      "At least partially": vacpcData["totalFirstPct"]+'%',
      "Local active cases": locData[0]["active"],
      "Local total cases": locData[0]["cases"],
      "Victoria new cases": vicData[0]["New cases"],
      "Victoria active cases": casesData.filter(data => data["State/territory"] == "VIC")[0]["Current"],
      "Victoria total cases": vicData[0]["Cumulative confirmed"],
      "Australia new cases": month[0].toString(),
      "Australia active cases": casesData[0]["Current"],
      "Australia total cases": total.toLocaleString(),
      "Australia total deaths": casesData[0]["Deceased"]
    },
    "widget": {
      //"VAX": `${parseInt(vaccsData["total"]).toLocaleString()} (+${Math.round(parseInt(vaccsData["daily"])/1000)}k)`,
      "LGA": `${locData[0]["active"]} active`,
      "VIC": `${casesData.filter(data => data["State/territory"] == "VIC")[0]["Current"]} (+${vicData[0]["New cases"]})`,
      "AUS": `${casesData[0]["Current"]} (+${month[0].toString()})`
    },
    "graph": month,
    "date": stateData[0]["Date announced"],
    "growth": growth,
    "vacpc": [vacpcData["totalFirstPct"], vacpcData["totalSecondPct"]],
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
  let data = fm.readString(path)
  return JSON.parse(data)
}

function columnGraph(data, width, height, colour) {
  let max = Math.max(...data)
  let context = new DrawContext()
  context.size = new Size(width, height)
  context.opaque = false
  context.setFillColor(colour)
  data.forEach((value, index) => {
    let w = width / (2 * data.length - 1)
    let h = value / max * height
    let x = width - (index * 2 + 1) * w
    let y = height - h
    let rect = new Rect(x, y, w, h)
    context.fillRect(rect)
  })
  return context
}

function barGraph(firstpc, secondpc, width, height) {
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
//   let now = new Date()
//   now.setHours(now.getHours() + 12)
//   widget.refreshAfterDate = now
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

  let col = columnGraph(data["graph"], 400, 100, Color.white()).getImage()
  widget.addImage(col).applyFillingContentMode()
  let growText = widget.addText(`growth ${data["stats"]["Growth factor"]}`)
  growText.rightAlignText()
  growText.textColor = Color.white()
  growText.textOpacity = 0.8
  growText.font = Font.regularSystemFont(10)
  growText.minimumScaleFactor = 0.5

  widget.addSpacer()
  
  let bar = barGraph(data["vacpc"][0], data["vacpc"][1], 232, 3).getImage()
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
  let fgColor = dark ? Color.white() : Color.black()
  let head = new UITableRow()
  head.isHeader = true
  head.addText('COVID-19 Statistics')
  head.addText(data['date']).rightAligned()
  head.backgroundColor = bgColor
  table.addRow(head)
  let row = new UITableRow()
  row.backgroundColor = bgColor
  let image = columnGraph(data["graph"], 640, 50, fgColor).getImage()
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
  //if (config.runsWithSiri)
  //  Speech.speak(`There are ${data["stats"]["Local active cases"]} active local cases, and ${data["stats"]["Victoria new cases"]} new cases across the state today.`)
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

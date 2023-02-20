// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: procedures;
// Configuration
const location = "VIC" // ACT, NSW, NT, QLD, SA, TAS, VIC, WA
const url = "https://covidlive.com.au/covid-live.csv"

function parseCSV(str, len = 0) {
  let arr = []
  let quote = false
  for (let row = col = c = 0; c < str.length && (!!len === row < len); c++) {
    let cc = str[c], nc = str[c+1]
    arr[row] = arr[row] || []
    arr[row][col] = arr[row][col] || ''
    if (cc == '"' && quote && nc == '"') { arr[row][col] += cc; ++c; continue; }
    if (cc == '"') { quote = !quote; continue; }
    if (cc == ',' && !quote) { ++col; continue; }
    if (cc == '\r' && nc == '\n' && !quote) { ++row; col = 0; ++c; continue; }
    if (cc == '\n' && !quote) { ++row; col = 0; continue; }
    if (cc == '\r' && !quote) { ++row; col = 0; continue; }
    arr[row][col] += cc
  }
  return arr
}

function filterDay(csv, day = 0) {
  let latest = csv[1][0].split("-")
  let daynow = new Date(latest[0], latest[1] - 1, latest[2]).getDay()
  let offset = (daynow + 7 - day) % 7
  let filter = [csv[0]]
  for (let i = offset * 9 + 1; i < csv.length; i = i + 7 * 9) {
    for (let j = 0; j < 9; j++) {
      filter.push(csv[i + j])
    }
  }
  return filter
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

async function getData(url) {
  let req = new Request(url)
  let txt = await req.loadString()
  let csv = await parseCSV(txt, 26 * 7 * 9 + 1)
  let fri = await filterDay(csv, 5)
  return await arrayHash(fri)
}

function saveData(data) {
  
  const numstr = s => parseInt(s).toLocaleString()

  const state = data.filter(d => d["CODE"] == location)
  const national = data.filter(d => d["CODE"] == "AUS")
  console.log(state)
  
  const natcases = national.map(a => parseInt(a["NEW_CASE_CNT"]) || 0)
  const t = 4 // 4 week smoothing period
  const sum = (a, b) => a + b
  const tsum = (n) => natcases.slice(n * t, t + n * t).reduce(sum)
  const growth = Math.pow(tsum(0) / tsum(1), 1 / t)

  data = {
    stats: {
      "Growth factor": growth.toFixed(2),
      [location+" new cases"]: numstr(state[0]["NEW_CASE_CNT"]),
      [location+" total cases"]: numstr(state[0]["CASE_CNT"]),
      [location+" hospitalised"]: numstr(state[0]["MED_HOSP_CNT"]),
      [location+" ICU"]: numstr(state[0]["MED_ICU_CNT"]),
      [location+" ventilated"]: numstr(state[0]["MED_VENT_CNT"]),
      [location+" new deaths"]: numstr(state[0]["DEATH_CNT"] - state[0]["PREV_DEATH_CNT"]),
      [location+" total deaths"]: numstr(state[0]["DEATH_CNT"]),
      "Australia new cases": numstr(national[0]["NEW_CASE_CNT"]),
      "Australia total cases": numstr(national[0]["CASE_CNT"]),
      "Australia hospitalised": numstr(national[0]["MED_HOSP_CNT"]),
      "Australia ICU": numstr(national[0]["MED_ICU_CNT"]),
      "Australia new deaths": numstr(national[0]["DEATH_CNT"] - national[0]["PREV_DEATH_CNT"]),
      "Australia total deaths": numstr(national[0]["DEATH_CNT"]),
      "First vaccine doses": numstr(national[0]["VACC_FIRST_DOSE_CNT"]),
      "Second vaccine doses": numstr(national[0]["VACC_PEOPLE_CNT"]),
      "Booster vaccine doses": numstr(national[0]["VACC_BOOSTER_CNT"]),
    },
    widget: {
      "ICU": `${numstr(national[0]["MED_ICU_CNT"])} / ${numstr(national[0]["MED_HOSP_CNT"])}`,
      [location]: `+${numstr(state[0]["NEW_CASE_CNT"])} -${numstr(state[0]["DEATH_CNT"] - state[0]["PREV_DEATH_CNT"])}`,
      "AUS": `+${numstr(national[0]["NEW_CASE_CNT"])} -${numstr(national[0]["DEATH_CNT"] - national[0]["PREV_DEATH_CNT"])}`
    },
    national: natcases,
    state: state.map(a => parseInt(a["NEW_CASE_CNT"]) || 0),
    date: data[0]["REPORT_DATE"]
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

  if (data.stats["Growth factor"] < 1) gradient("37c25a", "1cb943")
  else gradient("ee676c", "eb5056")

  let header = widget.addStack()
  let headText = header.addText("COVID-19")
  headText.textColor = Color.white()
  headText.font = Font.boldSystemFont(10)
  headText.minimumScaleFactor = 0.5
  header.addSpacer()
  let dateText = header.addText(data.date)
  dateText.textColor = Color.white()
  dateText.textOpacity = 0.8
  dateText.font = Font.regularSystemFont(10)
  dateText.minimumScaleFactor = 0.5

  let col = caseGraph(data.national, data.state, 200, 100, "ffffff").getImage()
  widget.addImage(col).applyFillingContentMode()
  let growText = widget.addText(`growth ${data.stats["Growth factor"]}`)
  growText.rightAlignText()
  growText.textColor = Color.white()
  growText.textOpacity = 0.8
  growText.font = Font.regularSystemFont(10)
  growText.minimumScaleFactor = 0.5

  widget.addSpacer()

  Object.entries(data.widget).forEach(([key, value]) => {
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
  let grow = data.stats["Growth factor"] < 1
  let bgColor =
    grow && dark ? new Color("003300") :
    dark ? new Color("330000") :
    grow ? new Color("b8ffb1") :
    new Color("ffb1b1")
  let fgColor = dark ? "ffffff" : "000000"
  let head = new UITableRow()
  head.isHeader = true
  head.addText('COVID-19 Statistics')
  head.addText(data.date).rightAligned()
  head.backgroundColor = bgColor
  table.addRow(head)
  let row = new UITableRow()
  row.backgroundColor = bgColor
  let image = caseGraph(data.national, data.state, 640, 50, fgColor).getImage()
  row.addImage(image)
  table.addRow(row)
  Object.entries(data.stats).forEach(([key, value]) => {
    let row = new UITableRow()
    row.addText(key)
    row.addText(value).rightAligned()
    row.backgroundColor = bgColor
    table.addRow(row)
  })
  table.present()
}

if (config.runsInWidget) {
  let data = loadData()
  let widget = createWidget(data)
  Script.setWidget(widget)
} else {
  let data = await getData(url)
  data = saveData(data)
  createTable(data)
}

Script.complete()

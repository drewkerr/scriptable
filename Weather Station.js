// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: sun;
// https://doc.ecowitt.net/web/#/apiv3en?page_id=17
const station = {
  home: {
    application_key: "",
    api_key: "",
    mac: ""
  }
}
const API_key = station[args.widgetParameter] || station.home
const realURL = "https://api.ecowitt.net/api/v3/device/real_time?"
const realCFG = {
  temp_unitid: 1,
  pressure_unitid: 3,
  wind_speed_unitid: 7,
  rainfall_unitid: 12,
  solar_irradiance_unitid: 14
}

// https://doc.ecowitt.net/web/#/apiv3en?page_id=19
const histURL = "https://api.ecowitt.net/api/v3/device/history?"
const histCFG = {
  start_date: new Date(Date.now() - 6*60*60*1000).toLocaleString('sv'),
  end_date: new Date().toLocaleString('sv'),
  call_back: ["outdoor.temperature", "outdoor.humidity", "pressure.absolute"]
}

// config object to URL parameters
function params(obj) {
  return Object.entries(obj)
    .map(([key, val]) => `${key}=${encodeURI(val)}`).join("&")
}

// request JSON from server
async function getData(url, settings) {
  url = url + params(settings)
  let req = new Request(url)
  let res = await req.loadJSON()
  return await res
}

// set light/dark mode colours
const bgColor = Color.dynamic(Color.white(), Color.black())
const fgColor = Color.dynamic(Color.black(), Color.white())
const dark = Device.isUsingDarkAppearance()

// Title Case String
const title = str => str.replace(/(^|\s)\S/g, s => s.toUpperCase() )

// [points] to img of line graph
function lineGraph(points, width, height, line) {
  let context = new DrawContext()
  context.size = new Size(width, height)
  context.opaque = false

  let max = Math.max(...points)
  let min = Math.min(...points)
  let xFactor = width / (points.length - 1)
  let yFactor = (height - line) / (max - min)

  function scalePoint([x, y]) {
    let xScaled = x * xFactor
    let yScaled = (height - line) - (y - min) * yFactor + line/2
    return new Point(xScaled, yScaled)
  }

  let path = new Path()
  path.addLines(points.map((p, i) => scalePoint([i, p])))
  context.addPath(path)
  context.setLineWidth(line)
  context.setStrokeColor(Color.black())
  context.strokePath()
  return context.getImage()
}

// degrees to compass direction
function compass(deg) {
  const dir = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  return dir[Math.floor(((parseInt(deg) + 11.25) % 360) / 22.5)]
}

// degrees to wind vane image
function vane(deg) {
  let f = 4 // scale factor
  let context = new DrawContext()
  context.size = new Size(f*10, f*10)
  context.opaque = false

  const s = Math.sin(deg * Math.PI/180)
  const c = Math.cos(deg * Math.PI/180)
  const p = (x, y) => new Point(f*(x*c-y*s+5), f*(x*s+y*c+5))

  let path = new Path()
  path.move(p(0,-4))
  path.addLine(p(3,4))
  path.addLine(p(0,1))
  path.addLine(p(-3,4))
  path.addLine(p(0,-4))

  context.addPath(path)
  context.setLineWidth(2)
  context.strokePath()
  return context.getImage()
}

// pressure to barometer image
function baro(pressure) {
  let deg = (pressure - 1010) / 40 * 90
  let context = new DrawContext()
  context.size = new Size(40, 40)
  context.opaque = false

  const s = Math.sin(deg * Math.PI/180)
  const c = Math.cos(deg * Math.PI/180)
  const p = (x, y) => new Point(x*c+y*s+20, x*s-y*c+20)

  let border = new Path()
  border.addEllipse(new Rect(4, 4, 32, 32))
  context.addPath(border)
  context.setLineWidth(2.5)
  context.strokePath()

  let path = new Path()
  path.addEllipse(new Rect(17.25, 17.25, 5.5, 5.5))
  path.move(p(0,3.5))
  path.addLine(p(0,12))
  path.move(p(0,-3.5))
  path.addLine(p(0,-7))
  context.addPath(path)
  context.setLineWidth(2)
  context.strokePath()

  return context.getImage()
}

// calculate least-squares regression from [[x,y]]
function linearRegression(p) {
  let sum = { x: 0, y: 0, xx: 0, xy: 0 }
  for (let [x, y] of p) {
    x = x - p[0][0]
    sum.x += x
    sum.y += y
    sum.xx += x*x
    sum.xy += x*y
  }
  let len = p.length
  let m = (len * sum.xy - sum.x * sum.y) / (len * sum.xx - sum.x * sum.x)
  //let c = (sum.y / len) - (m * sum.x) / len
  return m
}

// configure homescreen widget
function createWidget(data, hist) {
  let widget = new ListWidget()
  widget.setPadding(12, 12, 12, 4)
  widget.spacing = 2
  widget.backgroundColor = bgColor

  if (!data.data || data.msg != "success" || hist.msg != "success") {
    widget.addText("Loading data...")
    return widget
  }

  // set highlight colour by temperature
  const t = data.data.outdoor.temperature.value
  let uiColor = Color.magenta()
  if (t < 5) uiColor = Color.lightGray()
  else if (t < 10) uiColor = Color.purple()
  else if (t < 15) uiColor = Color.blue()
  else if (t < 20) uiColor = Color.green()
  else if (t < 25) uiColor = Color.yellow()
  else if (t < 30) uiColor = Color.orange()
  else if (t < 35) uiColor = Color.red()

  const hourTrend = list => {
    let pairs = Object.entries(list)
      .slice(-12)
      .map(([x,y]) => [parseFloat(x),parseFloat(y)])
    let m = linearRegression(pairs)
    return (m > 0.0) ? '⏶'
      : (m < 0.0) ? '⏷'
      : ''
  }

  // class for adding and styling widget elements
  class Stack {
    constructor(widget) {
      this.stack = widget.addStack()
      this.stack.centerAlignContent()
    }
    #addText(str) {
      let text = this.stack.addText(str)
      text.minimumScaleFactor = 0.5
      text.linelimit = 1
      text.textColor = fgColor
      return text
    }
    addTitle(str) {
      let text = this.#addText(str)
      text.textColor = uiColor
      text.font = Font.boldRoundedSystemFont(16)
      this.stack.addSpacer()
      return this
    }
    addValue(str) {
      let text = this.#addText(str)
      text.font = Font.mediumRoundedSystemFont(16)
      this.stack.addSpacer(2)
      return this
    }
    addUnit(str) {
      let text = this.#addText(str)
      text.font = Font.lightRoundedSystemFont(16)
      this.stack.addSpacer(8)
      return this
    }
    #addImg(img) {
      let image = this.stack.addImage(img)
      image.imageSize = new Size(22, 22)
      image.tintColor = uiColor
      this.stack.addSpacer()
      return image
    }
    addImage(img) {
      let image = this.#addImg(img)
      return this
    }
    addSymbol(sym) {
      let symbol = SFSymbol.named(sym).image
      let image = this.#addImg(symbol)
      return this
    }
  }

  // add widget elements
  new Stack(widget)
    .addSymbol('thermometer')
    .addTitle(data.data.outdoor.temperature.value + '°')
    .addUnit(data.data.indoor.temperature.value + data.data.indoor.temperature.unit)
  let points = Object.values(hist.data.outdoor.temperature.list)
    .map(n => parseFloat(n))
  widget.addImage(lineGraph(points, 282, 24, 3)).tintColor = uiColor
  new Stack(widget)
    .addImage(vane(data.data.wind.wind_direction.value))
    .addTitle(compass(data.data.wind.wind_direction.value))
    .addValue(data.data.wind.wind_speed.value)
    .addUnit(data.data.wind.wind_speed.unit)
  let sym = (data.data.rainfall.daily.value > 0) ? 'cloud.rain'
    : (dark) ? 'cloud.moon'
    : 'cloud.sun'
  new Stack(widget)
    .addSymbol(sym)
    .addValue(data.data.rainfall.daily.value)
    .addUnit(data.data.rainfall.daily.unit)
  new Stack(widget)
    .addSymbol('humidity')
    .addValue(hourTrend(hist.data.outdoor.humidity.list))
    .addValue(data.data.outdoor.humidity.value)
    .addUnit(data.data.outdoor.humidity.unit)
  new Stack(widget)
    .addImage(baro(data.data.pressure.absolute.value))
    .addValue(hourTrend(hist.data.pressure.absolute.list))
    .addValue(data.data.pressure.absolute.value)
    .addUnit(data.data.pressure.absolute.unit)

  return widget
}

// configure table to display when run
function createTable(data) {
  let table = new UITable()
  
  // header row
  let head = new UITableRow()
  head.isHeader = true
  // unix time to Date()
  let updated = new Date(data.time * 1000)
  head.addText(updated.toLocaleDateString('en-AU', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }))
  head.addText(updated.toLocaleTimeString()).rightAligned()
  head.backgroundColor = bgColor
  table.addRow(head)
  
  // loop over object of objects to add rows
  Object.entries(data.data).forEach(([sensor, section]) => {
    Object.entries(section).forEach(([observation, measurement]) => {
      let row = new UITableRow()
      row.addText(`${title(sensor)}: ${title(observation.replace('_',' '))}`)
      row.addText(`${measurement.value} ${measurement.unit}`).rightAligned()
      row.backgroundColor = bgColor
      table.addRow(row)
    })
  })
  table.present()
}

// show text widget on lockscreen
function createAccessory(data) {
  let widget = new ListWidget()
  let image = SFSymbol.named('thermometer').image
  widget.addImage(image)
  let text = data.data.outdoor.temperature.value + '-' + data.data.indoor.temperature.value + data.data.indoor.temperature.unit
  widget.addText(text)
  return widget
}

// get data and display as widget or table
let data = await getData(realURL, {...API_key, ...realCFG})
if (config.runsInApp) {
  createTable(data)
} else if (config.runsInAccessoryWidget) {
  let widget = createAccessory(data)
  Script.setWidget(widget)
} else if (config.runsInWidget) {
  let hist = await getData(histURL, {...API_key, ...realCFG, ...histCFG})
  let widget = createWidget(data, hist)
  Script.setWidget(widget)
}
Script.complete()
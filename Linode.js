// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: server;
// Thanks to https://github.com/telega/longview-data/blob/master/lib/index.js

// Create a Personal Access Token with read-only access to Longview:
// https://cloud.linode.com/profile/tokens
const key = ''

function parseData(json) {
  console.log(json)
  try {
    let data = {}
    data[json[0].DATA.SysInfo.hostname] = getUptime(json[0].DATA.Uptime)

    if (json[0].DATA.CPU) {
      data.CPU = {}
      data.CPU.percent = Object.values(json[0].DATA.CPU)
        .map(e => e.system[0].y + e.user[0].y + e.wait[0].y)
        .reduce((a, c) => a + c)
        .toFixed()
      data.CPU.value = data.CPU.percent + '%'
      data.CPU.colour = "5D83B4"
  
      data.RAM = {}
      data.RAM.value = json[0].DATA.Memory.real.used[0].y - json[0].DATA.Memory.real.buffers[0].y - json[0].DATA.Memory.real.cache[0].y
      data.RAM.percent = ((100 * data.RAM.value) / (json[0].DATA.Memory.real.used[0].y + json[0].DATA.Memory.real.free[0].y)).toFixed()
      data.RAM.value = (data.RAM.value / 1024).toFixed() + ' MB'
      data.RAM.colour = "D3B2D6"
  
      data.Swap = {}
      data.Swap.value = json[0].DATA.Memory.swap.used[0].y
      data.Swap.percent = ((100 * data.Swap.value) / (json[0].DATA.Memory.swap.used[0].y + json[0].DATA.Memory.swap.free[0].y)).toFixed()
      data.Swap.value = (data.Swap.value / 1024).toFixed() + ' MB'
      data.Swap.colour = "ED6D49"
  
      data.Load = {}
      data.Load.value = json[0].DATA.Load[0].y
      data.Load.percent = (100 * data.Load.value / Object.keys(json[0].DATA.CPU).length).toFixed()
      data.Load.value = data.Load.value.toFixed(2)
      data.Load.colour = "F9DD8A"
  
      data.Network = {}
      data.Network.value = Object.values(json[0].DATA.Network.Interface)
        .map(e => e.tx_bytes[0].y + e.rx_bytes[0].y)
        .reduce((a, c) => a + c)
        .toFixed()
      data.Network.percent = (100 * data.Network.value / 2400000).toFixed()
      data.Network.value = getBitsPerSec(data.Network.value)
      data.Network.colour = "67CB54"
  
      data.Storage = {}
      data.Storage.value = json[0].DATA.Disk['/dev/sda'].fs.total[0].y - json[0].DATA.Disk['/dev/sda'].fs.free[0].y
      data.Storage.percent = ((100 * data.Storage.value) / json[0].DATA.Disk['/dev/sda'].fs.total[0].y).toFixed()
      data.Storage.value = (data.Storage.value / 1024 / 1024 / 1024).toFixed() + ' GB'
      data.Storage.colour = "B98F53"

    } else {
      data.SysInfo = "updating"
    }

    data.Packages = json[0].DATA.Packages[0] ? "available" : "up to date"
    return data

  } catch(err) {
    return false
  }
}

async function getData(key) {
  let req = new Request('https://longview.linode.com/fetch')
  req.method = 'POST'
  req.addParameterToMultipart("api_key", key)
  req.addParameterToMultipart("api_action", 'getLatestValue')
  req.addParameterToMultipart("keys", '["CPU.*","Disk.*","Load.*","Memory.*","Network.*","SysInfo.*","Uptime","Packages"]')
  let json = await req.loadJSON()
  return await parseData(json)
}

function getUptime(seconds) {
  var d = Math.floor(seconds / 86400)
  var h = Math.floor((seconds % 86400) / 3600)
//     .toLocaleString('en-AU', { minimumIntegerDigits: 2 })
  var m = Math.floor(((seconds % 86400) % 3600) / 60)
//     .toLocaleString('en-AU', { minimumIntegerDigits: 2 })
//   return d + 'd ' + h + ':' + m
  return d + 'd ' + h + 'h ' + m + 'm'
}

function getBitsPerSec(bytes) {
	var b = 8 * bytes;
	if (b >= 1000000000) {
		return (b / 1000000000).toFixed() + ' Gb/s';
	} else if (b >= 1000000) {
		return (b / 1000000).toFixed() + ' Mb/s';
	} else if (b >= 1000) {
		return (b / 1000).toFixed() + ' Kb/s';
	}
	return b.toFixed() + ' b/s';
}

function barGraph(percent, width, height, colour) {
  let context = new DrawContext()
  context.size = new Size(width, height)
  context.setFillColor(new Color("26282C"))
  let bg = new Rect(0, 0, width, height)
  context.fillRect(bg)
  context.setFillColor(colour)
  let rect = new Rect(0, 0, width * percent / 100, height)
  context.fillRect(rect)
  return context
}

function createWidget(data) {
  let widget = new ListWidget()
  widget.url = 'https://cloud.linode.com/longview'
  widget.backgroundColor = new Color("2F3237")
  widget.setPadding(16, 16, 16, 8)

  if (data) {
    Object.entries(data).forEach(([key, value]) => {
      let stack = widget.addStack()
      let labelText = stack.addText(key)
      labelText.textColor = Color.white()
      labelText.textOpacity = 0.6
      labelText.font = Font.regularSystemFont(12)
      labelText.minimumScaleFactor = 0.5
      if (typeof value === 'object') {
        stack.addSpacer(null)
        let bodyText = stack.addText(value.value)
        bodyText.textColor = Color.white()
        bodyText.font = Font.regularSystemFont(12)
        bodyText.minimumScaleFactor = 0.5
        stack.addSpacer(8)
        let image = barGraph(value.percent, 232, 3, new Color(value.colour)).getImage()
        widget.addImage(image)
      } else {
        stack.addSpacer(null)
        let bodyText = stack.addText(value)
        bodyText.textColor = Color.white()
        bodyText.font = Font.regularSystemFont(12)
        bodyText.minimumScaleFactor = 0.5
        stack.addSpacer(8)
      }
    })
  } else {
    let error = widget.addText("Error loading data.")
    error.textColor = Color.red()
  }

  return widget
}

var data = await getData(key)
let widget = createWidget(data)
if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  widget.presentSmall()
}
Script.complete()

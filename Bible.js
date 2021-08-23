async function getVerse() {
  let url = "https://www.biblegateway.com/votd/get/?format=json&version=esvuk"
  let req = new Request(url)
  let res = await req.loadJSON()
  let ref = res.votd.reference
  let ver = res.votd.text
  ver = ver.replace(/(&ldquo;)/g, '“')
  ver = ver.replace(/(&rdquo;)/g, '”')
  ver = ver.replace(/(&#8212;)/g, '—')
  ver = ver.replace(/(&#82(?:1[6-7]|2[0-1]);)/g, '')
  ver = ver.replace(/\[.*\]\s*/g, '')
  return await [ver, ref]
}

function createWidget(ver, ref) {
  let widget = new ListWidget()
  widget.setPadding(16, 16, 16, 8)

  let fgColor = Color.white()
  let startColor = new Color("#4982D3")
  let endColor = new Color("#6E5DF7")
  let gradient = new LinearGradient()
  gradient.colors = [startColor, endColor]
  gradient.locations = [0.0, 1]
  widget.backgroundGradient = gradient

  let verText = widget.addText(ver)
  verText.textColor = fgColor
  verText.font = Font.mediumRoundedSystemFont(24)
  verText.minimumScaleFactor = 0.25
  widget.addSpacer()
  let refText = widget.addText(ref)
  refText.textColor = fgColor
  refText.font = Font.boldRoundedSystemFont(12)
  refText.textOpacity = 0.5
  refText.centerAlignText()
  refText.minimumScaleFactor = 0.5
  refText.lineLimit = 1
  return widget
}

let [ver, ref] = await getVerse()

if (config.runsInWidget) {
  let widget = createWidget(ver, ref)
  Script.setWidget(widget)
}

if (config.runsInApp) {
  ref = ref.replace(/\ /g, '+')
  ref = ref.replace(/-.*/, '')
  ref = "bible://" + ref
  let callback = new CallbackURL(ref)
  callback.open()
}

Script.complete()

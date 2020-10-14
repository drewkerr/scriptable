// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: yellow; icon-glyph: sticky-note;
async function editData(data) {
  let editor = new Alert()
  editor.title = "Sticky"
  editor.addTextField(data)
  editor.addCancelAction("Cancel")
  editor.addAction("Save")
  let action = await editor.present()
  if (action < 0) {
    return data
  } else {
    return editor.textFieldValue(0)
  }
}

function saveData(data) {
  let fm = FileManager.iCloud()
  let path = fm.joinPath(fm.documentsDirectory(), "sticky.txt")
  fm.writeString(path, data)
}

function loadData() {
  try {
    let fm = FileManager.iCloud()
    let path = fm.joinPath(fm.documentsDirectory(), "sticky.txt")
    return fm.readString(path)
  } catch(error) {
    return "Type a note..."
  }
}

function createWidget(note) {
  let widget = new ListWidget()
  widget.setPadding(16, 16, 16, 8)

  let dark = Device.isUsingDarkAppearance()
  let fgColor = Color.black()
  if (dark) {
    fgColor = new Color("#FFCF00")
    let bgColor = Color.black()
    widget.backgroundColor = bgColor
  } else {
    let startColor = new Color("#F8DE5F")
    let endColor = new Color("#FFCF00")
    let gradient = new LinearGradient()
    gradient.colors = [startColor, endColor]
    gradient.locations = [0.0, 1]
    widget.backgroundGradient = gradient
  }

  let noteText = widget.addText(note)
  noteText.textColor = fgColor
  noteText.font = Font.mediumRoundedSystemFont(24)
  noteText.textOpacity = 0.8
  noteText.minimumScaleFactor = 0.25
  return widget
}

if (config.runsInWidget) {
  let note = loadData()
  let widget = createWidget(note)
  Script.setWidget(widget)
  Script.complete()
}

if (config.runsInApp) {
  let note = loadData()
  note = await editData(note)
  saveData(note)
  Script.complete()
}
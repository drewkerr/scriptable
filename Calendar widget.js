// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: red; icon-glyph: calendar-alt;
const date = new Date()

if (config.runsInWidget) {

  let widget = new ListWidget()
  let spaces = 7
  const fontSize = 12

  let header = widget.addStack()

  // Date heading
  let df = new DateFormatter()
  df.dateFormat = "EEEE d/M"
  let dayDate = header.addText(df.string(date).toUpperCase())
  dayDate.font = Font.semiboldSystemFont(fontSize)

  header.addSpacer()

  // Get calendar events
  let events = await CalendarEvent.today([])

  // Trim (and count) events to fit: past > future > allday
  let allday = [], future = [], past = []
  events.forEach(event => {
    if (event.isAllDay) {
      allday.push(event)
    } else {
      if (event.endDate.getTime() < date.getTime()) {
        past.push(event)
      } else {
        future.push(event)
      }
    }
  })
  events = allday.splice(0, spaces)
  let extras = allday.length
  spaces -= events.length
  let append = future.splice(0, spaces)
  spaces -= append.length
  extras += future.length
  events.push(...past.splice(-spaces))
  extras += past.length
  events.push(...append)

  if (events.length != 0) {

    dayDate.textColor = Color.red()
    widget.addSpacer(8)

    // List events with times and colours
    events.forEach((event, i) => {
      let stack = widget.addStack()
      let past = event.endDate.getTime() < date.getTime()
      if (event.isAllDay) {
        let allday = stack.addText("❙")
        allday.font = Font.regularSystemFont(fontSize)
        allday.textColor = event.calendar.color
        stack.addSpacer(3)
      } else {
        let df = new DateFormatter()
        df.dateFormat = "h:mm"
        let start = stack.addText(df.string(event.startDate))
        start.font = Font.regularSystemFont(fontSize)
        start.textColor = event.calendar.color
        if (past) start.textOpacity = 0.5
        stack.addSpacer(3)
      }
      let title = stack.addText(event.title)
      title.font = Font.regularSystemFont(fontSize)
      title.lineLimit = 1
      if (past) title.textOpacity = 0.5
      if (event.location) {
        stack.addSpacer(3)
        let location = stack.addText(event.location)
        location.font = Font.thinSystemFont(fontSize)
        location.lineLimit = 1
        if (past) location.textOpacity = 0.5
      }
      // Show number of hidden events
      if (i == events.length - 1 && extras) {
        stack.addSpacer()
        let plus = stack.addText("+" + extras)
        plus.font = Font.semiboldSystemFont(fontSize)
        stack.addSpacer(8)
      }
    })
  } else {
    // TODO No events today
    dayDate.textColor = Color.blue()
  }
  
  widget.addSpacer()
  widget.setPadding(16,16,16,8)
  Script.setWidget(widget)
  widget.presentMedium()
  Script.complete()

} else {
  const appleDate = new Date('2001-01-01')
  const seconds = (date.getTime() - appleDate.getTime()) / 1000
  const callback = new CallbackURL("calshow:"+seconds)
  callback.open()
  Script.complete()
}
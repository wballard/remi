'use strict'

require('dotenv').config()
const HipchatBot = require('botbuilder-hipchat')
const builder = require('botbuilder')
const _ = require('lodash')
const moment = require('moment-timezone')
const Database = require('./database')
const debug = require('debug')('remi')
const {flattenTime, thoroughWhen, realizeTimezone} = require('./datetime')
const remind = require('./remind')
const add = require('./dialogs/add')

const INSTRUCTIONS = `
I'm sorry I didn't understand.
Ask me to remind someone to do something, that's what I'm here for.
For example:
  remind @willballard to buy more phones next thursday
`


// the database behind the app
let db = new Database(process.env.DATABASE)



// Just a robot on HipChat, remember to set up your environment variables on
// this won't work very well
let bot = new HipchatBot({
  uid: process.env.JABBER_UID,
  pwd: process.env.JABBER_PWD,
  chat_host: process.env.JABBER_CHAT_HOST,
  conference_host: process.env.JABBER_MUC_HOST
})

// run with LUIS
let dialog = new builder.LuisDialog(process.env.LUIS_MODEL)
bot.add('/', dialog)

// The main add redminder dialog, collect, who/what/when and then store it
dialog.on('AddReminder', '/AddReminder')
bot.add('/AddReminder', add(bot, db))

// let folks change their mind when the last task should be

dialog.on('ChangeWhen', '/ChangeWhen')
bot.add('/ChangeWhen', [
  // parse out the time, that's the real entity to recognize
  (session, args, next) => {
    let when = realizeTimezone(session, flattenTime(thoroughWhen(args.entities).resolution))
    if (when) {
      next(when)
    } else {
      session.endDialog()
    }
  }
  ,
  // needs to be a last reminder to change
  (session, when, next) => {
    if (session.userData.lastReminder) {
      db.deleteReminder(session.userData.lastReminder)
        .then(() => {
          session.userData.lastReminder.when = when.unix()
          return session.userData.lastReminder
        })
        .then((reminder) => {
          return db.insertReminder(
            reminder.towho,
            reminder.fromwho,
            reminder.what,
            reminder.when)
        })
        .then((reminder) => session.userData.lastReminder = reminder)
        .then(() => bot.setUserData(session.userData.identity.jid, session.userData))
        .then(() => {
          let message = `I'll change that to ${when.calendar()}`
          debug(message)
          session.send(message)
        })
        .then(() => session.endDialog())
    } else {
      session.endDialog()
    }
  }
])

// show me all my upcoming reminders
dialog.on('ListReminders', '/ListReminders')
bot.add('/ListReminders', [
  (session, args, next) => {
    bot.fullProfile(session.userData.identity.jid)
      .then((profile) => db.listReminders(session.userData.identity.jid))
      .then((reminders) => {
        if (!reminders.length) {
          let message = "You don't have any remaining reminders."
          session.send(message)
        }
        reminders.forEach((reminder, i) => {
          let reminderFrom = bot.directory[reminder.fromwho]
          let when = moment.unix(reminder.when)
          when.tz(session.userData.identity.timezone)
          let message = `${i + 1}. Reminder from @${reminderFrom.mention_name} to ${reminder.what} on ${when.calendar()} ${when.zoneAbbr()}`
          session.send(message)
        })
        session.endDialog()
      })
  }
])

// nuke a reminder
dialog.on('DeleteReminder', '/DeleteReminder')
bot.add('/DeleteReminder', [
  (session, args, next) => {
    bot.fullProfile(session.userData.identity.jid)
      .then((profile) => db.listReminders(session.userData.identity.jid))
      .then((reminders) => {
        let which = builder.EntityRecognizer.parseNumber([builder.EntityRecognizer.findEntity(args.entities, 'builtin.number')]) - 1
        if (reminders[which]) {
          session.send(`Got it, ${reminders[which].what} deleted`)
          return db.deleteReminder(reminders[which])
        } else {
          session.send('I could not find that reminder, here is the list.')
        }
      }).then((args) => {
        session.beginDialog('/ListReminders')
        session.endDialog()
    })
  }
])

// instructions when we have on idea what to do
dialog.onDefault(builder.DialogAction.send(INSTRUCTIONS))

// GO -- loop. Errors should just exit and auto-restart 
// big promise chain so each resource is ready before we move on
// starting with the database
db.open()
  // bot gets connected and listens to the hipchat server
  .then(bot.listen.bind(bot))
  // timer loop to get ready reminders, this chains past the promise to avoid double sends
  .then(() => {
    remind(bot, db)
  })

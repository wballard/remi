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
const addreminder = require('./dialogs/addreminder')
const listreminders = require('./dialogs/listreminders')
const deletereminder = require('./dialogs/deletereminder')
const changewhen = require('./dialogs/changewhen')

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
bot.add('/AddReminder', addreminder(bot, db))

// let folks change their mind when the last task should be
dialog.on('ChangeWhen', '/ChangeWhen')
bot.add('/ChangeWhen', changewhen(bot, db))

// show me all my upcoming reminders
dialog.on('ListReminders', '/ListReminders')
bot.add('/ListReminders', listreminders(bot, db))

// nuke a reminder
dialog.on('DeleteReminder', '/DeleteReminder')
bot.add('/DeleteReminder', deletereminder(bot, db))

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

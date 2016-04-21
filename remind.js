'use strict'
/*
Loop to remind folks.
*/

require('dotenv').config()
const HipchatBot = require('botbuilder-hipchat')
const builder = require('botbuilder')
const _ = require('lodash')
const moment = require('moment-timezone')
const Database = require('./database')
const debug = require('debug')('remi')
const {flattenTime, thoroughWhen, realizeTimezone} = require('./datetime')

// self scheduling timeout function
function remind (bot, db) {
  db.readyReminders()
    .then((reminders) => {
      reminders.forEach((reminder) => {
        debug(JSON.stringify(reminder))
        // this is all asynch, so we need to be sure profiles are available, if not
        // get them on the next turn
        let reminderFrom = bot.directory[reminder.fromwho]
        let reminderTo = bot.directory[reminder.towho]
        if (reminderFrom && reminderTo) {
          if (Object.is('online', reminderTo.presence) || Object.is('chat', reminderTo.presence)) {
            debug(`Reminding`, JSON.stringify(reminderTo))
            bot.send(
              reminderTo.jid.bare().toString(),
              `Reminder from @${reminderFrom.mention_name} to ${reminder.what}`)
              .then(() => db.deleteReminder(reminder))
              .then(() => bot.getUserData(reminderTo.jid))
              .then((userData) => {
                userData.lastReminder = reminder
                return bot.setUserData(reminderTo.jid, userData)
              })
              .then(() => debug('all reminded', reminder))
          } else {
            debug(`@${reminderTo.mention_name} is not available`, JSON.stringify(reminderTo))
          }
        }
      })
    })
    .then(() => {
      setTimeout(() => remind(bot, db), 10 * 1000)
    })
}
module.exports = remind

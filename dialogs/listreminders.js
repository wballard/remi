'use strict'
/*
List out all your reminders.
*/

const debug = require('debug')('remi')
const builder = require('botbuilder')
const {thoroughWhen, realizeTimezone} = require('../datetime')
const _ = require('lodash')
const moment = require('moment')

module.exports = function (bot, db) {
  return [
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
  ]
}

'use strict'
/*
Delete a reminder from your list.
*/

const debug = require('debug')('remi')
const builder = require('botbuilder')
const {thoroughWhen, realizeTimezone} = require('../datetime')
const _ = require('lodash')

module.exports = function (bot, db) {
  return [
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
]
}

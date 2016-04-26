'use strict'
/*
Change the last reminder schedule.
*/

const debug = require('debug')('remi')
const builder = require('botbuilder')
const {thoroughWhen} = require('../datetime')
const _ = require('lodash')

module.exports = function (bot, db) {
  return [
    // parse out the time, that's the real entity to recognize
    (session, args, next) => {
      let when = thoroughWhen(session, args.entities)
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
  ]
}

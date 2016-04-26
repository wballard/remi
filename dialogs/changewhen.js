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
        next([args, when])
      } else {
        session.endDialog()
      }
    }
    ,
    // either the last -- or the specific reminder will be changed
    (session, [args, when], next) => {
      let whichNumber = builder.EntityRecognizer.parseNumber([builder.EntityRecognizer.findEntity(args.entities, 'builtin.number')]) - 1
      if (whichNumber) {
        bot.fullProfile(session.userData.identity.jid)
          .then((profile) => db.listReminders(session.userData.identity.jid))
          .then((reminders) => {
            if (reminders[whichNumber]) {
              next([reminders[whichNumber], when])
            } else {
              session.send('I could not find that reminder, here is the list.')
              session.endDialog()
            }
          })
      }
      else if (session.userData.lastReminder) {
        next([session.userData.lastReminder, when])
      } else {
        session.endDialog()
      }
    }
    ,
    (session, [which, when], next) => {
      db.deleteReminder(which)
        .then(() => {
          which.when = when.unix()
        })
        .then(() => {
          return db.insertReminder(
            which.towho,
            which.fromwho,
            which.what,
            which.when)
        })
        .then(() => session.userData.lastReminder = which)
        // force save the user session, this is maybe overkill, need to understand the lifecycle better
        .then(() => bot.setUserData(session.userData.identity.jid, session.userData))
        .then(() => {
          let message = `I'll change that to ${when.calendar()}`
          debug(message)
          session.send(message)
        })
        .then(() => {
          session.endDialog()
        })
    }
  ]
}

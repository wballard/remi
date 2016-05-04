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
      bot.fullProfile(session.userData.identity.jid)
        .then((profile) => {
          debug('talking to ', JSON.stringify(profile))
          session.userData.identity = profile
          let when = thoroughWhen(session, args.entities)
          if (when) {
            next([args, when])
          }
        })
    }
    ,
    // either the last -- or the specific reminder will be changed
    (session, [args, when] , next) => {
      let numbered = builder.EntityRecognizer.findEntity(args.entities, 'builtin.number')
      if (numbered) {
        let whichNumber = builder.EntityRecognizer.parseNumber([numbered]) - 1
        bot.fullProfile(session.userData.identity.jid)
          .then((profile) => db.listReminders(session.userData.identity.jid))
          .then((reminders) => {
            if (reminders[whichNumber]) {
              next([reminders[whichNumber], when])
            } else {
              session.send('I could not find that reminder, here is the list.')
              session.beginDialog('/ListReminders')
            }
          })
      }
      else if (session.userData.lastReminder) {
        next([session.userData.lastReminder, when])
      }
    }
    ,
    (session, [which, when] , next) => {
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
          session.endDialog(message)
          next()
        })
    }
  ]
}

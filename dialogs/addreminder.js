'use strict'
/*
Add a new reminder.
*/

const debug = require('debug')('remi')
const builder = require('botbuilder')
const {thoroughWhen} = require('../datetime')
const _ = require('lodash')

module.exports = function (bot, db) {
  return [
    // fetch the creator profile and set up an initial reminder object
    (session, args, next) => {
      session.sessionState.reminder = {
        fromLUIS: args,
        what: builder.EntityRecognizer.findAllEntities(args.entities, 'activity').map((w) => w.entity).join(' ')
      }
      bot.fullProfile(session.userData.identity.jid)
        .then((profile) => {
          debug('talking to ', JSON.stringify(profile))
          session.userData.identity = profile
          next(args)
        })
    }
    ,
    // figure out who this is for, matching against the directory by name or mention_name
    // and if it isn't clear, take a wild guess that you are trying to remind yourself
    (session, args, next) => {
      let forWho = builder.EntityRecognizer.findEntity(args.entities, 'user')
      let match = undefined
      if (forWho) {
        if (Object.is(forWho.entity.toLowerCase(), 'me') || Object.is(forWho.entity.toLowerCase(), 'myself')) {
          forWho.entity = session.userData.identity.mention_name
        }
        if (forWho.entity.indexOf('@ ') == 0) forWho.entity = `@${forWho.entity.slice(2)}`
        let users = _.values(bot.directory)
        match = builder.EntityRecognizer.findBestMatch(users.map((user) => user.mention_name || ''), forWho.entity)
        || builder.EntityRecognizer.findBestMatch(users.map((user) => user.name), forWho.entity)
        if (!match) {
          session.send(`Sorry, I can't find ${forWho.entity}`).endDialog()
        } else {
          session.sessionState.reminder.who = users[match.index]
          if (Object.is(forWho.entity.toLowerCase(), match.entity.toLowerCase())) {
            next({response: true})
          } else {
            builder.Prompts.confirm(session, `Did you mean @${session.sessionState.reminder.who.mention_name}?`)
          }
        }
      } else {
        // let's just take a swag that the reminder is for you
        session.sessionState.reminder.who = session.userData.identity
        builder.Prompts.confirm(session, `Remind you?`)
      }
    }
    ,
    // do we really have a target person now?
    (session, response, next) => {
      if (response.response) {
        next()
      } else {
        session.send('Sorry about that, try again for me.').endDialog()
      }
    }
    ,
    // make sure we know when, or ask for it as it seems natural to not always
    // specify the time
    (session, response, next) => {
      let when = thoroughWhen(session, session.sessionState.reminder.fromLUIS.entities)
      if (when) {
        session.sessionState.reminder.when = when
        next(when)
      } else {
        builder.Prompts.time(session, 'When?')
      }
    }
    ,
    // time in hand, parse and normalize it
    (session, when, next) => {
      if (when.response) {
        session.sessionState.reminder.when = thoroughWhen(session, [when])
        next()
      } else if (when) {
        next()
      } else {
        session.send('Sorry, I have no idea when that is. Tell me when again.').endDialog()
      }
    }
    ,
    // echo is the new confirm! well more than that, put it in the database so it will be
    // be an actual active reminder
    (session) => {
      //just shortening below
      let who = `@${session.sessionState.reminder.who.mention_name}`
      let what = session.sessionState.reminder.what
      let when = session.sessionState.reminder.when
      bot.fullProfile(session.sessionState.reminder.who.jid)
        .then((profile) => {
          // now we have all the data and timezone information for the target person
          // stuff it in the user data, and our database
          debug('schedule for', JSON.stringify(profile))
          return db.insertReminder(
            session.sessionState.reminder.who.jid.bare().toString(),
            session.userData.identity.jid.bare().toString(),
            session.sessionState.reminder.what,
            session.sessionState.reminder.when.unix())
        })
        .then((reminder) => session.userData.lastReminder = reminder)
        .then(() => bot.setUserData(session.userData.identity.jid, session.userData))
        .then(() => {
          let message = `Got it. I'll remind ${who} to ${what} on ${when.calendar()} ${when.zoneAbbr()} `
          session.send(message)
        })
        .then(() => session.endDialog())
    }
  ]
}

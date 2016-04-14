'use strict'

require('dotenv').config()
const HipchatBot = require('botbuilder-hipchat')
const builder = require('botbuilder')
const _ = require('lodash')
const moment = require('moment')
const Database = require('./database')
const debug = require('debug')('remi')

const INSTRUCTIONS = `
I'm sorry I didn't understand.
Ask me to remind someone to do something, that's what I'm here for.
For example:
  remind @willballard to buy more phones next thursday
`

let db = new Database(process.env.DATABASE)

// Just a robot on HipChat, remember to set up your environment variables on
// this won't work very well
let bot = new HipchatBot({
  uid: process.env.JABBER_UID,
  pwd: process.env.JABBER_PWD,
  chat_host: process.env.JABBER_CHAT_HOST,
  conference_host: process.env.JABBER_MUC_HOST
})

let dialog = new builder.LuisDialog(process.env.LUIS_MODEL)
bot.add('/', dialog)

dialog.on('AddReminder', [
  // make sure this is really for somebody
  (session, args, next) => {
    bot.fullProfile(session.userData.identity.jid)
      .then((profile) => {
        debug('talking to ', JSON.stringify(profile))
        session.userData.identity = profile
        next(args)
      })
  }
  ,
  (session, args, next) => {
    debug(JSON.stringify(args))
    let forWho = builder.EntityRecognizer.findEntity(args.entities, 'user')
    let match = undefined
    if (forWho) {
      if (Object.is(forWho.entity.toLowerCase(), 'me') || Object.is(forWho.entity.toLowerCase(), 'myself')) {
        forWho.entity = session.userData.identity.mention_name
      }
      if (forWho.entity.indexOf('@ ') == 0) forWho.entity = `@${forWho.entity.slice(2)}`
      let users = _.values(bot.directory)
      match = builder.EntityRecognizer.findBestMatch(users.map((user) => user.mention_name), forWho.entity)
      || builder.EntityRecognizer.findBestMatch(users.map((user) => user.name), forWho.entity)
      if (!match) {
        session.send(`Sorry, I can't find ${forWho.entity}`).endDialog()
      } else {
        session.sessionState.reminder = {
          fromLUIS: args,
          who: users[match.index],
          what: builder.EntityRecognizer.findAllEntities(args.entities, 'activity').map((w) => w.entity).join(' ')
        }
        if (Object.is(forWho.entity.toLowerCase(), match.entity.toLowerCase())) {
          next({match: true})
        } else {
          builder.Prompts.confirm(session, `Did you mean @${session.sessionState.reminder.who.mention_name}?`)
        }
      }
    } else {
      session.send("Sorry, I can't tell who you mean, try a mention name.").endDialog()
    }
  }
  ,
  // do we really have a target person now?
  (session, response, next) => {
    if (response.match) {
      next()
    } else if (response.response) {
      next()
    } else {
      session.send('Sorry about that, try again for me.').endDialog()
    }
  }
  ,
  // make sure we know when
  (session, response, next) => {
    let when = builder.EntityRecognizer.findEntity(session.sessionState.reminder.fromLUIS.entities, 'builtin.datetime.time') ||
    builder.EntityRecognizer.findEntity(session.sessionState.reminder.fromLUIS.entities, 'builtin.datetime.date') ||
    builder.EntityRecognizer.findEntity(session.sessionState.reminder.fromLUIS.entities, 'builtin.datetime.datetime')
    if (when) {
      session.sessionState.reminder.when = builder.EntityRecognizer.recognizeTime(when.entity)
      next({response: session.sessionState.reminder.when})
    } else {
      builder.Prompts.time(session, 'When?')
    }
  }
  ,
  (session, when, next) => {
    if (when.response && when.response.resolution) {
      session.sessionState.reminder.when = when.response.resolution.start || when.response.resolution.date
      next()
    } else {
      session.send('Sorry, I have no idea when that is. Tell me when again.').endDialog()
    }
  }
  ,
  // echo is the new confirm
  (session) => {
    let who = `@${session.sessionState.reminder.who.mention_name}`
    let what = session.sessionState.reminder.what
    let when = moment(session.sessionState.reminder.when)
    debug(session.sessionState.reminder.when)
    // convert from this time zone away from the local system difference with the requesting user
    let offsetMinutes = when.utcOffset() - (session.userData.identity.timezone)
    when.add(offsetMinutes, 'm')
    // and set to the requestor timezone
    when.utcOffset(session.userData.identity.timezone)
    debug(`Got it. I'll remind ${who}, ${when.calendar()} to ${what}`)
    session.send(`Got it. I'll remind ${who}, ${when.calendar()} to ${what}`)
    // need the full profile to get the target timezone
    bot.fullProfile(session.sessionState.reminder.who.jid)
      .then((profile) => {
        // now we have all the data and timezone information for the target person
        debug('schedule for', JSON.stringify(profile))
        return db.insertReminder(
          session.sessionState.reminder.who.jid.bare().toString(),
          session.userData.identity.jid.bare().toString(),
          what,
          when.unix())
      })
    session.endDialog()
  }
])

dialog.onDefault(builder.DialogAction.send(INSTRUCTIONS))

// GO -- loop. Errors should just exit and auto-restart 
db.open()
  .then(bot.listen.bind(bot))
  // timer loop to get ready reminders, this chains past the promise to avoid double sends
  .then(() => {
    let remind = function () {
      db.readyReminders()
        .then((reminders) => {
          debug(JSON.stringify(reminders))
          reminders.forEach((reminder) => {
            // this is all asynch, so we need to be sure profiles are available, if not
            // get them on the next turn
            let reminderFrom = bot.directory[reminder.fromwho]
            let reminderTo = bot.directory[reminder.towho]
            if (reminderFrom && reminderTo) {
              if (Object.is('online', reminderTo.presence)) {
                debug(`Reminding`, JSON.stringify(reminderTo))
                bot.send(
                  reminder.towho,
                  `Reminder from @${reminderFrom.mention_name} ${reminder.what}`)
                  .then(() => {
                    debug('delete', reminder)
                  })
              } else {
                debug( `@${reminderTo.mention_name} is not available`)
              }
            }
          })
        })
        .then(() => {
          setTimeout(remind, 60 * 1000)
        })
    }
    // kickoff
    remind()
  })

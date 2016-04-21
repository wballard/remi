'use strict'

const builder = require('botbuilder')
const _ = require('lodash')
const moment = require('moment-timezone')
const debug = require('debug')('remi')

/**
 * Try really hard to parse for date entities.
 * 
 * @param entities - entities extracted from LUIS
 * @returns - a date or nothing
 */
function thoroughWhen (entities) {
  try {
    let when =
    builder.EntityRecognizer.findEntity(entities, 'when::datetime') ||
    builder.EntityRecognizer.findEntity(entities, 'builtin.datetime.time') ||
    builder.EntityRecognizer.findEntity(entities, 'builtin.datetime.date') ||
    builder.EntityRecognizer.findEntity(entities, 'builtin.datetime.datetime')
    return builder.EntityRecognizer.resolveTime([when]) || builder.EntityRecognizer.recognizeTime(when.entity).resolution.start
  } catch(e) {
    debug(e)
    return undefined
  }
}

/**
 * This server can be in a different timezone that the user. Adjust for this
 * by comparing the time zone difference and adjusting the number of minutes.
 * 
 * @param session (description)
 * @param when (description)
 */
function realizeTimezone (session, when) {
  if (when) {
    // convert from this time zone away from the local system difference with the requesting user
    debug('user in', session.userData.identity.timezone, 'remi in', moment.tz.guess())
    let ret = moment.tz(when.toISOString().substring(0, 19), 'YYYY-MM-DDTHH:mm:ss', session.userData.identity.timezone)
    return ret
  } else {
    return undefined
  }
}

module.exports = {
  thoroughWhen,
  realizeTimezone
}

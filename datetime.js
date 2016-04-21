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
  let when =
  builder.EntityRecognizer.findEntity(entities, 'when::datetime') ||
  builder.EntityRecognizer.findEntity(entities, 'builtin.datetime.time') ||
  builder.EntityRecognizer.findEntity(entities, 'builtin.datetime.date') ||
  builder.EntityRecognizer.findEntity(entities, 'builtin.datetime.datetime')
  return builder.EntityRecognizer.recognizeTime((when || {}).entity) || when
}

/**
 * This server can be in a different timezone that the user. Adjust for this
 * by comparing the time zone difference and adjusting the number of minutes.
 * 
 * @param session (description)
 * @param when (description)
 */
function realizeTimezone (session, when) {
  // convert from this time zone away from the local system difference with the requesting user
  debug('user in', session.userData.identity.timezone, 'remi in', moment.tz.guess())
  let ret = moment.tz(moment(when).format('YYYYMMDDHHmmss'), 'YYYYMMDDHHmmss', session.userData.identity.timezone)
  return ret
}

/**
 * Flatten out the different times that can come back from LUIS, most important
 * mark time as UTC if unmarked.
 * 
 * @param resolution (description)
 */
function flattenTime (resolution) {
  if (resolution.time) {
    return `${resolution.time}Z`
  } else {
    return resolution.start || resolution.date
  }
}

module.exports = {
  thoroughWhen,
  realizeTimezone,
  flattenTime
}
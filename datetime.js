'use strict'

const builder = require('botbuilder')
const _ = require('lodash')
const moment = require('moment-timezone')
const debug = require('debug')('remi')

/**
 * Try really hard to parse for date entities. Dates don't seem to time zone offset
 * so there is a touchup there 
 * 
 * @param session - user session, look up the timezone here
 * @param entities - entities extracted from LUIS
 * @returns - a date or nothing
 */
function thoroughWhen (session, entities) {
  try {
    let maybeDate = builder.EntityRecognizer.findEntity(entities, 'builtin.datetime.date')
    if (maybeDate) {
      let utcMidnight = builder.EntityRecognizer.resolveTime([maybeDate])
      let localMidnight = moment.tz(`${utcMidnight.toISOString().substring(0, 19)}`, 'YYYY-MM-DDTHH:mm:ss', session.userData.identity.timezone)
      return localMidnight.add(12, 'h')
    }
    let when =
    builder.EntityRecognizer.findEntity(entities, 'when::datetime') ||
    builder.EntityRecognizer.findEntity(entities, 'builtin.datetime.time') ||
    builder.EntityRecognizer.findEntity(entities, 'builtin.datetime.datetime')
    let remiTime = builder.EntityRecognizer.resolveTime([when]) || builder.EntityRecognizer.recognizeTime(when.entity).resolution.start
    return moment.tz(`${remiTime.toISOString().substring(0, 19)}Z`, 'YYYY-MM-DDTHH:mm:ssZ', session.userData.identity.timezone)
  } catch(e) {
    debug(e)
    return undefined
  }
}

module.exports = {
  thoroughWhen
}

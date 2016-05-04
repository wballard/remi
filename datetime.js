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
  debug('processing dates', JSON.stringify(entities))
  let alterTimezone = (remiTime, suffix = 'Z') => {
    debug('date looks like this in UTC', remiTime)
    return moment.tz(`${remiTime.toISOString().substring(0, 19)}${suffix}`, `YYYY-MM-DDTHH:mm:ss${suffix}`, session.userData.identity.timezone)
  }
  // check first for a full phrase recognition
  let datetime = builder.EntityRecognizer.findEntity(entities, 'when::datetime')
  || builder.EntityRecognizer.findEntity(entities, 'when')
  || builder.EntityRecognizer.findEntity(entities, 'builtin.datetime.datetime')
  let date = builder.EntityRecognizer.findEntity(entities, 'builtin.datetime.date')
  let time = builder.EntityRecognizer.findEntity(entities, 'builtin.datetime.time')

  // this is effectively a kind of try/parse
  if (datetime) {
    return alterTimezone(builder.EntityRecognizer.recognizeTime(datetime.entity).resolution.start, '')
  }
  if (date && time) {
    return alterTimezone(builder.EntityRecognizer.recognizeTime(`${date.entity} ${time.entity}`).resolution.start, '')
  }
  if (date) {
    let utcResolvedTime = builder.EntityRecognizer.recognizeTime(date.entity).resolution.start
    if (utcResolvedTime) {
      let localResolvedTime = alterTimezone(utcResolvedTime, '')
      // when it is just a day, set it to local noon
      return localResolvedTime.set('hour', 12)
    }
  }
  if (time) {
    if (time.resolution.time) {
      try {
        return alterTimezone(moment(time.resolution.time, 'THH').toDate(), '')
      } catch (e) {
        console.error(e)
      }
    }
    let entity = builder.EntityRecognizer.recognizeTime(time.entity)
    let utcResolvedTime = entity.resolution.start
    if (utcResolvedTime) {
      return alterTimezone(utcResolvedTime, '')
    }
  }
  // the ultra backup case in case we totally missed it
  let utcResolvedTime = builder.EntityRecognizer.resolveTime(entities)
  if (utcResolvedTime) {
    return alterTimezone(utcResolvedTime, '')
  } else {
    return undefined
  }
}

module.exports = {
thoroughWhen}

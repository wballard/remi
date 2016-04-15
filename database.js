'use strict'

/*
A very simple database that will store reminders with who/what/when, that is simply
polled to figure if it is time for the bot to talk to someone. 

Time is stored in the one true unix tick format. Thanks.

Except for the constructor, all the methods return a Promise.

Net: conversations from the future, shoved in a table.
*/

const sqlite3 = require('sqlite3').verbose()
const Promise = require('bluebird')
const EventEmitter = require('events')
const moment = require('moment')

module.exports =

  class Database extends EventEmitter {

    /**
     * Creates an instance of Database.
     * 
     * @param filename - just a path to the database file
     */
    constructor (filename) {
      super()
      this.filename = filename
    }

    /**
     * Open up and make the database right.
     * @returns {Promise} - when resolved, the database is ready to go 
     */
    open () {
      return Promise.fromNode((callback) => {
        this.db = new sqlite3.Database(this.filename, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, callback)
      }
      ).then(() => {
        return Promise.fromNode((callback) => {
          this.db.run(`
            CREATE TABLE IF NOT EXISTS reminder(
              towho TEXT,
              fromwho TEXT,
              what TEXT,
              [when] INTEGER
            )
          `, callback)
        })
      }).then(() => {
        this.inserter = this.db.prepare('INSERT INTO reminder(towho, fromwho, what, [when]) VALUES(?,?,?,?)')
        this.reminderer = this.db.prepare('SELECT towho, fromwho, what, [when] FROM reminder WHERE [when] < ?')
        this.deleter = this.db.prepare('DELETE FROM reminder WHERE towho=? AND fromwho=? AND what=? AND [when]=?')
      })
    }

    /**
     * Make a new reminder row.
     * @param  {String} towho
     * @param  {String} fromwho
     * @param  {String} what
     * @param  {Number} when
     */
    insertReminder (towho, fromwho, what, when) {
      return Promise.fromNode((callback) => {
        this.inserter.run(towho, fromwho, what, when, callback)
      }).then(() => {
        return {
          towho,
          fromwho,
          what,
          when 
        }
      })
    }

    /**
     * Get all reminders that are at their time, and are good to send.
     * @returns {Promise} - resolves to an array of reminders
     */
    readyReminders () {
      return Promise.fromNode((callback) => {
        this.reminderer.all(moment().unix()).all(callback)
      })
    }

    /**
     * Goodbye, cruel reminder...
     * 
     * @param reminder (description)
     */
    deleteReminder (reminder) {
      return Promise.fromNode((callback) => {
        this.deleter.run(reminder.towho, reminder.fromwho, reminder.what, reminder.when, callback)
      })
    }

}

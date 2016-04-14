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
              who TEXT,
              what TEXT,
              [when] INTEGER
            )
          `, callback)
        })
      }).then(() => {
        this.inserter = this.db.prepare('INSERT INTO reminder(who, what, [when]) VALUES(?,?,?)')
        this.reminderer = this.db.prepare('SELECT who, what FROM reminder WHERE [when] < ?')
      })
    }


    /**
     * Make a new reminder row.
     * @param  {String} who
     * @param  {String} what
     * @param  {Number} when
     */
    insertReminder (who, what, when) {
      return Promise.fromNode((callback) => {
        this.inserter.run(who, what, when, callback)
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

}

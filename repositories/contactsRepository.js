const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dataFilePath = path.resolve(__dirname, '..', 'data', 'contacts.db');

// Create the database and contacts table if not exists
const db = new sqlite3.Database(dataFilePath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database');
    db.run(`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        firstName TEXT,
        lastName TEXT,
        emailAddress TEXT,
        notes TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )
    `);
  }
});

function getAllContacts(callback) {
  const query = 'SELECT * FROM contacts';
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error querying database:', err.message);
      callback([]);
    } else {
      callback(rows);
    }
  });
}

function getContactById(id, callback) {
  const query = 'SELECT * FROM contacts WHERE id = ?';
  db.get(query, [id], (err, row) => {
    if (err) {
      console.error('Error querying database:', err.message);
      callback(null);
    } else {
      callback(row);
    }
  });
}

function createContact(newContact, callback) {
  const query = `
    INSERT INTO contacts (id, firstName, lastName, emailAddress, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  db.run(
    query,
    [
      newContact.id,
      newContact.firstName,
      newContact.lastName,
      newContact.emailAddress,
      newContact.notes,
      newContact.createdAt.toISOString(),
      newContact.updatedAt.toISOString(),
    ],
    (err) => {
      if (err) {
        console.error('Error inserting into database:', err.message);
        callback(null);
      } else {
        callback(newContact);
      }
    }
  );
}

function updateContact(updatedContact, callback) {
  const query = `
    UPDATE contacts
    SET firstName = ?, lastName = ?, emailAddress = ?, notes = ?, updatedAt = ?
    WHERE id = ?
  `;
  db.run(
    query,
    [
      updatedContact.firstName,
      updatedContact.lastName,
      updatedContact.emailAddress,
      updatedContact.notes,
      updatedContact.updatedAt.toISOString(),
      updatedContact.id,
    ],
    (err) => {
      if (err) {
        console.error('Error updating database:', err.message);
        callback(null);
      } else {
        callback(updatedContact);
      }
    }
  );
}

function deleteContact(id, callback) {
  const query = 'DELETE FROM contacts WHERE id = ?';
  db.run(query, [id], (err) => {
    if (err) {
      console.error('Error deleting from database:', err.message);
      callback(false);
    } else {
      callback(true);
    }
  });
}
//
function generateId() {
  return `generated-id-${Date.now()}`;
}

module.exports = {
  getAllContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
};


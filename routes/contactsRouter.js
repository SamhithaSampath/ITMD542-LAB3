const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid'); // Import the v4 function from uuid
const sanitizeHtml = require('sanitize-html');
const Contact = require('../models/contact'); 


// Establish a connection to the SQLite database
const db = new sqlite3.Database('./data/contacts.db', (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Middleware to attach the database connection to the request object
router.use((req, res, next) => {
  req.db = db;
  next();
});

/* Validation function to check if required fields are present and non-numeric */
function validateContactData(data) {
  const { firstName, lastName, emailAddress } = data;
  const isNonEmptyString = value => typeof value === 'string' && value.trim() !== '';
  const containsOnlyLetters = value => /^[A-Za-z]+$/.test(value);
  const isNonNumericFirstName = isNonEmptyString(firstName) && containsOnlyLetters(firstName);
  const isNonNumericLastName = isNonEmptyString(lastName) && containsOnlyLetters(lastName);
  const isInvalidEmail = emailAddress && (!/^\S+@\S+\.\S+$/.test(emailAddress) || !/^[a-z]/.test(emailAddress));

  let errorMessage = 'Please correct the following issues:';
  if (!isNonNumericFirstName) errorMessage += ' First name should contain only letters.';
  if (!isNonNumericLastName) errorMessage += ' Last name should contain only letters.';
  if (isInvalidEmail) errorMessage += ' Email address should start with a lowercase letter and provide a valid email address.';

  return { isValid: isNonNumericFirstName && isNonNumericLastName && !isInvalidEmail, errorMessage };
}


/* Sanitize user input */
function sanitizeContactData(data) {
 return {
    firstName: sanitizeHtml(data.firstName.trim(), { allowedTags: [], allowedAttributes: {} }),
    lastName: sanitizeHtml(data.lastName.trim(), { allowedTags: [], allowedAttributes: {} }),
    emailAddress: sanitizeHtml(data.emailAddress.trim(), { allowedTags: [], allowedAttributes: {} }),
    notes: sanitizeHtml(data.notes.trim(), { allowedTags: ['b', 'i', 'em', 'strong', 'a'], allowedAttributes: { 'a': ['href'] } }),
  };
}

/* Route to list all contacts */
router.get('/', (req, res) => {
  try {
    // Fetch all contacts from the SQLite database
    db.all('SELECT * FROM contacts', (err, rows) => {
      if (err) {
        console.error('Error retrieving contacts from SQLite:', err);
        return res.status(500).send('Internal Server Error');
      }
      res.render('contacts/index', { contacts: rows, layout: 'layout' });
    });
  } catch (error) {
    console.error('Error retrieving contacts:', error);
    res.status(500).send('Internal Server Error');
  }
});

/* Route to render a form for creating a new contact */
router.get('/new', (req, res) => {
  res.render('contacts/new', { layout: 'layout' });
});

/* Route to handle creating a new contact */
router.post('/', (req, res) => {
  try {
    const { firstName, lastName, emailAddress, notes } = req.body;
    const validationResult = validateContactData(req.body);

    if (!validationResult.isValid) {
      return res.render('contacts/new', { errorMessage: validationResult.errorMessage, layout: 'layout' });
    }

    const sanitizedData = sanitizeContactData(req.body);
    const newContact = new Contact(sanitizedData.firstName, sanitizedData.lastName, sanitizedData.emailAddress, sanitizedData.notes);

    // Generate a unique ID using uuidv4()
    const uniqueId = uuidv4();

    const currentDate = new Date().toISOString(); // Updated to use ISO format

    // Insert the new contact into the SQLite database with the unique ID and current date
    db.run('INSERT INTO contacts (id, firstName, lastName, emailAddress, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uniqueId, newContact.firstName, newContact.lastName, newContact.emailAddress, newContact.notes, currentDate, currentDate],
      function (err) {
        if (err) {
          console.error('Error inserting contact into SQLite:', err);
          return res.status(500).send('Failed to create contact');
        }
        res.redirect('/contacts');
      });
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).send('Internal Server Error');
  }
});

/* Route to view a single contact */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    console.log('Requested contact ID:', id);

    // Fetch the contact from the SQLite database using the provided ID
    db.get('SELECT * FROM contacts WHERE id = ?', [id], (err, contact) => {
      if (err) {
        console.error('Error retrieving contact from SQLite:', err);
        return res.status(500).send('Internal Server Error');
      }

      if (!contact) {
        // Handle the case where the contact is not found
        return res.status(404).send('Contact not found');
      }

      // Format createdAt and updatedAt dates for better readability
      const formattedContact = {
        ...contact,
        createdAt: new Date(contact.createdAt).toLocaleString(),
        updatedAt: new Date(contact.updatedAt).toLocaleString(),
      };

      res.render('contacts/show', { contact: formattedContact, layout: 'layout' });
    });
  } catch (error) {
    console.error('Error retrieving contact:', error);
    res.status(500).send('Internal Server Error');
  }
});





/* Route to render a form for editing an existing contact */
router.get('/:id/edit', (req, res) => {
  try {
    const { id } = req.params;
    // Fetch the contact from the SQLite database using the provided ID
    db.get('SELECT * FROM contacts WHERE id = ?', [id], (err, contact) => {
      if (err) {
        console.error('Error retrieving contact from SQLite:', err);
        return res.status(500).send('Internal Server Error');
      }

      if (!contact) {
        // Handle the case where the contact is not found
        return res.status(404).send('Contact not found');
      }

      res.render('contacts/edit', { contact, layout: 'layout' });
    });
  } catch (error) {
    console.error('Error retrieving contact for editing:', error);
    res.status(500).send('Internal Server Error');
  }
});


/* Route to handle updating an existing contact */
router.post('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, emailAddress, notes } = req.body;
    const validation = validateContactData(req.body);

    if (!validation.isValid) {
      return res.render('contacts/edit', { errorMessage: validation.errorMessage, layout: 'layout' });
    }

    const sanitizedData = sanitizeContactData(req.body);

    // Fetch the existing contact from the SQLite database
    db.get('SELECT * FROM contacts WHERE id = ?', [id], (err, existingContact) => {
      if (err) {
        console.error('Error retrieving contact from SQLite:', err);
        return res.status(500).send('Internal Server Error');
      }

      if (!existingContact) {
        // Handle the case where the contact is not found
        res.status(404).send('Contact not found');
        return;
      }

      const currentDate = new Date().toISOString(); // Updated to use ISO format

      // Update the existing contact in the SQLite database with the current date
      db.run('UPDATE contacts SET firstName = ?, lastName = ?, emailAddress = ?, notes = ?, updatedAt = ? WHERE id = ?',
        [sanitizedData.firstName, sanitizedData.lastName, sanitizedData.emailAddress, sanitizedData.notes, currentDate, id],
        function (err) {
          if (err) {
            console.error('Error updating contact in SQLite:', err);
            return res.status(500).send('Failed to update contact');
          }
          res.redirect(`/contacts/${id}`);
        });
    });
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).send('Internal Server Error');
  }
});

/* Route to handle deleting a contact */
router.post('/:id/delete', (req, res) => {
  try {
    const { id } = req.params;

    // Validate if the ID is not null or undefined
    if (!id) {
      console.error('Invalid contact ID for deletion:', id);
      return res.status(400).send('Invalid contact ID');
    }

    // Delete the contact from the SQLite database using the provided ID
    db.run('DELETE FROM contacts WHERE id = ?', [id], function (err) {
      if (err) {
        console.error('Error deleting contact from SQLite:', err);
        return res.status(500).send('Failed to delete contact');
      }
      res.redirect('/contacts');
    });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).send('Internal Server Error');
  }
});


/* Route to handle viewing a dynamically generated contact */
router.get('/generated/:id', (req, res) => {
  try {
    // Get the dynamically generated ID from the URL
    const dynamicId = req.params.id;

    // Logic to fetch the dynamically generated contact from the SQLite database
    db.get('SELECT * FROM contacts WHERE id = ?', [dynamicId], (err, generatedContact) => {
      if (err) {
        console.error('Error retrieving generated contact from SQLite:', err);
        return res.status(500).send('Internal Server Error');
      }

      if (!generatedContact) {
        // Handle the case where the contact is not found
        res.status(404).send('Generated Contact not found');
        return;
      }

      res.render('contacts/show', { contact: generatedContact, layout: 'layout' });
    });
  } catch (error) {
    console.error('Error retrieving generated contact:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Close the SQLite database connection when the Node.js process exits
process.on('exit', () => {
  db.close();
});

module.exports = router;

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db.json');

// Serve static files from the parent directory
app.use(express.static(path.join(__dirname, '..')));
app.use(express.json());

// API endpoint to increment user count
app.post('/api/visit', (req, res) => {
  fs.readFile(DB_PATH, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error reading database');
    }
    const db = JSON.parse(data);
    db.userCount++;
    fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error writing to database');
      }
      res.status(200).send({ userCount: db.userCount });
    });
  });
});

// API endpoint to get user count
app.get('/api/stats', (req, res) => {
  fs.readFile(DB_PATH, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error reading database');
    }
    const db = JSON.parse(data);
    res.status(200).send({ userCount: db.userCount });
  });
});

// API endpoint om budgetgegevens op te halen
app.get('/api/budgets/1', (req, res) => {
  fs.readFile(DB_PATH, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error reading database');
    }
    const db = JSON.parse(data);
    const budget = db.budgets ? db.budgets[0] : null; // Uitgaande van budget op index 0 voor ID 1
    if (budget) {
      res.status(200).json(budget);
    } else {
      res.status(404).send('Budget not found');
    }
  });
});

// API endpoint om budgetgegevens bij te werken
app.put('/api/budgets/1', (req, res) => {
  const updatedBudget = req.body;
  fs.readFile(DB_PATH, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error reading database');
    }
    const db = JSON.parse(data);
    if (!db.budgets) {
      db.budgets = [];
    }
    // Uitgaande dat we altijd het eerste budget bijwerken/aanmaken voor ID 1
    if (db.budgets.length === 0) {
      db.budgets.push(updatedBudget);
    } else {
      db.budgets[0] = updatedBudget;
    }

    fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error writing to database');
      }
      res.status(200).json(updatedBudget);
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

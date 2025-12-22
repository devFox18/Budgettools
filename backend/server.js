const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db.json');

// Serve static files from the parent directory
app.use(express.static(path.join(__dirname, '..')));

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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

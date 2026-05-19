// Planted bad code for semgrep to detect.
const express = require('express');
const app = express();

app.post('/exec', (req, res) => {
  // Planted: eval of user input
  const result = eval(req.body.code);
  res.send(result);
});

app.get('/redirect', (req, res) => {
  // Planted: open redirect
  res.redirect(req.query.url);
});

module.exports = app;

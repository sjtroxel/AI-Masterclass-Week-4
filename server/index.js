const express = require('express');
const cors = require('cors');
const gameRouter = require('./routes/game');

const app = express();
const PORT = 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use('/api/game', gameRouter);

app.listen(PORT, () => {
  console.log(`ChronoQuizzr Brain listening on http://localhost:${PORT}`);
});

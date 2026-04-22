const express = require('express');
const cors = require('cors');
const path = require('path');
const { setupWebSocket, getBroadcastFunction } = require('./app/ws/websocket');
const { initializeAccounts, logInAccounts } = require('./app/steam/login');
const apiRoutes = require('./app/routes/api');
const { initDatabase } = require('./app/db/accountModel');
initDatabase();
const app = express();
const port = 3001;

app.use(cors());
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use(express.json());
app.use('/api', apiRoutes);

initializeAccounts();

const server = app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  setupWebSocket(server);

  const broadcastStatus = getBroadcastFunction();
  logInAccounts(broadcastStatus);
});

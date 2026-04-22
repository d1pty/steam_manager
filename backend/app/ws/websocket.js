const WebSocket = require('ws');
let wss = null;

const setupWebSocket = (server) => {
  wss = new WebSocket.Server({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });
};

const getBroadcastFunction = () => {
  return (status) => {
    if (!wss) return;

    const message = JSON.stringify(status);
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };
};

module.exports = {
  setupWebSocket,
  getBroadcastFunction,
};

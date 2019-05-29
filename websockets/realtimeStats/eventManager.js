taskRouter = require("../../common/taskRouter");

function handleConnection(webSocketClient, twilioClient) {
  // setup ping response
  webSocketClient.isAlive = true;
  webSocketClient.on("pong", () => {
    webSocketClient.isAlive = true;
  });

  webSocketClient.send(JSON.stringify(taskRouter.getCurrentQueueStats()));

  // Create handler for events coming in on this socket connection
  webSocketClient.on("message", data =>
    handleIncomingMessage(data, webSocketClient)
  );
}

function handleIncomingMessage(data, webSocketClient) {
  // if not an object, echo back to originating client
  var socketResponse = "echo: " + data;
  webSocketClient.send(socketResponse);
}

module.exports = { handleConnection };

taskRouter = require("./taskRouter");

var iterations = 5;

function setCORSHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Method", "OPTIONS POST GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function setupHeartbeatMonitor(name, websocketServer, timeout) {
  setInterval(function ping() {
    console.debug(
      name + " heartbeat, active clients: " + websocketServer.clients.size
    );
    websocketServer.clients.forEach(function each(webSocketClient) {
      if (webSocketClient.isAlive === false) {
        console.warn(
          "Possible network issue: webSocketClient timed out after 30 seconds, terminating"
        );

        return webSocketClient.terminate();
      }

      webSocketClient.isAlive = false;
      webSocketClient.ping(() => {});
    });
  }, timeout);
}

function setupQueueStatsSchedule(websocketServer, timeout, twilioClient) {
  setInterval(function fetchQueueStats() {
    let startTime = new Date();
    var withCumulative = iterations < 5 ? false : true;
    iterations = iterations < 5 ? ++iterations : 0;
    taskRouter
      .fetchAllQueueStatistics(twilioClient, withCumulative)
      .then(queueStats => {
        console.log("Time taken to retrieve stats: ", new Date() - startTime);
        websocketServer.clients.forEach(function each(webSocketClient) {
          if (webSocketClient.readyState === webSocketClient.OPEN) {
            webSocketClient.send(JSON.stringify(queueStats));
          }
        });
      });
  }, timeout);
}

module.exports = {
  setCORSHeaders,
  setupHeartbeatMonitor,
  setupQueueStatsSchedule
};

function setResponseHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Method", "OPTIONS POST GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function noop() {}

function heartbeat() {
  this.isAlive = true;
}

module.exports = { setResponseHeaders, noop, heartbeat };

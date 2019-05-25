var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");

var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");
var callStatusCallbackHandler = require("./routes/callStatusCallbackHandler");
var callHandlerTwiml = require("./routes/callHandlerTwiml");

var tools = require("./common/tools");

const twilioClient = require("twilio")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

var app = express();

//for websocket management
var ws = require("ws");
var wss = new ws.Server({ noServer: true });
var callWebSocketMapping = new Map();

console.info("AccountSid: " + process.env.TWILIO_ACCOUNT_SID);
console.info(
  "Auth Token: " + process.env.TWILIO_AUTH_TOKEN.slice(0, 5) + "..."
);
console.info("Backend: " + process.env.EXTERNAL_HOST);

app.set("wss", wss);
app.set("callWebSocketMapping", callWebSocketMapping);
app.set("twilioClient", twilioClient);

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/callStatusCallbackHandler", callStatusCallbackHandler);
app.use("/callHandlerTwiml", callHandlerTwiml);

//added for establishing websocket
app.use("/outboundDialWebsocket", function(req, res, next) {
  res.websocket(function(webSocketClient) {
    console.debug("New outboundDialWebsocket connection created");
    webSocketClient.send("new connection established");
  });
});

// setup message echo to originating client
wss.on("connection", function connection(webSocketClient) {
  // setup ping response
  webSocketClient.isAlive = true;
  webSocketClient.on("pong", tools.heartbeat);

  // Create handler for events coming in
  webSocketClient.on("message", function handleIncomingMessage(data) {
    try {
      data = JSON.parse(data);

      if (
        data.method === "call" &&
        data.to &&
        data.from &&
        data.workerContactUri
      ) {
        twilioClient.calls
          .create({
            url: encodeURI(
              "https://" +
                process.env.EXTERNAL_HOST +
                "/callHandlerTwiml?workerContactUri=" +
                data.workerContactUri
            ),
            to: data.to,
            from: data.from,
            statusCallback:
              "https://" +
              process.env.EXTERNAL_HOST +
              "/callStatusCallbackHandler",
            // do the statusCallback for the above URL for the events below
            statusCallbackEvent: ["ringing", "answered", "completed"]
          })
          .then(call => {
            console.debug("\tcall created: ", call.sid);
            console.debug("\t\tto:\t", call.to);
            console.debug("\t\tfrom:\t", call.from);
            console.debug("\t\tstatus:\t", call.status.toString());

            var response = JSON.stringify({
              messageType: "callUpdate",
              callSid: call.sid,
              callStatus: call.status.toString()
            });

            callWebSocketMapping.set(call.sid, webSocketClient);

            //send call ID and status back to originating client
            webSocketClient.send(response);
          })
          .catch(error => {
            console.error("\tcall creation failed");
            console.error("\tERROR: ", error);
            webSocketClient.send(
              JSON.stringify({ messageType: "error", message: error.message })
            );
          });
      } else if (data.method === "hangup" && data.callSid) {
        twilioClient
          .calls(data.callSid)
          .update({ status: "completed" })
          .then(call => {
            console.debug("\tcall terminated: ", call.sid);
            console.debug("\t\tto:\t", call.to);
            console.debug("\t\tfrom:\t", call.from);
            console.debug("\t\tstatus:\t", call.status.toString());
          })
          .catch(error => {
            console.error("\tcall failed to terminate: ", data.callSid);
            console.error("\tERROR: ", error);
            webSocketClient.send(
              JSON.stringify({ messageType: "error", message: error.message })
            );
          });
      } else {
        var response = "Unrecognized payload: " + data;
        console.warn(response);
        webSocketClient.send(response);
      }
    } catch (e) {
      // if not an object, echo back to originating client
      webSocketClient.send("echo: " + data);
    }
  });
});

// setup keep alive timeout of 30 seconds
setInterval(function ping() {
  console.debug("heartbeat clients: ", wss.clients.size);
  wss.clients.forEach(function each(webSocketClient) {
    if (webSocketClient.isAlive === false) {
      console.warn(
        "Possible network issue: webSocketClient timed out after 30 seconds, terminating"
      );
      // remove timed out client from map redundent as call complete event will clear it however this should be added later for a long running production system wherever its possible over time a callback may fail to connect due to network issues or some other unforseen variable
      return webSocketClient.terminate();
    }

    webSocketClient.isAlive = false;
    webSocketClient.ping(tools.noop);
  });
}, 30000);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = { app, wss };

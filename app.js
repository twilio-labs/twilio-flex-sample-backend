var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");

// add new routes
var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");
var callStatusCallbackHandler = require("./routes/callStatusCallbackHandler");
var callHandlerTwiml = require("./routes/callHandlerTwiml");

// add websocket handlers
var tools = require("./common/tools");
var ws = require("ws");

// init twilio client
const twilioClient = require("twilio")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

var app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// map traditional routes
app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/callStatusCallbackHandler", callStatusCallbackHandler);
app.use("/callHandlerTwiml", callHandlerTwiml);

//map webSocket endpoints to upgrade connecion to websocket
app.use("/outboundDialWebsocket", function(req, res, next) {
  res.websocket(function(webSocketClient) {
    console.debug("New outboundDialWebsocket connection created");
    webSocketClient.send("new connection established");
  });
});

/**
 *  Outbound dialing websocket
 *
 */

// init websocket server dedicated to outbound dialing
var outboundDialingWSS = new ws.Server({ noServer: true });
var outboundWSSHandler = require("./websockets/outboundDialWebSocket/eventManager");
var callWebSocketMapping = new Map();

// setup message echo to originating client
outboundDialingWSS.on("connection", webSocketClient =>
  outboundWSSHandler.handleConnection(
    webSocketClient,
    twilioClient,
    callWebSocketMapping
  )
);

tools.setupHeartbeatMonitor("outboundDialingWSS", outboundDialingWSS, 30000);

// store websocketServer so it can be referenced in http server
app.set("outboundDialingWSS", outboundDialingWSS);

//store these references so they can be access in routes
app.set("callWebSocketMapping", callWebSocketMapping);
app.set("twilioClient", twilioClient);

console.info("AccountSid: " + process.env.TWILIO_ACCOUNT_SID);
console.info(
  "Auth Token: " + process.env.TWILIO_AUTH_TOKEN.slice(0, 5) + "..."
);
console.info(
  "Outbound Calling Workflow Sid: " + process.env.TWILIO_OUTBOUND_WORKFLOW_SID
);
console.info("Backend: " + process.env.EXTERNAL_HOST);

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

module.exports = { app, outboundDialingWSS };

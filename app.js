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
var authentication = require("./common/authentication");
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

//setup authentication up for websocket
app.use("/websocket", function(req, res, next) {
  var token = req.header("sec-websocket-protocol")
    ? req.header("sec-websocket-protocol")
    : req.header("token");

  authentication
    .isValid(token)
    .then(() => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Method", "OPTIONS POST GET");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      next();
    })
    .catch(error => {
      res.status(403);
      res.send(createError(403));
    });
});

// map traditional routes
app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/twilio-webhook/callStatusCallbackHandler", callStatusCallbackHandler);
app.use("/twilio-webhook/callHandlerTwiml", callHandlerTwiml);

/**
 *  Outbound dialing websocket
 *
 */

// init websocket server dedicated to outbound dialing
var outboundDialingWSS = new ws.Server({ noServer: true });
var outboundWSSHandler = require("./websockets/outboundDial/eventManager");
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

/**
 *  Realtime stats websocket
 *
 */

var realtimeStatsWSS = new ws.Server({ noServer: true });
var realtimeStatsWSSHandler = require("./websockets/realtimeStats/eventManager");

// setup message echo to originating client
realtimeStatsWSS.on("connection", webSocketClient =>
  realtimeStatsWSSHandler.handleConnection(webSocketClient, twilioClient)
);

tools.setupHeartbeatMonitor("realtimeStatsWSS", realtimeStatsWSS, 30000);
tools.setupQueueStatsSchedule(realtimeStatsWSS, 2000, twilioClient);

// store websocketServer so it can be referenced in http server
app.set("outboundDialingWSS", outboundDialingWSS);
app.set("realtimeStatsWSS", realtimeStatsWSS);

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

module.exports = { app, outboundDialingWSS, realtimeStatsWSS };

var tools = require("../common/tools");
var express = require("express");
var router = express.Router();

router.options("/", (req, res, next) => {
  tools.setCORSHeaders(res);
  res.send();
});

router.post("/", (req, res, next) => {
  tools.setCORSHeaders(res);

  // callback receive send 200 immediately
  res.send();

  console.debug("\tcallback for: ", req.body.CallSid);
  console.debug("\t\tto:\t", req.body.To);
  console.debug("\t\tfrom:\t", req.body.From);
  console.debug("\t\tstatus:\t", req.body.CallStatus);

  var callWebSocketMapping = req.app.get("callWebSocketMapping");
  inboundClient = callWebSocketMapping.get(req.body.CallSid);

  var response = JSON.stringify({
    callSid: req.body.CallSid,
    callStatus: req.body.CallStatus
  });

  if (inboundClient && inboundClient.readyState === inboundClient.OPEN) {
    inboundClient.send(response);
  } else {
    console.error(
      "couldnt find open websocket client for callsid: " + req.body.CallSid
    );
  }

  if (req.body.CallStatus === "completed") {
    callWebSocketMapping.delete(req.body.CallSid);
    console.debug(
      "\tremoved map entry for completed call: " + req.body.CallSid
    );
  }
});

module.exports = router;

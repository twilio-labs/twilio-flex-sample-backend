var tools = require("../common/tools");
var express = require("express");
var VoiceResponse = require("twilio").twiml.VoiceResponse;
var router = express.Router();

router.options("/", (req, res, next) => {
  res.send();
});

router.post("/", (req, res, next) => {
  res.setHeader("Content-Type", "application/xml");

  console.debug("\tcallhandler for: ", req.body.CallSid);
  console.debug("\t\tworker:\t", req.query.workerContactUri);
  console.debug("\t\tto:\t", req.body.To);
  console.debug("\t\tworkflowSid:\t", process.env.TWILIO_OUTBOUND_WORKFLOW_SID);

  var taskAttributes = {
    targetWorker: req.query.workerContactUri,
    autoAnswer: "true",
    type: "outbound",
    direction: "outbound",
    name: req.body.To
  };

  let twiml = new VoiceResponse();

  var enqueue = twiml.enqueue({
    workflowSid: `${process.env.TWILIO_OUTBOUND_WORKFLOW_SID}`
  });

  enqueue.task(JSON.stringify(taskAttributes));
  res.send(twiml.toString());
});

module.exports = router;

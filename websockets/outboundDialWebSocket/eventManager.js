function handleConnection(webSocketClient, twilioClient, callWebSocketMapping) {
  // setup ping response
  webSocketClient.isAlive = true;
  webSocketClient.on("pong", () => {
    webSocketClient.isAlive = true;
  });

  // Create handler for events coming in on this socket connection
  webSocketClient.on("message", data =>
    handleIncomingMessage(
      data,
      webSocketClient,
      twilioClient,
      callWebSocketMapping
    )
  );
}

function handleIncomingMessage(
  data,
  webSocketClient,
  twilioClient,
  callWebSocketMapping
) {
  // look for JSON object, if it fails to parse
  // echo the message back

  var socketResponse;

  try {
    data = JSON.parse(data);

    if (data.method === "call") {
      makeOutboundCall(twilioClient, data).then(resp => {
        // if outbound call succesfully placed
        if (resp.success) {
          var call = resp.call;

          // map the callSid to the calling client so we know who to update when status events come back from twilio
          callWebSocketMapping.set(call.sid, webSocketClient);

          // let client know their call is queued
          socketResponse = JSON.stringify({
            messageType: "callUpdate",
            callSid: call.sid,
            callStatus: call.status.toString()
          });
        } else {
          // relay error message to client
          socketResponse = JSON.stringify({
            messageType: "error",
            message: resp.error.message
          });
        }
        webSocketClient.send(socketResponse);
      });
    } else if (data.method === "hangup" && data.callSid) {
      hangupCall(twilioClient, data).then(resp => {
        // if success we let the call status update event update the client
        // if we fail we send the failure message back to the client
        if (!resp.success) {
          socketResponse = JSON.stringify({
            messageType: "error",
            message: resp.error.message
          });
          webSocketClient.send(socketResponse);
        }
      });
    } else {
      // if it was a JSON object and we dont recognize it, let the client know
      socketResponse = "Unrecognized payload: " + data;
      webSocketClient.send(socketResponse);
      console.warn(socketResponse);
    }
  } catch (e) {
    // if not an object, echo back to originating client
    socketResponse = "echo: " + data;
    webSocketClient.send(socketResponse);
  }
}

function makeOutboundCall(twilioClient, data) {
  return new Promise(function(resolve, reject) {
    var callHandlerCallbackURL = encodeURI(
      "https://" +
        process.env.EXTERNAL_HOST +
        "/callHandlerTwiml?workerContactUri=" +
        data.workerContactUri
    );

    var statusCallbackURL =
      "https://" + process.env.EXTERNAL_HOST + "/callStatusCallbackHandler";

    twilioClient.calls
      .create({
        url: callHandlerCallbackURL,
        to: data.to,
        from: data.from,
        statusCallback: statusCallbackURL,
        statusCallbackEvent: ["ringing", "answered", "completed"]
      })
      .then(call => {
        logCall(call);
        resolve({ success: true, call: call });
      })
      .catch(error => {
        console.error("\tcall creation failed");
        console.error("\tERROR: ", error);
        resolve({ success: false, error: error });
      });
  });
}

function hangupCall(twilioClient, data) {
  return new Promise(function(resolve, reject) {
    twilioClient
      .calls(data.callSid)
      .update({ status: "completed" })
      .then(call => {
        logCall(call);
        resolve({ success: true, call: call });
      })
      .catch(error => {
        console.error("\tcall failed to terminate: ", data.callSid);
        console.error("\tERROR: ", error);

        resolve({ success: false, error: error });
      });
  });
}

function logCall(call) {
  console.debug("\tcall: ", call.sid);
  console.debug("\t\tto:\t", call.to);
  console.debug("\t\tfrom:\t", call.from);
  console.debug("\t\tstatus:\t", call.status.toString());
}

module.exports = { handleConnection };

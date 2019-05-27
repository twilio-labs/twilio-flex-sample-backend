axios = require("axios");

function isValid(token) {
  return new Promise(function(resolve, reject) {
    var authOptions = {
      method: "POST",
      url: `https://${process.env.TWILIO_ACCOUNT_SID}:${
        process.env.TWILIO_AUTH_TOKEN
      }@iam.twilio.com/v1/Accounts/${
        process.env.TWILIO_ACCOUNT_SID
      }/Tokens/validate`,
      data: JSON.stringify({ token: token }),
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "application/json"
      }
    };

    axios(authOptions)
      .then(response => {
        if (response.data.valid) {
          resolve();
        } else {
          console.log("unable to authenticate token");
          reject();
        }
      })
      .catch(error => {
        console.log("ERROR: ", error);
        reject();
      });
  });
}

module.exports = { isValid };

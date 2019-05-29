var queueStats = [];

function listQueues(twilioClient) {
  return new Promise(function(resolve, reject) {
    twilioClient.taskrouter
      .workspaces(process.env.TWILIO_FLEX_WORKSPACE_SID)
      .taskQueues.list()
      .then(result => {
        var queueArray = [];
        result.forEach(arrayItem => {
          queueArray.push({
            sid: arrayItem.sid,
            friendlyName: arrayItem.friendlyName
          });
        });
        resolve({ success: true, queueArray: queueArray });
      })
      .catch(err => {
        console.log("err message: ", err.message);
        resolve({ success: false, message: err.message });
      });
  });
}

function populateRealTimeStatsForQueueItem(
  twilioClient,
  queueItem,
  taskChannel
) {
  return new Promise(function(resolve, reject) {
    twilioClient.taskrouter
      .workspaces(process.env.TWILIO_FLEX_WORKSPACE_SID)
      .taskQueues(queueItem.sid)
      .realTimeStatistics()
      .fetch({ taskChannel: taskChannel ? taskChannel : undefined })
      .then(result => {
        taskChannel = !taskChannel ? "all" : taskChannel;
        var realTimeStats = minimizeRealTimeStats(result);
        queueItem["realTimeStats_" + taskChannel] = realTimeStats;
        resolve(queueItem);
      })
      .catch(err => {
        queueItem.realTimeStatsMessage = err.message;
        resolve(queueItem);
      });
  });
}

function populateCumulativeStatsForQueueItem(
  twilioClient,
  queueItem,
  taskChannel
) {
  var todaysDate = new Date();
  todaysDate.setHours(0, 0, 0, 0);
  return new Promise(function(resolve, reject) {
    twilioClient.taskrouter
      .workspaces(process.env.TWILIO_FLEX_WORKSPACE_SID)
      .taskQueues(queueItem.sid)
      .cumulativeStatistics()
      .fetch({
        taskChannel: taskChannel ? taskChannel : undefined,
        startDate: todaysDate,
        splitByWaitTime: "30,60,120"
      })
      .then(result => {
        taskChannel = !taskChannel ? "all" : taskChannel;
        queueItem["cumulativeStats_" + taskChannel] = minimizeCumulativeStats(
          result
        );
        resolve(queueItem);
      })
      .catch(err => {
        queueItem.cumulativeStatsMessage = err.message;
        resolve(queueItem);
      });
  });
}

function minimizeRealTimeStats(realTimeStats) {
  if (realTimeStats) {
    var result = {};
    result.activityStatistics = [];

    realTimeStats.activityStatistics.forEach(activity => {
      result.activityStatistics.push({
        friendly_name: activity.friendly_name,
        workers: activity.workers
      });
    });

    result.oldestTask = realTimeStats.longestTaskWaitingAge;
    result.tasksByPriority = realTimeStats.tasksByPriority;
    result.tasksByStatus = realTimeStats.tasksByStatus;
    result.availableWorkers = realTimeStats.totalAvailableWorkers;
    result.eligibleWorkers = realTimeStats.totalEligibleWorkers;
    result.totalTasks = realTimeStats.totalTasks;

    return result;
  } else {
    return null;
  }
}
function minimizeCumulativeStats(cumulativeStatistics) {
  if (cumulativeStatistics) {
    var minimizedCumulativeStats = {
      rCreated: cumulativeStatistics.reservationsCreated,
      rRej: cumulativeStatistics.reservationsRejected,
      rAccepted: cumulativeStatistics.reservationsAccepted,
      rTimedOut: cumulativeStatistics.reservationsTimedOut,
      rCancel: cumulativeStatistics.reservationsCanceled,
      rRescind: cumulativeStatistics.reservationsRescinded,

      tCompl: cumulativeStatistics.tasksCompleted,
      tMoved: cumulativeStatistics.tasksMoved,
      tEnter: cumulativeStatistics.tasksEntered,
      tCanc: cumulativeStatistics.tasksCanceled,
      tDel: cumulativeStatistics.tasksDeleted,

      waitUntilCancel: cumulativeStatistics.waitDurationUntilCanceled,
      waitUntilAccept: cumulativeStatistics.waitDurationUntilAccepted,
      splitByWaitTime: cumulativeStatistics.splitByWaitTime,

      endTime: cumulativeStatistics.endTime,
      startTime: cumulativeStatistics.startTime,

      avgTaskAcceptanceTime: cumulativeStatistics.avgTaskAcceptanceTime
    };

    return minimizedCumulativeStats;
  } else {
    return null;
  }
}

function fetchAllQueueStatistics(twilioClient, withCumulative) {
  // retrieves all queues for the environment configured workspace
  // then proceeds to fetch all stats data for them
  // returns an array of queue objects populated with the relevant stats nested on
  // the object
  return new Promise(function(resolve, reject) {
    console.log("Calling with cumulative: ", withCumulative);
    listQueues(twilioClient).then(result => {
      if (result.success) {
        var queueResultsArray = result.queueArray;
        var getStatsPromiseArray = [];
        queueResultsArray.forEach(queueItem => {
          // Every cycle retreive realtime stats for all known channels
          // comment out the channel if it is not used,
          // to save on redundent calls to backend
          getStatsPromiseArray.push(
            populateRealTimeStatsForQueueItem(twilioClient, queueItem, null)
          );
          //get stats filtered by channel
          getStatsPromiseArray.push(
            populateRealTimeStatsForQueueItem(twilioClient, queueItem, "voice")
          );
          getStatsPromiseArray.push(
            populateRealTimeStatsForQueueItem(twilioClient, queueItem, "chat")
          );
          getStatsPromiseArray.push(
            populateRealTimeStatsForQueueItem(twilioClient, queueItem, "video")
          );

          if (withCumulative) {
            getStatsPromiseArray.push(
              populateCumulativeStatsForQueueItem(twilioClient, queueItem, null)
            );
            getStatsPromiseArray.push(
              populateCumulativeStatsForQueueItem(
                twilioClient,
                queueItem,
                "voice"
              )
            );
            getStatsPromiseArray.push(
              populateCumulativeStatsForQueueItem(
                twilioClient,
                queueItem,
                "chat"
              )
            );
            getStatsPromiseArray.push(
              populateCumulativeStatsForQueueItem(
                twilioClient,
                queueItem,
                "video"
              )
            );
          }
        });

        Promise.all(getStatsPromiseArray).then(values => {
          // now merge the results from the backend to the
          // stats array currently maintained in memory
          queueResultsArray.forEach(queueResultItem => {
            let matched = false;
            queueStats.forEach(queueStatsItem => {
              if (queueStatsItem.sid === queueResultItem.sid) {
                Object.assign(queueStatsItem, queueResultItem);
                matched = true;
              }
            });
            if (!matched) {
              queueStats.push(queueResultItem);
            }
          });
          resolve(queueStats);
        });
      }
    });
  });
}

function getCurrentQueueStats() {
  return queueStats;
}

module.exports = { fetchAllQueueStatistics, getCurrentQueueStats };

function deleteSyncMap(twilioClient, syncMapName) {
  return new Promise(function(resolve, reject) {
    const syncService = twilioClient.sync.services(
      process.env.TWILIO_FLEX_SYNC_SID
    );

    syncService
      .syncMaps(syncMapName)
      .remove()
      .then(map => {
        console.log("Succesfully deleted map: " + syncMapName);
        resolve(true);
      })
      .catch(error => {
        console.log("error deleting map: " + syncMapName);
        resolve(false);
      });
  });
}

function ensureSyncMapExists(twilioClient, mapName) {
  return new Promise(function(resolve, reject) {
    const syncService = twilioClient.sync.services(
      process.env.TWILIO_FLEX_SYNC_SID
    );

    syncService
      .syncMaps(mapName)
      .fetch()
      .then(() => {
        console.log("sync map existence confirmed"), resolve(true);
      })
      .catch(err => {
        console.log(err.message);
        console.log("creating sync map %s", MAP_NAME);
        syncService.syncMaps
          .create({ uniqueName: mapName })
          .then(sync_map => {
            console.log("sync map created: " + sync_map.sid);
            resolve(true);
          })
          .catch(err => {
            console.log(err.message);
            resolve(false);
          });
      });
  });
}

function setSyncMapItem(twilioClient, mapName, itemId, data) {
  return new Promise(function(resolve, reject) {
    const syncService = twilioClient.sync.services(
      process.env.TWILIO_FLEX_SYNC_SID
    );

    syncService
      .syncMaps(mapName)
      .syncMapItems(itemId)
      .update({ data: data })
      .then(item => {
        console.log("Item updated: " + queueItem.sid);
        resolve(true);
      })
      .catch(err => {
        console.log("retrying as create item");

        //retry the item as a create
        syncService
          .syncMaps(mapName)
          .syncMapItems.create({
            key: itemId,
            data: data
          })
          .then(item => {
            console.log("Item created " + queueItem.sid);
            resolve(true);
          })
          .catch(err => {
            console.log(err.message);
            resolve(false);
          });
      });
  });
}

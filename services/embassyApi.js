const express = require("express");
const cors = require("cors");
const config = require("config");
const printer3d = require("./printer3d");
const embassyApiConfig = config.get("embassy-api");
const app = express();
const port = embassyApiConfig.port;
const find = require('local-devices');

app.use(cors());

app.get("/devices", async (_, res) => {
  let devices = await find({ address: embassyApiConfig.networkRange });
  res.send(devices.map(d=> d.mac));
});

app.get("/printer", async (_, res) => {
  try {
    console.log("/printer request");
    
    let fileMetadata;
    let thumbnailBuffer;
    let statusResponse = await printer3d.getPrinterStatus();
    let status = statusResponse && statusResponse.result.status;

    if (status) {
      let fileMetadataResponse = await printer3d.getFileMetadata(
        status.print_stats && status.print_stats.filename
      );

      if (fileMetadataResponse) {
        fileMetadata = fileMetadataResponse.result;
        thumbnailBuffer = await printer3d.getThumbnail(
          fileMetadata && fileMetadata.thumbnails[2].relative_path
        );
      }
    }

    res.send({ status, thumbnailBuffer });
    console.log(status);
  } catch (error) {
    console.log(error);
    res.send({ error: error });
  }
});

app.listen(port);
console.log(`Embassy Api is ready on port ${port}`);

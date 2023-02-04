require("dotenv").config();
const express = require("express");
const cors = require("cors");
const config = require("config");
const printer3d = require("./printer3d");
const embassyApiConfig = config.get("embassy-api");
const app = express();
const port = embassyApiConfig.port;
const routerip = embassyApiConfig.routerip;
const find = require('local-devices');
const { LUCI } = require('luci-rpc');
const fetch = require('node-fetch');

app.use(cors());

app.get("/devicesold", async (_, res) => {
  let devices = await find({ address: embassyApiConfig.networkRange });
  res.send(devices.map(d=> d.mac));
});

app.get("/devices", async (_, res) => {

  const luci = new LUCI(`https://${routerip}`, 'bot', process.env["LUCITOKEN"]);
  await luci.init();
  luci.autoUpdateToken(1000 * 60 * 30);

  let rpc =
  [
    {"jsonrpc":"2.0","id":28,"method":"call","params":[luci.token,"iwinfo","assoclist",{"device":"wlan0"}]},
    {"jsonrpc":"2.0","id":29,"method":"call","params":[luci.token,"iwinfo","assoclist",{"device":"wlan1"}]}
  ];

  let response = await fetch(`http://${routerip}/ubus/`, {
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(rpc),
    method: "POST"
  });

  let json = await response.json();
  let macs = [];
  for (const wlan of json) {
    macs = macs.concat(wlan.result[1].results.map(dev => dev.mac.toLowerCase()));
  }

  res.send(macs);
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

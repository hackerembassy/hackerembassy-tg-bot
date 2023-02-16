require("dotenv").config();

const express = require("express");
const cors = require("cors");
const printer3d = require("./services/printer3d");
const find = require("local-devices");
const { LUCI } = require("luci-rpc");
const fetch = require("node-fetch");

const config = require("config");
const embassyApiConfig = config.get("embassy-api");
const port = embassyApiConfig.port;
const routerip = embassyApiConfig.routerip;

const app = express();
app.use(cors());

app.get("/webcam", async (_, res) => {
  try {
    // tmp solution - flush previous image
    await fetch(`${embassyApiConfig.webcam}/jpg`);
    // main request
    const response = await fetch(`${embassyApiConfig.webcam}/jpg`);
    let imgbuffer = await response.arrayBuffer();
    res.send(Buffer.from(imgbuffer));
  } catch (error) {
    res.send({ message: "Device request failed", error });
  }
});

app.get("/devicesscan", async (_, res) => {
  let devices = await find({ address: embassyApiConfig.networkRange });
  res.send(devices.map((d) => d.mac));
});

app.get("/devices", async (_, res) => {
  try {
    const luci = new LUCI(`https://${routerip}`, "bot", process.env["LUCITOKEN"]);
    await luci.init();
    luci.autoUpdateToken(1000 * 60 * 30);

    let rpc = [
      {
        jsonrpc: "2.0",
        id: 93,
        method: "call",
        params: [luci.token, "iwinfo", "assoclist", { device: "phy0-ap0" }],
      },
      {
        jsonrpc: "2.0",
        id: 94,
        method: "call",
        params: [luci.token, "iwinfo", "assoclist", { device: "phy1-ap0" }],
      },
    ];

    let response = await fetch(`http://${routerip}/ubus/`, {
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(rpc),
      method: "POST",
    });

    let json = await response.json();
    let macs = [];
    for (const wlan of json) {
      macs = macs.concat(wlan.result[1].results.map((dev) => dev.mac.toLowerCase()));
    }

    res.send(macs);
  } catch (error) {
    console.log(error);
    res.send({ message: "Device request failed", error });
  }
});

app.get("/printer", async (_, res) => {
  try {
    let fileMetadata;
    let thumbnailBuffer;
    let statusResponse = await printer3d.getPrinterStatus();
    let status = statusResponse && statusResponse.result.status;

    if (status) {
      let fileMetadataResponse = await printer3d.getFileMetadata(status.print_stats && status.print_stats.filename);

      if (fileMetadataResponse) {
        fileMetadata = fileMetadataResponse.result;
        thumbnailBuffer = await printer3d.getThumbnail(fileMetadata && fileMetadata.thumbnails[2].relative_path);
      }
    }

    res.send({ status, thumbnailBuffer });
  } catch (error) {
    console.log(error);
    res.send({ message: "Printer request error", error });
  }
});

app.listen(port);

console.log(`Embassy Api is ready on port ${port}`);

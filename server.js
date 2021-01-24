require("dotenv").config();

const express = require("express");

const bodyParser = require("body-parser");

const axios = require("axios");

const { serializeParams, signMessage } = require("./api");

const app = express();

const sourceDir = "dist";

app.use(express.static(sourceDir));

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

app.get("/api/bybit/*", async (req, res) => {
  const { secret, ...params } = req.query;

  const url = new URL(`https://api.bybit.com${req.url}`);
  url.pathname = url.pathname.replace(/^.*?\/bybit/, "");
  url.search = "";
  url.hash = "";

  const timestamped = { ...params, timestamp: Date.now() };

  const signed = {
    ...timestamped,
    sign: signMessage(serializeParams(timestamped), secret),
  };

  Object.keys(signed)
    .sort()
    .forEach((key) => url.searchParams.set(key, signed[key]));

  console.log(req.url);
  console.log(url.href);

  const result = await axios.get(url.href);

  res.send(result.data);
});

app.post("/api/bybit/*", async (req, res) => {
  const path = req.url.replace(/^.*?\/bybit\//, "");

  const { secret, ...params } = req.body;

  const timestamped = { ...params, timestamp: Date.now() };

  const signed = {
    ...timestamped,
    sign: signMessage(serializeParams(timestamped), secret),
  };

  console.log(req.url, path, req.body, signed);

  const result = await axios.post(`https://api.bybit.com/${path}`, signed);

  res.send(result.data);
});

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`Express web server started: http://localhost:${port}`);
  console.log(`Serving content from /${sourceDir}/`);
});

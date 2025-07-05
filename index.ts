import express from "express";
import http from "http"; // use https for secure connection
import cors from "cors";
import { config } from "dotenv";
import { corsConfig } from "./lib/config/config";

import { env } from "./lib/env";
import logger from "./lib/middleware/logger";
import { rootRouter } from "./lib/api";

config();
const PORT = env.PORT;

// Express app initialization
const app = express()
  .use(cors(corsConfig))
  .use(express.json())
  .use(logger)
  .use("/api/jobs", rootRouter);

//  HTTPS server initialization
const server = http.createServer(
  // uncomment this if you want to use https
  /*
  {
    key: readFileSync("./certificates/cert.key"),
    cert: readFileSync("./certificates/cert.crt"),
  },
  */
  app
);

// Start server
server.listen(PORT, () => {
  console.log("Server Listening to Port : ", PORT);
});

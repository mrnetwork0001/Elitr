import "./env.js"; // must stay first: normalizes process.env before other modules read it
import { startServers } from "./server.js";

startServers();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { ResidentialController } from "./controllers/residential.controller";
import { DataCenterController } from "./controllers/datacenter.controller";
import { MobileController } from "./controllers/mobile.controller";
import { ValidationMiddleware } from "./middlewares/validation.middleware";

const app = express();

// Middlewares
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use(cors());
app.use(
    helmet({
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: false,
        referrerPolicy: false,
        crossOriginOpenerPolicy: false,
    })
);

// Controllers
const residentialController = new ResidentialController();
const dataCenterController = new DataCenterController();
const mobileController = new MobileController();

// Residential Routes
app.get(
    "/residential/fetch",
    residentialController.fetchResidentials.bind(residentialController)
);
app.post(
    "/residential/webhook",
    residentialController.handleWebhook.bind(residentialController)
);
app.get(
    "/residential/isp",
    residentialController.fetchISPData.bind(residentialController)
);
app.get(
    "/residential/zip-codes/fetch",
    residentialController.fetchZipCodes.bind(residentialController)
);
app.post(
    "/residential/zip-codes/match",
    residentialController.matchZipCodes.bind(residentialController)
);
app.get(
    "/residential",
    ValidationMiddleware.validateSkip,
    ValidationMiddleware.validateTake,
    residentialController.getResidentials.bind(residentialController)
);

// Data Center Routes
app.get(
    "/datacenter/fetch",
    dataCenterController.fetchDataCenters.bind(dataCenterController)
);
app.get(
    "/datacenter",
    ValidationMiddleware.validateSkip,
    ValidationMiddleware.validateTake,
    dataCenterController.getDataCenters.bind(dataCenterController)
);

// Mobile Routes
app.get("/mobile/fetch", mobileController.fetchMobiles.bind(mobileController));
app.get(
    "/mobile",
    ValidationMiddleware.validateSkip,
    ValidationMiddleware.validateTake,
    mobileController.getMobiles.bind(mobileController)
);

export default app;

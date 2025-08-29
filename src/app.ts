import express from "express";
import cors from "cors";
import helmet from "helmet";
import { ResidentialController } from "./controllers/residential.controller";
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

// Routes
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
    "/residential",
    ValidationMiddleware.validateSkip,
    ValidationMiddleware.validateTake,
    residentialController.getResidentials.bind(residentialController)
);

export default app;

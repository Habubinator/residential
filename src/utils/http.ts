import axios from "axios";

export const HttpRequest = axios.create({
    timeout: 30000,
    headers: {
        "api-key": process.env.API_KEY,
    },
});

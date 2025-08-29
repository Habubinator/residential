import axios from "axios";

export const HttpRequest = axios.create({
    timeout: 20000,
    headers: {
        "api-key": process.env.API_KEY,
    },
});

import axios from "axios";

export const HttpRequest = axios.create({
    timeout: 10000, // 10 секунд таймаут
    headers: {
        "api-key": process.env.API_KEY,
    },
});

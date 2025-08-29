import { Request, Response, NextFunction } from "express";

export class ValidationMiddleware {
    static validateEnum(allowedValues: any[]) {
        return (req: Request, res: Response, next: NextFunction) => {
            const value = req.query.value || req.body.value;

            if (!value) {
                req.query.value = null;
                return next();
            }

            const index = allowedValues.indexOf(Number(value));
            if (index !== -1) {
                req.query.value = value;
            } else {
                req.query.value = null;
            }

            next();
        };
    }

    static validateSkip(req: Request, res: Response, next: NextFunction) {
        let value = req.query.skip ? Number(req.query.skip) : 0;

        if (isNaN(value) || value < 0) {
            return res.status(400).json({ error: "Invalid skip parameter" });
        }

        req.query.skip = value.toString();
        next();
    }

    static validateTake(req: Request, res: Response, next: NextFunction) {
        let value = req.query.take ? Number(req.query.take) : 30;

        if (isNaN(value) || value < 1 || value > 100) {
            return res.status(400).json({ error: "Invalid take parameter" });
        }

        req.query.take = value.toString();
        next();
    }
}

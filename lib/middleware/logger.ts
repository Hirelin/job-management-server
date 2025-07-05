import { Request, Response, NextFunction } from "express";
import chalk from "chalk";

const logger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const method = chalk.blue(req.method);
    const url = chalk.green(req.originalUrl);
    const status =
      res.statusCode < 400
        ? chalk.green(res.statusCode)
        : res.statusCode < 500
        ? chalk.yellow(res.statusCode)
        : chalk.red(res.statusCode);
    const time = chalk.magenta(`${duration}ms`);

    console.log(`${method} ${url} ${status} - ${time}`);
  });

  next();
};

export default logger;

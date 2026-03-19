import type { NextFunction, Request, Response } from 'express'

type Middleware = (req: Request, res: Response, next: NextFunction) => void

export default function initMiddleware(middleware: Middleware) {
  return (req: Request, res: Response) =>
    new Promise<void>((resolve, reject) => {
      middleware(req, res, (result: unknown) => {
        if (result instanceof Error) {
          return reject(result)
        }
        return resolve()
      })
    })
}

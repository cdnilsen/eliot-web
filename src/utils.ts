import type { NextFunction, Request, Response } from 'express'

// idk. from https://github.com/indexphonemica/pshrimp-server/blob/master/utils.js
export function wrapAsync(fn: (req: Request, res: Response, next?: NextFunction) => Promise<unknown>) {
    return function(req: Request, res: Response, next: NextFunction) {
        return fn(req, res, next).catch(next)
    }
}
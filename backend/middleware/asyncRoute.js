// Express 4 does not automatically catch a rejected promise from an async
// route handler or middleware — without this, a thrown error inside one
// just hangs the request forever instead of producing the same response a
// synchronous throw always got. Wrap every async handler/middleware with
// this so errors reach the global error handler in server.js.
export function asyncRoute(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

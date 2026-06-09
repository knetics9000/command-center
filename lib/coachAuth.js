/** True when the request carries the configured coach token. */
export function requireCoachToken(req) {
  const token = req.headers.get("x-coach-token");
  return Boolean(process.env.COACH_TOKEN) && token === process.env.COACH_TOKEN;
}

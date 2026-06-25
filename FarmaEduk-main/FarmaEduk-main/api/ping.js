export default function handler(req, res) {
  return res.status(200).json({
    status: 'ok',
    runtime: 'vercel',
    route: 'ping',
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasJwtSecret: Boolean(process.env.JWT_SECRET),
  });
}

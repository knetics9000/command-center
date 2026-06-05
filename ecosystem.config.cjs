// PM2 process config for the Command Center web app.
// Usage on the VPS:  pm2 start ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: "command-center",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: "400M",
      env: { NODE_ENV: "production" },
    },
  ],
};

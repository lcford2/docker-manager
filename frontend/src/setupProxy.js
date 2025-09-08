const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  const backendTarget =
    process.env.NODE_ENV === "production"
      ? "http://backend:6500" // Container name in Docker
      : "http://localhost:6500"; // Development

  // API proxy
  app.use(
    "/api",
    createProxyMiddleware({
      target: backendTarget,
      changeOrigin: true,
      headers: {
        "X-Forwarded-Proto": "http",
      },
    }),
  );

  // WebSocket proxy - critical for WebSocket connections
  app.use(
    "/api/ws",
    createProxyMiddleware({
      target: backendTarget,
      changeOrigin: true,
      ws: true, // Enable WebSocket proxying
      headers: {
        "X-Forwarded-Proto": "http",
      },
      logLevel: "debug", // Add logging for debugging
    }),
  );
};

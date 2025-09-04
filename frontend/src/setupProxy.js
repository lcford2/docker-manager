const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  // API proxy
  app.use(
    "/api",
    createProxyMiddleware({
      target: "http://backend:6500",
      changeOrigin: true,
      headers: {
        "X-Forwarded-Proto": "http",
      },
    }),
  );

  // WebSocket proxy
  app.use(
    "/api/ws",
    createProxyMiddleware({
      target: "http://backend:6500",
      changeOrigin: true,
      ws: true,
      headers: {
        "X-Forwarded-Proto": "http",
      },
    }),
  );
};

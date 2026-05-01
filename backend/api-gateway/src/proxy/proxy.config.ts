export interface ServiceRoute {
  prefix: string;
  target: string;
  publicPaths?: RegExp[];
}

function svcUrl(envKey: string, fallback: string): string {
  return process.env[envKey] ?? fallback;
}

export function buildServiceRoutes(): ServiceRoute[] {
  const auth    = svcUrl('AUTH_SERVICE_URL',    'http://localhost:4001');
  const product = svcUrl('PRODUCT_SERVICE_URL', 'http://localhost:4002');
  const cart    = svcUrl('CART_SERVICE_URL',    'http://localhost:4003');
  const order   = svcUrl('ORDER_SERVICE_URL',   'http://localhost:4004');
  const payment = svcUrl('PAYMENT_SERVICE_URL', 'http://localhost:4005');

  return [
    {
      prefix: '/api/auth',
      target: auth,
      publicPaths: [
        /^\/api\/auth\/login$/,
        /^\/api\/auth\/register$/,
      ],
    },
    {
      prefix: '/api/products',
      target: product,
      publicPaths: [
        /^\/api\/products$/,
        /^\/api\/products\/featured$/,
        /^\/api\/products\/[^/]+$/,
        /^\/api\/categories$/,
        /^\/api\/categories\/[^/]+$/,
      ],
    },
    {
      prefix: '/api/categories',
      target: product,
      publicPaths: [
        /^\/api\/categories$/,
        /^\/api\/categories\/[^/]+$/,
      ],
    },
    {
      prefix: '/api/cart',
      target: cart,
      publicPaths: [],
    },
    {
      prefix: '/api/orders',
      target: order,
      publicPaths: [],
    },
    {
      prefix: '/api/admin/orders',
      target: order,
      publicPaths: [],
    },
    {
      prefix: '/api/payment',
      target: payment,
      publicPaths: [
        /^\/api\/payment\/webhook$/,
      ],
    },
    {
      prefix: '/api/admin/payments',
      target: payment,
      publicPaths: [],
    },
  ];
}

// Keep the static export for backward-compat with any existing imports
export const SERVICE_ROUTES = buildServiceRoutes();

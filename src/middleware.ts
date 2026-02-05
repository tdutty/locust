import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_API_PATHS = ['/api/email/', '/api/inbox', '/api/crm/', '/api/pipeline', '/api/stats', '/api/settings'];
const PROTECTED_PAGE_PATHS = ['/dashboard'];

function isProtectedAPI(pathname: string): boolean {
  return PROTECTED_API_PATHS.some(p => pathname.startsWith(p));
}

function isProtectedPage(pathname: string): boolean {
  return PROTECTED_PAGE_PATHS.some(p => pathname.startsWith(p));
}

function validateJWT(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return false;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return false;

    // Check required fields
    if (!payload.userId || !payload.email) return false;

    return true;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth routes
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  const token = request.cookies.get('locust_auth')?.value;
  const isValid = token ? validateJWT(token) : false;

  if (isProtectedAPI(pathname) && !isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isProtectedPage(pathname) && !isValid) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/email/:path*', '/api/inbox/:path*', '/api/crm/:path*', '/api/pipeline/:path*', '/api/stats/:path*', '/api/settings/:path*'],
};

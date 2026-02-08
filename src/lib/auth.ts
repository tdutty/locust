import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

// Users configured via environment variables
// Format: LOCUST_USERS=email|password|name|role,email2|password2|name2|role2
// Password can be plaintext or bcrypt hash (starting with $2)
function loadUsers() {
  const usersEnv = process.env.LOCUST_USERS;
  if (!usersEnv) {
    return [];
  }
  return usersEnv.split(',').map((entry, idx) => {
    const [email, password, name, role] = entry.split('|');
    return { id: String(idx + 1), email, password, name, role: role || 'ae' };
  });
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
}

export async function authenticateUser(email: string, password: string): Promise<User | null> {
  const users = loadUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    return null;
  }

  // Support both plaintext and bcrypt hashed passwords
  let isValid = false;
  if (user.password.startsWith('$2')) {
    isValid = await bcrypt.compare(password, user.password);
  } else {
    isValid = password === user.password;
  }

  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export function generateToken(user: User): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    } as TokenPayload,
    getJwtSecret(),
    { expiresIn: '24h' }
  );
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as TokenPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function getAuthFromRequest(cookieValue: string | undefined): TokenPayload | null {
  if (!cookieValue) return null;
  return verifyToken(cookieValue);
}

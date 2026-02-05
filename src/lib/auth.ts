import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET!;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// Users configured via environment variables
// Format: LOCUST_USERS=email:hashedPassword:name:role,email2:hashedPassword2:name2:role2
function loadUsers() {
  const usersEnv = process.env.LOCUST_USERS;
  if (!usersEnv) {
    console.warn('LOCUST_USERS not configured. No users available.');
    return [];
  }
  return usersEnv.split(',').map((entry, idx) => {
    const [email, password, name, role] = entry.split(':');
    return { id: String(idx + 1), email, password, name, role: role || 'ae' };
  });
}

const USERS = loadUsers();

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
  const user = USERS.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.password);

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
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

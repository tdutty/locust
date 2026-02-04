import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'locust-secret-key-change-in-production';

// Default users (in production, use database)
const USERS = [
  {
    id: '1',
    email: 'admin@sweetlease.io',
    password: '$2a$10$K.0HwpsoPDGaB/atFBmmXOGTw4ceeg33.WrxJx/SJIxCFt4xEwpCi', // locust2024
    name: 'Terrell Gilbert',
    role: 'admin',
  },
  {
    id: '2',
    email: 'tgilbert@sweetlease.io',
    password: '$2a$10$K.0HwpsoPDGaB/atFBmmXOGTw4ceeg33.WrxJx/SJIxCFt4xEwpCi', // locust2024
    name: 'Terrell Gilbert',
    role: 'ae',
  },
];

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

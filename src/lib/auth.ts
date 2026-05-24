import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { db } from '@/lib/db'
import type { Role } from '@prisma/client'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),

  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          scope: 'openid email profile',
        },
      },
    }),
  ],

  session: { strategy: 'jwt' },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as typeof user & { role: Role }).role ?? 'USER'
        token.id   = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id   = token.id as string
        session.user.role = token.role as Role
      }
      return session
    },
  },

  pages: {
    signIn:  '/login',
    error:   '/login',
  },
})

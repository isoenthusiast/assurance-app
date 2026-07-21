import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = nextUrl.pathname === "/login";
      if (!isLoggedIn) return isLoginPage;
      if (isLoginPage) return false; // redirect authenticated users away from login
      // Admin-only UI pages (/admin/*)
      if (nextUrl.pathname.startsWith("/admin") && auth.user.role !== "Admin") {
        return false;
      }
      return true;
    },
    jwt: ({ token, user }) => {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string | undefined;
        (session.user as { id?: string }).id = (token.id as string) || token.sub;
      }
      return session;
    },
  },
};

const FIREBASE_API_KEY = 'AIzaSyDhuxQLCNDRNz9L7hVCFnQYjpiUZTitzLM'
const FIREBASE_PROJECT = 'tif-2af68'

export interface FirebaseUser {
  uid:   string
  email: string
}

/**
 * Verify a Firebase ID token server-side via the Firebase REST API.
 * Returns the authenticated user, or null if the token is invalid.
 */
export async function verifyFirebaseToken(idToken: string): Promise<FirebaseUser | null> {
  if (!idToken) return null
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    )
    if (!res.ok) return null
    const data = await res.json() as { users?: Array<{ localId: string; email?: string; projectId?: string }> }
    const fbUser = data.users?.[0]
    if (!fbUser?.localId || !fbUser.email) return null
    return { uid: fbUser.localId, email: fbUser.email }
  } catch {
    return null
  }
}

/**
 * Extract and verify the Firebase Bearer token from a request Authorization header.
 */
export async function getFirebaseUserFromRequest(req: Request): Promise<FirebaseUser | null> {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  return verifyFirebaseToken(token)
}

export { FIREBASE_PROJECT }

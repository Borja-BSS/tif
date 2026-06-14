import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey:            'AIzaSyDhuxQLCNDRNz9L7hVCFnQYjpiUZTitzLM',
  authDomain:        'tif-2af68.firebaseapp.com',
  projectId:         'tif-2af68',
  storageBucket:     'tif-2af68.firebasestorage.app',
  messagingSenderId: '260165983011',
  appId:             '1:260165983011:web:9fa63d9ecd157701e54a96',
  measurementId:     'G-CJCGP0GSJP',
}

// Évite la double initialisation en mode dev (HMR Next.js)
const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
export const firebaseAuth    = getAuth(app)
export const firebaseStorage = getStorage(app)
export default app

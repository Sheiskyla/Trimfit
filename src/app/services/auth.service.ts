import { Injectable } from '@angular/core';
import {
  Auth,
  User,
  UserCredential,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';
import { BehaviorSubject } from 'rxjs';
import { firebaseAuth } from '../firebase.config';
import { firestore } from '../firebase.config';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly profileStorageKey = 'trimfit_profile';
  private readonly auth: Auth = firebaseAuth;
  private readonly userSubject = new BehaviorSubject<User | null>(this.auth.currentUser);
  private authReadyResolve!: () => void;
  private readonly authReady = new Promise<void>((resolve) => {
    this.authReadyResolve = resolve;
  });
  readonly user$ = this.userSubject.asObservable();

  constructor() {
    onAuthStateChanged(this.auth, (user) => {
      this.userSubject.next(user);
      this.authReadyResolve();
      if (user?.displayName) {
        this.saveProfileName(user.displayName, user.email || '');
      }
    });
  }

  get currentUser(): User | null {
    return this.userSubject.value;
  }

  waitForAuthState(): Promise<void> {
    return this.authReady;
  }

  private readonly userNameSubject = new BehaviorSubject<string | null>(this.getStoredUserName());
  readonly userName$ = this.userNameSubject.asObservable();

  get currentUserName(): string | null {
    return this.userNameSubject.value || this.getStoredUserName();
  }

  private getStoredUserName(): string | null {
    const user = this.auth.currentUser;
    if (user?.displayName) {
      return user.displayName;
    }
    try {
      const storedName = localStorage.getItem('trimfit_user_name');
      if (storedName && storedName.trim()) return storedName.trim();

      const profile = JSON.parse(localStorage.getItem(this.profileStorageKey) || 'null') as { name?: string } | null;
      if (profile?.name && profile.name.trim()) return profile.name.trim();

      const settings = JSON.parse(localStorage.getItem('trimfit_settings') || '{}');
      if (settings?.name && settings.name.trim()) return settings.name.trim();

      return user?.email?.split('@')[0] || null;
    } catch {
      return user?.email?.split('@')[0] || null;
    }
  }


  async signIn(email: string, password: string): Promise<UserCredential> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();
    const credential = await Promise.race([
      signInWithEmailAndPassword(this.auth, cleanEmail, cleanPass),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject({
          code: 'auth/timeout',
          message: 'Sign-in timed out. Check your connection and try again.'
        }), 5000);
      })
    ]);
    this.saveProfileName(credential.user.displayName || cleanEmail.split('@')[0], cleanEmail);
    return credential;
  }

  async signUp(email: string, password: string, displayName: string): Promise<UserCredential> {
    const cleanEmail = email.trim().toLowerCase();
    const name = displayName.trim();
    const credential = await createUserWithEmailAndPassword(this.auth, cleanEmail, password);
    await updateProfile(credential.user, { displayName: name });
    await credential.user.reload();
    this.saveProfileName(name, cleanEmail);

    void setDoc(doc(firestore, 'users', credential.user.uid), {
      displayName: name,
      email: credential.user.email,
      createdAt: serverTimestamp()
    }).catch((error) => {
      console.warn('Firestore profile save failed; local profile was saved.', error);
    });

    await signOut(this.auth);
    return credential;
  }

  resetPassword(email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    return sendPasswordResetEmail(this.auth, cleanEmail).catch(() => {
      return Promise.resolve();
    });
  }

  logout(): Promise<void> {
    return signOut(this.auth);
  }

  private saveProfileName(name: string, email: string): void {
    if (!name || !name.trim()) return;
    const cleanName = name.trim();
    try {
      localStorage.setItem('trimfit_user_name', cleanName);
      localStorage.setItem(this.profileStorageKey, JSON.stringify({ name: cleanName, email: email.toLowerCase() }));
      const settings = JSON.parse(localStorage.getItem('trimfit_settings') || '{}');
      settings.name = cleanName;
      localStorage.setItem('trimfit_settings', JSON.stringify(settings));
      this.userNameSubject.next(cleanName);
    } catch {
      this.userNameSubject.next(cleanName);
    }
  }
}
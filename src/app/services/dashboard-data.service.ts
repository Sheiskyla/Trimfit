import { Injectable } from '@angular/core';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from '../firebase.config';
import { AuthService } from './auth.service';

export interface DashboardData {
  settings: {
    name: string;
    calorieGoal: number;
    minutesGoal: number;
    waterGoalMl: number;
  };
  todayWaterMl: number;
  waterHistory: number[];
  workouts: unknown[];
}

@Injectable({ providedIn: 'root' })
export class DashboardDataService {
  constructor(private readonly auth: AuthService) {}

  async load(): Promise<DashboardData | null> {
    const user = this.auth.currentUser;
    if (!user) {
      return null;
    }

    const storageKey = this.storageKey(user.uid);
    try {
      const snapshot = await getDoc(doc(firestore, 'users', user.uid, 'dashboard', 'state'));
      if (snapshot.exists()) {
        const data = snapshot.data() as DashboardData;
        this.saveLocal(storageKey, data);
        return data;
      }
    } catch (error) {
      console.warn('Firestore dashboard load failed; using local storage.', error);
    }

    return this.loadLocal(storageKey);
  }

  async save(data: DashboardData): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('You must be signed in to save dashboard data.');
    }

    const firestoreData = JSON.parse(JSON.stringify(data)) as DashboardData;
    this.saveLocal(this.storageKey(user.uid), firestoreData);

    try {
      await setDoc(doc(firestore, 'users', user.uid, 'dashboard', 'state'), firestoreData);
    } catch (error) {
      console.warn('Firestore dashboard save failed; local storage copy was saved.', error);
    }
  }

  private storageKey(uid: string): string {
    return `trimfit_dashboard_${uid}`;
  }

  private saveLocal(key: string, data: DashboardData): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn('Dashboard local storage save failed.', error);
    }
  }

  private loadLocal(key: string): DashboardData | null {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) as DashboardData : null;
    } catch (error) {
      console.warn('Dashboard local storage load failed.', error);
      return null;
    }
  }
}